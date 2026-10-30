import test from 'node:test';
import assert from 'node:assert/strict';

// A controlled IndexedDB event boundary, not an IndexedDB implementation.
// Tests deliberately drive request success separately from transaction commit.
async function boundary(t) {
  const transactions = [];
  const db = {
    close() {},
    transaction(name, mode) {
      assert.equal(name,'records');
      const transaction = {
        mode, puts:[], gets:[], cleared:false,
        objectStore() { return this; },
        put(record) { this.puts.push(structuredClone(record)); },
        get(id) { const request = { id }; this.gets.push(request); return request; },
        getAll() { this.read = {}; return this.read; },
        clear() { this.cleared = true; },
        abort() { this.onabort(); }
      };
      transactions.push(transaction);
      return transaction;
    }
  };
  globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess(); }); return request; } };
  t.after(() => { delete globalThis.indexedDB; });
  const api = await import(`../src/persistence.js?test=${crypto.randomUUID()}`);
  await api.openDatabase();
  return { api, transactions };
}

test('storage reports success only after transaction commit', async t => {
  const { api, transactions } = await boundary(t);
  let resolved = false;
  const saved = api.writeRecords([{ id:'a',updatedAt:'v1' }]).then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved,false);
  assert.equal(transactions[0].mode,'readwrite');
  transactions[0].oncomplete();
  await saved;
  assert.equal(resolved,true);
});

test('storage abort rejects a write instead of claiming it was saved', async t => {
  const { api, transactions } = await boundary(t);
  const saved = api.writeRecords([{ id:'a' }]);
  const rejected = assert.rejects(saved,/changed in another tab/);
  transactions[0].onabort();
  await rejected;
});

test('stale edits abort without queuing an overwrite', async t => {
  const { api, transactions } = await boundary(t);
  const saved = api.writeRecords([{ id:'a',updatedAt:'new edit' }],{ expectedUpdatedAt:'old version' });
  const rejected = assert.rejects(saved,/changed in another tab/);
  const transaction = transactions[0];
  transaction.gets[0].result = { id:'a',updatedAt:'someone else saved' };
  transaction.gets[0].onsuccess();
  await rejected;
  assert.deepEqual(transaction.puts,[]);
});

test('matching versions permit edits and still wait for commit', async t => {
  const { api, transactions } = await boundary(t);
  const saved = api.writeRecords([{ id:'a',updatedAt:'next' }],{ expectedUpdatedAt:'previous' });
  const transaction = transactions[0];
  transaction.gets[0].result = { id:'a',updatedAt:'previous' };
  transaction.gets[0].onsuccess();
  assert.deepEqual(transaction.puts,[{ id:'a',updatedAt:'next' }]);
  transaction.oncomplete();
  await saved;
});

test('repeat imports preserve existing work and add only missing identities', async t => {
  const { api, transactions } = await boundary(t);
  const saved = api.writeRecords([{ id:'existing',notes:'imported' },{ id:'new',notes:'new note' }],{ onlyNew:true });
  const transaction = transactions[0];
  transaction.gets[0].result = { id:'existing',notes:'keep my work' };
  transaction.gets[0].onsuccess();
  transaction.gets[1].result = undefined;
  transaction.gets[1].onsuccess();
  assert.deepEqual(transaction.puts,[{ id:'new',notes:'new note' }]);
  transaction.oncomplete();
  await saved;
});

test('read errors and transaction errors propagate to the caller', async t => {
  const { api, transactions } = await boundary(t);
  const reading = api.readRecords();
  const readFailure = assert.rejects(reading,/Read failed/);
  transactions[0].read.error = new Error('Read failed');
  transactions[0].read.onerror();
  await readFailure;
  const writing = api.writeRecords([]);
  const writeFailure = assert.rejects(writing,/Quota exceeded/);
  transactions[1].error = new Error('Quota exceeded');
  transactions[1].onerror();
  await writeFailure;
});

test('clearing data and successful reads use the expected transaction boundary', async t => {
  const { api, transactions } = await boundary(t);
  const reading = api.readRecords();
  transactions[0].read.result = [{ id:'a' }];
  transactions[0].read.onsuccess();
  assert.deepEqual(await reading,[{ id:'a' }]);
  assert.equal(transactions[0].mode,undefined); // IndexedDB defaults to readonly.
  const clearing = api.writeRecords([],{ clear:true });
  assert.equal(transactions[1].cleared,true);
  transactions[1].oncomplete();
  await clearing;
});

test('unavailable or blocked browser storage gives an actionable opening error', async t => {
  t.after(() => { delete globalThis.indexedDB; });
  for (const [event,message] of [['onerror',/storage is unavailable/],['onblocked',/Close other workspace tabs/]]) {
    globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => request[event]()); return request; } };
    const api = await import(`../src/persistence.js?test=${crypto.randomUUID()}`);
    await assert.rejects(api.openDatabase(),message);
  }
});
