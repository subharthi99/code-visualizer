import { validateVisual } from './visual.js';
import { exercises } from './content.js';

export const SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 5_000_000;
export const uid = () => globalThis.crypto.randomUUID();
const text = (value, max = 50_000) => typeof value === 'string' ? value.slice(0, max) : '';
export const clone = value => structuredClone(value);

export function canonicalLeetCode(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a complete LeetCode problem URL.'); }
  if (url.protocol !== 'https:' || !['leetcode.com', 'www.leetcode.com'].includes(url.hostname) || url.port || url.username || url.password) {
    throw new Error('Use an https://leetcode.com/problems/… link.');
  }
  const match = url.pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/(?:description|editorial|solutions|submissions)(?:\/.*)?)?\/?$/);
  if (!match) throw new Error('This page is not a supported LeetCode problem link.');
  return { slug: match[1], url: `https://leetcode.com/problems/${match[1]}/`, title: match[1].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') };
}

export function makeRecord({ exerciseId = '', url = '', title = '' } = {}) {
  const exercise = exercises.find(item => item.id === exerciseId);
  const source = url ? canonicalLeetCode(url) : null;
  const now = new Date().toISOString();
  return {
    id: source ? `leetcode:${source.slug}` : exercise ? `exercise:${exercise.id}` : uid(),
    exerciseId: exercise?.id || '', url: source?.url || '',
    title: text(title, 200) || exercise?.title || source?.title || 'Untitled problem',
    createdAt: now, updatedAt: now, status: 'Exploring',
    restatement: '', constraints: exercise?.constraints || '', example: '', approach: '',
    algorithm: '', revision: 1, revisions: [], hintCount: 0, hintHistory: [],
    cases: [], snapshots: [], cue: '', invariant: '', mistake: '', complexity: '',
    due: null, reviews: []
  };
}

export function saveAlgorithm(record, algorithm) {
  if (record.algorithm === algorithm) return record;
  const next = clone(record);
  next.revisions.push({ revision: next.revision, algorithm: next.algorithm, at: new Date().toISOString() });
  next.algorithm = text(algorithm);
  next.revision += 1;
  return next;
}

export function addSnapshot(record, draft) {
  if (!draft.action?.trim()) throw new Error('Describe the action you are dry-running.');
  if (!draft.explanation?.trim()) throw new Error('Explain why this step follows from your algorithm.');
  const variables = typeof draft.variables === 'string' ? JSON.parse(draft.variables) : draft.variables;
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new Error('Variables must be a JSON object, such as {"i": 0}.');
  const frames = clone(draft.frames || []);
  validateFrames(frames);
  const next = clone(record);
  next.snapshots.push({ id: uid(), revision: record.revision, at: new Date().toISOString(), step: text(draft.step, 100), action: text(draft.action, 500), input: text(draft.input), variables: clone(variables), frames, explanation: text(draft.explanation), diagram: text(draft.diagram), ...(draft.visual !== undefined ? { visual:validateVisual(draft.visual) } : {}) });
  return next;
}

function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length > 100) throw new Error('A dry run supports at most 100 call frames.');
  const ids = new Set();
  for (const f of frames) {
    if (!f || typeof f.id !== 'string' || ids.has(f.id) || (f.parentId && !ids.has(f.parentId)) || !['active', 'suspended', 'returned'].includes(f.status)) throw new Error('Invalid call-frame history.');
    ids.add(f.id);
  }
  const live = frames.filter(f => f.status !== 'returned');
  for (const [index, frame] of live.entries()) {
    const expectedStatus = index === live.length - 1 ? 'active' : 'suspended';
    const expectedParent = index === 0 ? null : live[index - 1].id;
    if (frame.status !== expectedStatus || frame.parentId !== expectedParent) throw new Error('Invalid call-frame history: live calls must form one active stack.');
  }
}

export function enterFrame(frames, label, locals = '{}') {
  if (!label.trim()) throw new Error('Name the call first, such as depth(left).');
  const parsed = JSON.parse(locals);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Call locals must be a JSON object.');
  if (frames.length >= 100) throw new Error('Limit reached: 100 frames per snapshot.');
  const next = clone(frames);
  const parent = next.findLast(f => f.status === 'active');
  if (parent) parent.status = 'suspended';
  next.push({ id: uid(), parentId: parent?.id || null, label: text(label, 200), locals: parsed, status: 'active', returned: '' });
  return next;
}

export function returnFrame(frames, value) {
  const next = clone(frames);
  const frame = next.findLast(f => f.status === 'active');
  if (!frame) throw new Error('Enter a call before returning from it.');
  frame.status = 'returned';
  frame.returned = text(value, 1000);
  const parent = next.find(f => f.id === frame.parentId);
  if (parent) parent.status = 'active';
  return next;
}

