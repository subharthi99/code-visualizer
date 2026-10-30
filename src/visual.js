const visualId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
const visualScalar = value => value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' && value.length <= 200;
function visualList(values) { if (!Array.isArray(values) || values.length > 50 || !values.every(visualScalar)) throw new Error('Use at most 50 scalar JSON values (strings, numbers, booleans, or null).'); }
function visualName(name) { if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new Error('Use a non-empty reference or pointer name, up to 60 characters.'); }

export function emptyVisual(kind = 'array') {
  if (kind === 'array') return { kind,values:[],pointers:[] };
  if (kind === 'tree') return { kind,rootId:null,activeNodeId:null,nodes:[] };
  if (kind === 'objects') return { kind,objects:[],references:[] };
  throw new Error('Choose array, tree, or shared objects.');
}

export function validateVisual(state) {
  if (!state || typeof state !== 'object') throw new Error('Invalid visual state.');
  if (state.kind === 'array') {
    visualList(state.values);
    if (!Array.isArray(state.pointers) || state.pointers.length > 20) throw new Error('Use at most 20 named pointers.');
    const names = new Set();
    for (const pointer of state.pointers) {
      visualName(pointer?.name);
      if (names.has(pointer.name) || !Number.isInteger(pointer.index) || pointer.index < 0 || pointer.index > state.values.length) throw new Error('Pointer index must be inside the array or one past its end; names must be unique.');
      names.add(pointer.name);
    }
  } else if (state.kind === 'tree') {
    if (!Array.isArray(state.nodes) || state.nodes.length > 50) throw new Error('A tree supports at most 50 nodes.');
    const nodes = new Map();
    for (const node of state.nodes) {
      if (!node || !visualId(node.id) || nodes.has(node.id) || !visualScalar(node.value)) throw new Error('Invalid tree node or duplicate node ID.');
      nodes.set(node.id,node);
    }
    if (!nodes.size) {
      if (state.rootId !== null || state.activeNodeId !== null) throw new Error('An empty tree has no root or selected node.');
    } else {
      if (!nodes.has(state.rootId) || state.activeNodeId !== null && !nodes.has(state.activeNodeId)) throw new Error('Invalid tree root or selected node.');
      const visited = new Set();
      const visit = id => {
        if (id === null) return;
        if (!nodes.has(id) || visited.has(id)) throw new Error('Invalid tree: dangling child, shared child, or cycle.');
        visited.add(id); const node = nodes.get(id); visit(node.left); visit(node.right);
      };
      visit(state.rootId);
      if (visited.size !== nodes.size) throw new Error('Invalid tree: all nodes must be reachable from one root.');
    }
  } else if (state.kind === 'objects') {
    if (!Array.isArray(state.objects) || state.objects.length > 30 || !Array.isArray(state.references) || state.references.length > 30) throw new Error('Use at most 30 objects and 30 references.');
    const ids = new Set(), names = new Set();
    for (const object of state.objects) {
      if (!object || !visualId(object.id) || ids.has(object.id)) throw new Error('Use unique object IDs.');
      ids.add(object.id); visualList(object.values);
    }
    for (const ref of state.references) {
      visualName(ref?.name);
      if (names.has(ref.name) || !ids.has(ref.target)) throw new Error('Each reference must point to an existing object and have a unique name.');
      names.add(ref.name);
    }
  } else throw new Error('Unknown visual diagram type.');
  return structuredClone(state);
}

export function setVisualArray(state, values) {
  const next = validateVisual(state);
  if (next.kind !== 'array') throw new Error('Select an array diagram first.');
  next.values = structuredClone(values);
  return validateVisual(next);
}

export function putPointer(state, name, index) {
  const next = validateVisual(state);
  if (next.kind !== 'array') throw new Error('Select an array diagram first.');
  next.pointers = [...next.pointers.filter(pointer => pointer.name !== name),{ name,index }];
  return validateVisual(next);
}

export function putTreeNode(state, { id,value,parentId = '',side = 'left' }) {
  const next = validateVisual(state);
  if (next.kind !== 'tree' || !visualId(id) || !visualScalar(value)) throw new Error('Use a tree node ID with letters, numbers, underscores, or hyphens and a scalar value.');
  const existing = next.nodes.find(node => node.id === id);
  if (existing) existing.value = value;
  else {
    if (!next.nodes.length) {
      if (parentId) throw new Error('The first tree node is the root and has no parent.');
      next.rootId = id;
    } else {
      const parent = next.nodes.find(node => node.id === parentId);
      if (!parent || !['left','right'].includes(side)) throw new Error('Choose an existing parent and a left or right branch.');
      if (parent[side] !== null) throw new Error('That tree branch is already occupied.');
      parent[side] = id;
    }
    next.nodes.push({ id,value,left:null,right:null });
  }
  next.activeNodeId = id;
  return validateVisual(next);
}

export function putObject(state, id, values) {
  const next = validateVisual(state);
  if (next.kind !== 'objects' || !visualId(id)) throw new Error('Use a shared-object diagram and a valid object ID.');
  visualList(values);
  const object = next.objects.find(item => item.id === id);
  if (object) object.values = structuredClone(values);
  else next.objects.push({ id,values:structuredClone(values) });
  return validateVisual(next);
}

export function putReference(state, name, target) {
  const next = validateVisual(state);
  if (next.kind !== 'objects') throw new Error('Choose a shared-object diagram first.');
  next.references = [...next.references.filter(ref => ref.name !== name),{ name,target }];
  return validateVisual(next);
}

function visualFingerprint(value) {
  const order = item => Array.isArray(item) ? item.map(order) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key,order(item[key])])) : item;
  return JSON.stringify(order(value));
}

export function stateChanges(before = {}, after = {}) {
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key => visualFingerprint(before[key]) !== visualFingerprint(after[key])).map(label => ({ label,before:before[label],after:after[label] }));
}

export function visualChanges(before, after) {
  const flatten = visual => {
    if (!visual) return {};
    if (visual.kind === 'array') return Object.fromEntries([...visual.values.map((v,i) => [`Array [${i}]`,v]),...visual.pointers.map(p => [`Pointer ${p.name}`,p.index])]);
    if (visual.kind === 'tree') return Object.fromEntries([...visual.nodes.map(n => [`Node ${n.id}`,{ value:n.value,left:n.left,right:n.right }]),['Active node',visual.activeNodeId]]);
    return Object.fromEntries([...visual.objects.map(o => [`Object ${o.id}`,o.values]),...visual.references.map(r => [`Reference ${r.name}`,r.target])]);
  };
  if (before && after && before.kind !== after.kind) return [{ label:'Diagram type',before:before.kind,after:after.kind }];
  return stateChanges(flatten(before),flatten(after));
}
