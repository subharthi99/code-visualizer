// Imported observations stay separate from learner-authored dry-run snapshots.
export function validateTrace(raw) {
  const fail = () => { throw new Error('Invalid Python trace. Import a version-1 trace from the local runner.'); };
  const string = (value,max = 1000) => typeof value === 'string' && value.length <= max;
  const id = value => typeof value === 'string' && /^[fo][1-9][0-9]{0,5}$/.test(value);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(raw) || raw.version !== 1 || raw.engine !== 'cpython-settrace-v1' || !string(raw.python,40) || !string(raw.source,20000) || !raw.source.trim() || !/^[a-f0-9]{64}$/.test(raw.sourceHash) || !['complete','error','limited'].includes(raw.status) || !string(raw.message,2000) || !string(raw.stdout,8000) || !Array.isArray(raw.events) || raw.events.length > 1000 || raw.status === 'complete' && !raw.events.length) fail();
  if (JSON.stringify(raw).length > 4_000_000) fail();
  const lines = raw.source.split('\n').length;
  const knownFrames = new Map();
  const objectTypes = new Map();
  let liveIds = [];
  for (const [index,event] of raw.events.entries()) {
    if (!object(event) || event.id !== index+1 || !['call','line','return','exception','unwind'].includes(event.kind) || !string(event.function,200) || !Number.isInteger(event.line) || event.line < 1 || event.line > lines || !id(event.frameId) || !Array.isArray(event.frames) || !event.frames.length || event.frames.length > 50 || !object(event.heap) || Object.keys(event.heap).length > 256) fail();
    if (event.kind === 'call') {
      if (knownFrames.has(event.frameId) || event.parentId !== (liveIds.at(-1) || null)) fail();
      liveIds = [...liveIds,event.frameId];
    }
    if (JSON.stringify(event.frames.map(frame => frame?.id)) !== JSON.stringify(liveIds)) fail();
    if (index === 0 && (event.kind !== 'call' || event.function !== '<module>')) fail();
    const checkValue = value => {
      if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || string(value)) return;
      if (!object(value) || Object.keys(value).length !== 1) fail();
      if (Object.hasOwn(value,'ref') && id(value.ref) && Object.hasOwn(event.heap,value.ref)) return;
      if (Object.hasOwn(value,'integer') && typeof value.integer === 'string' && /^-?\d{1,1000}$/.test(value.integer)) return;
      fail();
    };
    for (const [ref,entry] of Object.entries(event.heap)) {
      if (!/^o[1-9][0-9]{0,5}$/.test(ref) || !object(entry) || !['list','tuple','dict','set'].includes(entry.type) || !Array.isArray(entry.items) || entry.items.length > 50) fail();
      if (objectTypes.has(ref) && objectTypes.get(ref) !== entry.type) fail();
      objectTypes.set(ref,entry.type);
      for (const value of entry.items) {
        if (entry.type === 'dict') {
          if (!Array.isArray(value) || value.length !== 2) fail();
          value.forEach(checkValue);
        } else checkValue(value);
      }
    }
    const seen = new Set();
    for (const [i,frame] of event.frames.entries()) {
      const last = i === event.frames.length-1;
      const expected = !last ? 'suspended' : event.kind === 'return' ? 'returned' : event.kind === 'unwind' ? 'raised' : 'active';
      if (!object(frame) || !/^f[1-9][0-9]{0,5}$/.test(frame.id) || seen.has(frame.id) || frame.parentId !== (i ? event.frames[i-1].id : null) || frame.status !== expected || !string(frame.function,200) || !Number.isInteger(frame.line) || frame.line < 1 || frame.line > lines || !object(frame.locals) || Object.keys(frame.locals).length > 200) fail();
      const identity = JSON.stringify([frame.function,frame.parentId]);
      if (knownFrames.has(frame.id) && knownFrames.get(frame.id) !== identity) fail();
      knownFrames.set(frame.id,identity); seen.add(frame.id);
      for (const [name,value] of Object.entries(frame.locals)) { if (!string(name,200)) fail(); checkValue(value); }
    }
    const active = event.frames.at(-1);
    if (event.frameId !== active.id || event.parentId !== active.parentId || event.function !== active.function || event.line !== active.line) fail();
    if (event.kind === 'return') { if (!Object.hasOwn(event,'value')) fail(); checkValue(event.value); }
    if (event.kind === 'exception' && (!object(event.exception) || !string(event.exception.type,200) || !string(event.exception.message))) fail();
    if (event.kind === 'return' || event.kind === 'unwind') liveIds = liveIds.slice(0,-1);
  }
  if (raw.status === 'complete' && (liveIds.length || raw.events.at(-1)?.kind !== 'return')) fail();
  return structuredClone({ version:raw.version,engine:raw.engine,python:raw.python,source:raw.source,sourceHash:raw.sourceHash,status:raw.status,message:raw.message,stdout:raw.stdout,events:raw.events });
}

export function tracePosition(trace, position, action) {
  const last = trace.events.length-1;
  if (last < 0) return -1;
  const here = Math.max(0,Math.min(last,position));
  if (action === 'first') return 0;
  if (action === 'last') return last;
  if (action === 'previous') return Math.max(0,here-1);
  if (action === 'over' || action === 'out') {
    const event = trace.events[here], depth = event.frames.length;
    const next = trace.events.findIndex((candidate,i) => i > here && (candidate.frames.length < depth || action === 'over' && candidate.frameId === event.frameId));
    return next < 0 ? last : next;
  }
  return Math.min(last,here+1);
}