export function updateActiveFrame(frames, locals) {
  const next = clone(frames);
  validateFrames(next);
  const frame = next.findLast(item => item.status === 'active');
  if (!frame) throw new Error('Enter a call before editing active locals.');
  const parsed = JSON.parse(locals);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Call locals must be a JSON object.');
  frame.locals = parsed;
  return next;
}

export function reviewRecord(record, rating, now = new Date()) {
  const days = { again: 1, hard: 1, good: 3, easy: 7 }[rating];
  if (!days) throw new Error('Unknown review rating.');
  const next = clone(record);
  next.reviews.push({ at: now.toISOString(), rating, policy: 'fixed-v1', assisted: false });
  const due = new Date(now);
  due.setDate(due.getDate() + days);
  next.due = due.toISOString();
  return next;
}

export function checkCase(exerciseId, input) {
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('Use JSON for this exercise’s input.'); }
  if (exerciseId === 'pair-sum') {
    const { nums, target } = value || {};
    if (!Array.isArray(nums) || nums.length < 2 || nums.length > 100 || !nums.every(n => Number.isInteger(n) && Math.abs(n) <= 1000) || !Number.isInteger(target) || Math.abs(target) > 1000) throw new Error('Use {"nums":[…],"target":…}; 2–100 integers, all values and target between -1000 and 1000.');
    const pairs = [];
    nums.forEach((n, i) => nums.slice(i + 1).forEach((m, j) => { if (n + m === target) pairs.push([i, i + j + 1]); }));
    if (pairs.length !== 1) throw new Error(`This exercise requires exactly one valid pair; this input has ${pairs.length}.`);
    return `${JSON.stringify(pairs[0])} (either order)`;
  }
  if (exerciseId === 'subsets') {
    if (!Array.isArray(value) || value.length > 12 || !value.every(Number.isSafeInteger) || new Set(value).size !== value.length) throw new Error('Use an array of 0–12 distinct safe integers.');
    // Bound the visible output; the count and uniqueness property remain valid.
    if (value.length > 6) return `${2 ** value.length} distinct subsets, including []. Each uses only input values, at most once.`;
    const subsets = value.reduce((all, n) => [...all, ...all.map(s => [...s, n])], [[]]);
    return `${JSON.stringify(subsets)} (any order)`;
  }
  if (exerciseId === 'tree-depth') {
    if (!Array.isArray(value) || value.length > 200 || !value.every(n => n === null || Number.isSafeInteger(n))) throw new Error('Use a level-order tree array with numbers and nulls (at most 200 entries).');
    if (!value.length) return '0';
    if (value[0] === null) {
      if (value.length !== 1) throw new Error('An empty root cannot have child entries.');
      return '0';
    }
    let queue = [1], index = 1, depth = 1;
    while (queue.length && index < value.length) {
      const level = queue.shift();
      for (let child = 0; child < 2 && index < value.length; child++, index++) {
        if (value[index] !== null) { queue.push(level + 1); depth = Math.max(depth, level + 1); }
      }
    }
    if (index < value.length) throw new Error('This array contains nodes without a parent. Use compact level-order encoding.');
    return String(depth);
  }
  throw new Error('Custom problems use learner-checked outcomes. Add your specification and expected result.');
}

export function parseCSV(source) {
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (closed && c !== ',' && c !== '\n' && c !== '\r') throw new Error('The CSV contains characters after a closing quote.');
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) { quoted = false; closed = true; }
      else if (cell === '') quoted = true;
      else cell += c;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; closed = false; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; closed = false;
    } else cell += c;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one record.');
  if (rows.length > 1001) throw new Error('Import at most 1,000 records at a time.');
  return { headers: rows[0], rows: rows.slice(1) };
}

export function mapCSV(csv, mapping) {
  const records = [], errors = [], seen = new Set();
  csv.rows.forEach((row, i) => {
    try {
      const get = name => mapping[name] === '' || mapping[name] === undefined ? '' : row[Number(mapping[name])] || '';
      const url = get('url').trim();
      if (!url) throw new Error('Missing LeetCode URL; skipped to preserve repeat-import identity.');
      const record = makeRecord({ url, title: get('title') });
      if (seen.has(record.id)) throw new Error('Duplicate question in this file.');
      seen.add(record.id);
      record.approach = get('notes');
      record.invariant = get('topic');
      const status = get('status').toLowerCase();
      record.status = /done|solved|complete/.test(status) && !/not|unsolved|incomplete/.test(status) ? 'Practiced' : 'Exploring';
      records.push(record);
    } catch (error) { errors.push({ row: i + 2, message: error.message }); }
  });
  return { records, errors };
}

export function validateBackup(data) {
  if (!data || data.version !== SCHEMA_VERSION || !Array.isArray(data.records) || data.records.length > 1000) throw new Error('Unsupported backup. Use a version 1 Code Visualizer JSON export with at most 1,000 records.');
  const ids = new Set();
  return data.records.map(raw => {
    if (!raw || typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) throw new Error('Backup contains an invalid or duplicate record ID.');
    ids.add(raw.id);
    const base = makeRecord({ exerciseId: raw.exerciseId, url: raw.url, title: raw.title });
    if ((raw.id.startsWith('exercise:') && !base.exerciseId) || (raw.id.startsWith('leetcode:') && !base.url)) throw new Error('Backup question identity is missing its source.');
    if ((raw.url || raw.exerciseId) && base.id !== raw.id) throw new Error('Backup question identity does not match its source.');
    base.id = raw.id;
    for (const key of ['restatement','constraints','example','approach','algorithm','cue','invariant','mistake','complexity']) base[key] = text(raw[key]);
    if (raw.patternNote !== undefined) {
      if (typeof raw.patternNote !== 'string') throw new Error('Invalid pattern note.');
      base.patternNote = text(raw.patternNote);
    }
    for (const key of ['createdAt','updatedAt']) {
      if (typeof raw[key] !== 'string' || !Number.isFinite(Date.parse(raw[key]))) throw new Error('Backup contains an invalid timestamp.');
      base[key] = raw[key];
    }
    base.status = ['Exploring','Practiced'].includes(raw.status) ? raw.status : 'Exploring';
    base.revision = Number.isSafeInteger(raw.revision) && raw.revision > 0 ? raw.revision : 1;
    base.hintCount = Math.min(5, Math.max(0, Number(raw.hintCount) || 0));
    for (const key of ['cases','snapshots','reviews','revisions','hintHistory']) {
      if (!Array.isArray(raw[key]) || raw[key].length > 10_000) throw new Error(`Invalid ${key} history.`);
      base[key] = clone(raw[key]);
    }
    // Validate all rendered nested data, so malformed imports cannot break the workspace.
    for (const c of base.cases) if (!c || !['id','input','expected','why','category'].every(k => typeof c[k] === 'string') || !Number.isSafeInteger(c.revision)) throw new Error('Invalid edge case in backup.');
    for (const c of base.cases) if (c.reductions !== undefined) {
      if (!Array.isArray(c.reductions) || c.reductions.length > 10000 || c.reductions.some(d => !d || !['input','actual','expected','lesson'].every(k => typeof d[k] === 'string' && d[k].trim() && d[k].length <= 10000) || !Number.isFinite(Date.parse(d.at)) || !Number.isSafeInteger(d.revision))) throw new Error('Invalid counterexample history.');
    }
    for (const snap of base.snapshots) {
      if (!snap || !['id','action','explanation','input','step','diagram'].every(k => typeof snap[k] === 'string') || !Number.isSafeInteger(snap.revision) || !snap.variables || typeof snap.variables !== 'object' || Array.isArray(snap.variables)) throw new Error('Invalid dry-run snapshot in backup.');
      validateFrames(snap.frames);
      if (snap.visual !== undefined) snap.visual = validateVisual(snap.visual);
      for (const f of snap.frames) if (typeof f.label !== 'string' || typeof f.returned !== 'string' || !f.locals || typeof f.locals !== 'object') throw new Error('Invalid call frame.');
    }
    for (const r of base.reviews) if (!r || !['again','hard','good','easy'].includes(r.rating) || !Number.isFinite(Date.parse(r.at))) throw new Error('Invalid review history.');
    for (const r of base.reviews) if (r.policy === 'recall-v2' && (typeof r.assisted !== 'boolean' || !Number.isInteger(r.intervalDays) || r.intervalDays < 1 || r.intervalDays > 90 || !['attempt','transition','edgeCase'].every(k => typeof r[k] === 'string' && r[k].length <= 10000))) throw new Error('Invalid recall evidence or interval.');
    for (const r of base.revisions) if (!r || typeof r.algorithm !== 'string' || !Number.isSafeInteger(r.revision)) throw new Error('Invalid algorithm revision.');
    if (raw.due !== null && !Number.isFinite(Date.parse(raw.due))) throw new Error('Invalid review date.');
    base.due = raw.due;
    if (raw.description !== undefined) {
      if (typeof raw.description !== 'string') throw new Error('Invalid problem description.');
      base.description = text(raw.description,30_000);
    }
    if (raw.contextSource !== undefined) {
      const source = raw.contextSource;
      if (!source || source.url !== base.url || !Number.isFinite(Date.parse(source.at)) || !Array.isArray(source.fields) || !source.fields.every(field => ['title','description','examples','constraints'].includes(field))) throw new Error('Invalid context source.');
      base.contextSource = clone(source);
    }
    return base;
  });
}
