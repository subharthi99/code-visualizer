import { exercises, genericHints, genericCases, hintLabels } from './content.js';
import { uid, clone, makeRecord, canonicalLeetCode, saveAlgorithm, addSnapshot, enterFrame, returnFrame, updateActiveFrame, checkCase, reviewRecord, parseCSV, mapCSV, validateBackup, SCHEMA_VERSION, MAX_IMPORT_BYTES } from './domain.js';
import { emptyVisual, setVisualArray, putPointer, putTreeNode, putObject, putReference, stateChanges, visualChanges } from './visual.js';
import { renderVisualEditor, renderVisualView, renderChangeList } from './visual-ui.js';
import { lookupLesson, attemptCheckpoint } from './lessons.js';
import { normalizeContext, applyContext } from './context.js';
import { openDatabase, readRecords, writeRecords } from './persistence.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const tabs = ['Understand', 'Algorithm', 'Edge cases', 'Dry run', 'Recall'];
let records = [], activeId = '', tab = 'Understand', view = 'workspace', filter = '';
let frameDraft = [], cursor = -1, caseIndex = 0, caseLevel = 0, recallRevealed = false;
let dirty = false, saveTimer, noticeTimer, saving = Promise.resolve(), importPreview;
let renderedKey = '';
let sourceTabId = null;
let hintFocus = 'approach';
let visualDraft = emptyVisual();
const formDrafts = new Map();
const savedVersions = new Map();
const algorithmDrafts = new Map();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('code-visualizer') : null;
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const current = () => records.find(r => r.id === activeId);
const exercise = () => exercises.find(x => x.id === current()?.exerciseId);
const button = (label, action, extra = '', kind = '') => `<button type="button" class="${kind}" data-action="${action}" ${extra}>${label}</button>`;
const badge = label => `<span class="badge">${e(label)}</span>`;
const empty = (title, description) => `<div class="empty"><span aria-hidden="true">↗</span><h3>${e(title)}</h3><p>${e(description)}</p></div>`;

function notify(message, error = false) {
  const el = document.querySelector('#notice');
  el.textContent = message; el.classList.toggle('error', error); el.classList.add('show');
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

async function persist() {
  clearTimeout(saveTimer);
  let record = current();
  if (!record || !dirty) return saving;
  if (algorithmDrafts.has(record.id)) {
    const next = saveAlgorithm(record, algorithmDrafts.get(record.id));
    algorithmDrafts.delete(record.id);
    records[records.indexOf(record)] = next;
    record = next;
  }
  record.updatedAt = new Date(Math.max(Date.now(), Date.parse(record.updatedAt) + 1)).toISOString();
  const copy = clone(record);
  dirty = false;
  saving = saving.catch(() => {}).then(() => writeRecords([copy], { expectedUpdatedAt: savedVersions.get(copy.id) })).then(() => {
    savedVersions.set(copy.id, copy.updatedAt);
    channel?.postMessage(copy.id);
    const el = document.querySelector('#save-status');
    if (el) el.textContent = dirty ? 'Saving…' : 'Saved on this device';
  }).catch(error => { dirty = true; notify(`Could not save: ${error.message}. Export a backup before closing.`, true); throw error; });
  return saving;
}

function markDirty() {
  dirty = true;
  const el = document.querySelector('#save-status');
  if (el) el.textContent = 'Saving…';
  clearTimeout(saveTimer); saveTimer = setTimeout(() => persist().catch(() => {}), 450);
}

function field(label, key, placeholder = '', rows = 3) {
  return `<label class="field"><span>${label}</span><textarea data-field="${key}" rows="${rows}" placeholder="${e(placeholder)}">${e(current()[key])}</textarea></label>`;
}

function resetSession() { visualDraft = emptyVisual(); hintFocus = 'approach'; frameDraft = []; cursor = -1; caseIndex = 0; caseLevel = 0; recallRevealed = false; }

async function selectRecord(id) {
  await persist();
  activeId = id; tab = 'Understand'; view = 'workspace'; resetSession();
  try { sessionStorage.setItem('cv-active', id); } catch { /* Selection is optional state. */ }
  render();
}

async function openRecord(record) {
  await persist();
  if (!records.some(r => r.id === record.id)) { await writeRecords([record], { onlyNew: true }); records = await readRecords(); records.forEach(r => savedVersions.set(r.id,r.updatedAt)); }
  await selectRecord(record.id);
}

function render() {
  if (renderedKey) {
    const values = {};
    for (const form of root.querySelectorAll('form')) {
      values[form.id] = Object.fromEntries(new FormData(form));
      if (form.dataset.provenance) values[form.id]._provenance = form.dataset.provenance;
    }
    formDrafts.set(renderedKey, values);
  }
  const nextKey = `${activeId}:${view}:${tab}:${cursor}`;
  const r = current();
  const due = records.filter(r => r.due && new Date(r.due) <= new Date());
  root.innerHTML = `<div class="shell">
    <aside class="sidebar" aria-label="Notebook">
      <a class="brand" href="#" data-action="home"><img src="./assets/mark.svg" width="36" height="36" alt=""><span>Code Visualizer<small>A space to think.</small></span></a>
      <div class="sidebar-top">${button('<span aria-hidden="true">＋</span> Add a problem', 'add', '', 'primary wide')}</div>
      <nav class="main-nav" aria-label="Main navigation">
        ${button('<span aria-hidden="true">▦</span> Workspace', 'workspace', `aria-current="${view === 'workspace' ? 'page' : 'false'}"`)}
        ${button(`<span aria-hidden="true">↺</span> Review queue <span class="count">${due.length}</span>`, 'reviews', `aria-current="${view === 'reviews' ? 'page' : 'false'}"`)}
      </nav>
      <div class="notebook-label"><span>YOUR NOTEBOOK</span><span>${records.length}</span></div>
      <label class="search"><span class="sr-only">Find a problem</span><input id="search" type="search" placeholder="Find a problem…" value="${e(filter)}"></label>
      <div id="record-list" class="record-list">${recordList()}</div>
      <div class="sidebar-bottom">
        <div class="tools">${button('↓ Export', 'export')}${button('↑ Import', 'import')}</div>
        <div class="local-note"><span class="status-dot"></span> Local & private by default<small>No account. No AI key. Your thinking stays here.</small></div>
        ${button('Delete local data', 'delete-data', '', 'quiet danger')}
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar"><span class="breadcrumb">Your learning lab <span>/</span> ${view === 'reviews' ? 'Review queue' : 'Workspace'}</span><span id="save-status" class="save-status">${dirty ? 'Saving…' : 'Saved on this device'}</span></header>
      <main id="main" tabindex="-1">${view === 'reviews' ? reviewQueue() : r ? workspace() : welcome()}</main>
      <footer class="app-footer"><span>Build the intuition. Then write the code.</span><span>Code Visualizer · early alpha</span></footer>
    </div>
  </div>`;
  for (const [id, values] of Object.entries(formDrafts.get(nextKey) || {})) {
    const form = document.getElementById(id);
    if (!form) continue;
    for (const [name,value] of Object.entries(values)) {
      if (name === '_provenance') form.dataset.provenance = value;
      else if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    }
  }
  renderedKey = nextKey;
}

function recordList() {
  const matches = records.filter(r => r.title.toLowerCase().includes(filter.toLowerCase())).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  return matches.map(r => `<button type="button" class="record ${r.id === activeId && view === 'workspace' ? 'selected' : ''}" data-action="select" data-id="${e(r.id)}"><span class="record-symbol" aria-hidden="true">${r.exerciseId ? '◇' : '↗'}</span><span>${e(r.title)}<small>${r.exerciseId ? 'Guided exercise' : 'Your problem'} · ${e(r.status)}</small></span></button>`).join('') || '<p class="muted small">No matching problems.</p>';
}

function welcome() {
  return `<div class="welcome"><div class="eyebrow">THINK BEFORE YOU CODE</div><h1>Make room for<br><em>the “aha” moment.</em></h1><p class="lead">A little structure for the messy part of problem solving.<br>Find an approach, challenge it, and make it stick.</p>
    <div class="journey"><span>01 <b>Find an approach</b></span><i>→</i><span>02 <b>Try to break it</b></span><i>→</i><span>03 <b>Run it by hand</b></span></div>
    <div class="section-heading"><h2>Start with a small problem</h2>${badge('No code needed')}</div>
    <div class="exercise-grid">${exercises.map((x,i) => `<article class="exercise-card"><span class="card-number">0${i+1}</span><div class="eyebrow">${e(x.category)}</div><h3>${e(x.title)}</h3><p>${e(x.prompt)}</p>${button('Explore this problem <span aria-hidden="true">↗</span>', 'exercise', `data-id="${x.id}"`, 'text-button')}</article>`).join('')}</div>
    <div class="welcome-import"><div><h3>Already working on something?</h3><p>Add a LeetCode link or bring your own question.</p></div>${button('Add your problem ↗', 'add', '', 'secondary')}</div>
    <p class="muted small">Guided exercises include reference checks. Eleven supported LeetCode questions also have authored lessons; other questions use general prompts and your own specification.</p></div>`;
}

function workspace() {
  const r = current(), x = exercise();
  return `<div class="workspace-heading"><div class="eyebrow">${x ? e(x.category) : 'YOUR THINKING WORKSPACE'}</div><div class="title-row"><h1>${e(r.title)}</h1>${badge(r.status)}</div><p>${x ? e(x.prompt) : 'Start with what you know. Turn it into an approach you can explain.'}</p><div class="source-row">${r.url ? `<a href="${e(r.url)}" target="_blank" rel="noopener noreferrer">Open on LeetCode ↗</a>` : '<span>Original practice exercise</span>'}<span>Algorithm revision ${r.revision}</span></div></div>
    <div class="tabbar" role="tablist" aria-label="Learning steps">${tabs.map((t,i) => `<button id="tab-${i}" role="tab" aria-selected="${tab === t}" tabindex="${tab === t ? 0 : -1}" aria-controls="workspace-panel" data-action="tab" data-tab="${t}"><span>0${i+1}</span>${t}</button>`).join('')}</div>
    <section id="workspace-panel" role="tabpanel" aria-labelledby="tab-${tabs.indexOf(tab)}" tabindex="0">${({ Understand: understand, Algorithm: algorithm, 'Edge cases': edgeCases, 'Dry run': dryRun, Recall: recall })[tab]()}</section>`;
}

function understand() {
  const x = exercise(), r = current();
  return `<div class="workspace-columns"><div class="stack">
    ${r.description ? `<article class="panel problem-brief"><div class="eyebrow">IMPORTED QUESTION CONTEXT</div><h2>${e(r.title)}</h2><pre class="statement">${e(r.description)}</pre>${r.example ? `<details><summary>Examples</summary><pre>${e(r.example)}</pre></details>` : ''}</article>` : x ? `<article class="panel problem-brief"><div class="eyebrow">THE PROBLEM</div><h2>${e(x.title)}</h2><p>${e(x.description)}</p><div class="example-block"><span>ONE EXAMPLE</span><p>${e(x.example)}</p></div></article>` : `<article class="panel"><h2>Give the problem a shape</h2><p>The link keeps your work connected. Add the relevant problem details below so you can reason about the actual contract.</p></article>`}
    <article class="panel"><div class="context-tools">${button('Import / edit question context', 'import-context', '', 'secondary')}<p class="muted small">Preview before replacing any saved fields.</p></div><div class="section-heading"><h2>In your own words</h2>${badge('Start here')}</div>${field('What are you being asked to find?', 'restatement', 'Describe the input and the required output. What would a correct answer mean?')}${field('Constraints & assumptions', 'constraints', 'What is allowed? Input size, duplicates, empty inputs, ordering…')}${field('An example you understand', 'example', 'Choose a small input. What should the output be, and why?')}${field('Your first approach', 'approach', 'A slow, straightforward idea is a good place to start.', 4)}<div class="panel-actions"><span class="muted small">You can revise everything as you learn.</span>${button('Shape the algorithm →', 'next', 'data-tab="Algorithm"', 'primary')}</div></article>
  </div>${hintPanel()}</div>`;
}

function hintPanel() {
  const r = current(), lesson = lookupLesson(r), hints = lesson?.hints || genericHints;
  return `<aside class="panel hint-panel"><div class="eyebrow">A NUDGE, NOT A SPOILER</div><h2>A little help thinking</h2><p>${lesson ? (r.exerciseId ? 'Reveal one hint at a time. Take a moment to try it before asking for the next.' : 'Authored lesson for this question. Reveal one hint at a time.') : 'General reasoning prompts. This question has no authored hint ladder yet.'}</p><ol class="hints">${hints.map((h,i) => `<li class="${i < r.hintCount ? 'revealed' : 'locked'}"><span class="hint-number">${i+1}</span><div><strong>${hintLabels[i]}</strong>${i < r.hintCount ? `<p>${e(h)}</p>` : '<p>Reveal when you need it.</p>'}</div></li>`).join('')}</ol>${r.hintCount < hints.length ? button(`Reveal ${r.hintCount ? 'next hint' : 'first hint'} <span aria-hidden="true">↗</span>`, 'hint', '', 'secondary wide') : '<p class="muted small">You’ve revealed all five hints. Try explaining the approach without looking.</p>'}<div class="hint-footnote">Your hint history is saved with this problem.</div>${r.hintCount ? `<div class="attempt-checkpoint"><h3>Where are you stuck?</h3><div class="focus-buttons">${['approach','recursion','implementation'].map(focus => button(focus[0].toUpperCase()+focus.slice(1),'hint-focus',`data-focus="${focus}" aria-pressed="${hintFocus === focus}"`,'secondary compact')).join('')}</div><p>${e(attemptCheckpoint(r,hintFocus))}</p><small>Rule-based ${lesson ? 'authored' : 'general'} checkpoint using your saved attempt. This is a prompt, not a correctness verdict.</small></div>` : ''}</aside>`;
}

function algorithm() {
  const r = current();
  return `<div class="workspace-columns"><div class="stack"><article class="panel"><div class="eyebrow">FROM IDEA TO STEPS</div><h2>Write an approach you can follow</h2><p>Plain language or pseudocode. Describe decisions, what changes, and when to stop.</p>${field('Your algorithm', 'algorithm', '1. Handle the smallest input.\n2. Define what one step or call does.\n3. Decide how the result is formed.', 11)}${field('What stays true? / What does one call return?', 'invariant', 'State the promise your loop or recursive call must keep.')}${field('Time & space reasoning', 'complexity', 'How many states are visited? What must be stored?')}<div class="panel-actions"><span class="muted small">Autosave preserves each batch of algorithm edits as a revision.</span>${button('Challenge your approach →', 'next', 'data-tab="Edge cases"', 'primary')}</div></article>
    ${r.revisions.length ? `<article class="panel"><h2>Earlier thinking</h2><details><summary>${r.revisions.length} saved revision${r.revisions.length === 1 ? '' : 's'}</summary>${[...r.revisions].reverse().slice(0,20).map(rev => `<div class="revision"><strong>Revision ${rev.revision}</strong><pre>${e(rev.algorithm || '(No steps written yet)')}</pre></div>`).join('')}</details></article>` : ''}</div>${hintPanel()}</div>`;
}

function edgeCases() {
  const r = current(), x = exercise(), candidate = x?.cases[caseIndex % x.cases.length];
  const prompt = candidate || { category: genericCases[caseIndex % genericCases.length][0], prompt: genericCases[caseIndex % genericCases.length][1] };
  return `<div class="workspace-columns"><div class="stack"><article class="panel"><div class="eyebrow">TRY TO BREAK YOUR IDEA</div><h2>What would your algorithm miss?</h2><p>Small, deliberate inputs teach more than a pile of random tests. Name the assumption each case challenges.</p><form id="case-form"><div class="field-pair"><label class="field"><span>Case category</span><input name="category" required placeholder="For example: smallest valid input"></label><label class="field"><span>Expected result or property</span><input name="expected" required placeholder="Predict before checking"></label></div><label class="field"><span>Input ${x ? '(JSON)' : ''}</span><textarea name="input" rows="3" required placeholder="${x?.id === 'pair-sum' ? '{&quot;nums&quot;:[3,3],&quot;target&quot;:6}' : 'Write a small input…'}"></textarea></label><label class="field"><span>Why this case? What assumption does it challenge?</span><textarea name="why" rows="2" required placeholder="My approach assumes… This input tests whether…"></textarea></label><div class="panel-actions"><span class="muted small">${x ? 'Reference checks are available after you make a prediction.' : 'Learner-checked. Add constraints before judging a case valid.'}</span><button class="primary" type="submit">Save this case ＋</button></div></form></article>
    <article class="panel"><div class="section-heading"><h2>Your case collection</h2>${badge(`${r.cases.length} cases`)}</div>${r.cases.length ? r.cases.map(c => `<article class="case-card"><div class="section-heading"><strong>${e(c.category)}</strong>${badge(c.reference ? 'Reference checked' : 'Your prediction')}</div><pre>${e(c.input)}</pre><p><strong>Predicted:</strong> ${e(c.expected)}</p><p class="muted">${e(c.why)}</p>${c.reference ? `<p class="reference-result"><strong>Reference:</strong> ${e(c.reference)}</p>` : ''}<div class="inline-actions">${x ? button('Check input & reveal reference', 'check-case', `data-id="${e(c.id)}"`, 'quiet') : ''}${button('Dry-run this case →', 'run-case', `data-id="${e(c.id)}"`, 'quiet')}<small>Revision ${c.revision}${c.revision !== r.revision ? ' · earlier algorithm' : ''}</small></div></article>`).join('') : empty('A small test can change your thinking.', 'Add your own case, or use a category prompt to get started.')}</article></div>
    <aside class="stack"><article class="panel discovery"><div class="eyebrow">DISCOVER AN EDGE CASE</div><h2>${e(prompt.category)}</h2><p>${e(prompt.prompt)}</p>${candidate && caseLevel > 0 ? `<div class="example-block"><span>TRY THIS INPUT</span><pre>${e(candidate.input)}</pre><p>${e(candidate.why)}</p></div>` : ''}${candidate && caseLevel > 1 ? `<p class="reference-result"><strong>Reference outcome:</strong> ${e(candidate.expected)}</p>` : ''}<div class="stack-buttons">${candidate && caseLevel === 0 ? button('Suggest a concrete input', 'suggest-case', '', 'secondary') : ''}${candidate && caseLevel === 1 ? button('Reveal expected outcome', 'reveal-case', '', 'secondary') : ''}${candidate && caseLevel > 0 ? button('Use this input in my case', 'use-case', '', 'quiet') : ''}${button('Try another category ↻', 'next-case', '', 'text-button')}</div><p class="muted small">${candidate ? 'Authored cases respect this exercise’s constraints.' : 'Category prompts are general. A URL alone does not tell us which cases are valid.'}</p></article><article class="panel tint"><h3>Find the smallest failure</h3><p>When a case breaks your approach, remove one element or branch. Does it still fail? Keep simplifying, then record what you assumed and what changed.</p></article></aside></div>`;
}

function dryRun() {
  const r = current(), selected = cursor >= 0 ? r.snapshots[cursor] : null;
  const previous = cursor > 0 ? r.snapshots[cursor-1] : null;
  return `<div class="stack"><div class="dry-intro"><div><div class="eyebrow">SLOW DOWN THE THINKING</div><h2>Run your algorithm by hand.</h2><p>Record what changes, one decision at a time.</p></div>${badge('Manual dry run · not code execution')}</div><div class="workspace-columns"><div class="stack">${renderVisualEditor(visualDraft,selected?.visual || null)}<article class="panel"><details ${r.algorithm ? '' : 'open'}><summary>Your current algorithm · revision ${r.revision}</summary><pre>${e(r.algorithm || 'Write your algorithm in the Algorithm tab, then test its steps here.')}</pre></details><form id="snapshot-form"><div class="field-pair"><label class="field"><span>Input</span><input name="input" value="${e(selected?.input || '')}" placeholder="The input you are testing"></label><label class="field"><span>Algorithm step</span><input name="step" value="${e(selected?.step || '')}" placeholder="For example: 3 / combine child depths"></label></div><label class="field"><span>Action taken</span><input name="action" required placeholder="What happens at this step?"></label><label class="field"><span>Variables after the action (JSON object)</span><textarea class="mono" name="variables" rows="3" required>${e(JSON.stringify(selected?.variables || {}, null, 2))}</textarea></label><label class="field"><span>Why does this step follow?</span><textarea name="explanation" rows="2" required placeholder="Which condition or algorithm rule led here?"></textarea></label><p class="muted small">Adding a snapshot while viewing an earlier step appends a new attempt; it does not overwrite your history.</p><div class="panel-actions">${button('Clear draft', 'clear-draft', '', 'quiet')}<button type="submit" class="primary">Record snapshot ＋</button></div></form></article>
    <article class="panel"><div class="section-heading"><h2>Your timeline</h2><div class="inline-actions">${button('← Previous', 'prev-snapshot', `${cursor <= 0 ? 'disabled' : ''} aria-label="Previous snapshot"`, 'secondary compact')}${button('Next →', 'next-snapshot', `${cursor >= r.snapshots.length - 1 ? 'disabled' : ''} aria-label="Next snapshot"`, 'secondary compact')}</div></div>${r.snapshots.length ? `<div class="table-scroll"><table><caption class="sr-only">Learner-authored dry-run snapshots</caption><thead><tr><th>Step</th><th>Action</th><th>State</th><th>Revision</th></tr></thead><tbody>${r.snapshots.map((s,i) => `<tr class="${i === cursor ? 'selected-row' : ''}"><td>${button(String(i+1).padStart(2,'0'), 'snapshot', `data-index="${i}" aria-label="Open snapshot ${i+1}"`, 'step-button')}</td><td>${e(s.action)}</td><td><code>${e(JSON.stringify(s.variables))}</code></td><td>${s.revision}${s.revision !== r.revision ? ' · earlier' : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('Your reasoning, step by step.', 'Record your first snapshot to begin a replayable dry run.')}</article>
    ${exercise() ? `<article class="panel"><details><summary>Reveal an authored reference dry run</summary><p class="muted small">A worked example, not a trace of your algorithm. ${e(exercise().example)}</p>${exercise().reference.map(row => `<div class="reference-step"><span>${row[0]}</span><div><strong>${e(row[1])}</strong><code>${e(row[2])}</code><p>${e(row[3])}</p></div></div>`).join('')}</details></article>` : ''}</div>
    <aside class="stack"><article class="panel"><div class="eyebrow">CALLS & RETURNS</div><h2>Build the call stack</h2><p>Push a child call. Return a value to its suspended caller. These actions become part of your next snapshot.</p><div id="frame-list">${renderFrames(frameDraft)}${renderCallTree(frameDraft)}</div><label class="field"><span>Call label</span><input id="frame-label" placeholder="depth(left)"></label><label class="field"><span>Call locals (JSON object)</span><input id="frame-locals" value="{}"></label>${button('Enter call ↓', 'enter-frame', '', 'secondary wide')}${button('Update active call locals', 'update-frame', '', 'quiet')}<div class="return-controls"><label class="field"><span>Value returned by the active call</span><input id="return-value" placeholder="1"></label>${button('Return to caller ↑', 'return-frame', '', 'secondary wide')}</div></article>
    ${selected ? `<article class="panel tint"><div class="eyebrow">SNAPSHOT ${cursor+1} · REVISION ${selected.revision}</div><h3>${e(selected.action)}</h3><p>${e(selected.explanation)}</p>${selected.revision !== r.revision ? '<p class="warning">This snapshot belongs to an earlier algorithm revision.</p>' : ''}${selected.visual ? renderVisualView(selected.visual,previous?.visual || null,false) : renderArray(selected.diagram)}${renderChangeList([...stateChanges(previous?.variables || {},selected.variables),...visualChanges(previous?.visual,selected.visual),...stateChanges(Object.fromEntries((previous?.frames || []).map(f => [`Call ${f.label} #${f.id.slice(0,4)}`,{ status:f.status,locals:f.locals,returned:f.returned }])),Object.fromEntries(selected.frames.map(f => [`Call ${f.label} #${f.id.slice(0,4)}`,{ status:f.status,locals:f.locals,returned:f.returned }])))] )}</article>` : ''}</aside></div></div>`;
}

function restoreSnapshotDraft() {
  const snapshot = current()?.snapshots[cursor];
  frameDraft = clone(snapshot?.frames || []);
  visualDraft = snapshot?.visual ? clone(snapshot.visual) : emptyVisual();
  if (!snapshot?.visual && snapshot?.diagram) {
    try { visualDraft = setVisualArray(visualDraft,JSON.parse(snapshot.diagram)); } catch { /* Keep an empty draft for an unsupported legacy sketch. */ }
  }
}

function renderFrames(frames) {
  return frames.length ? `<ol class="frame-stack">${frames.map((f,i) => `<li class="frame ${e(f.status)}"><div><span class="mono">#${i+1} ${e(f.label)}</span>${badge(f.status)}</div><code>${e(JSON.stringify(f.locals))}</code>${f.status === 'returned' ? `<p>Returned ${e(f.returned)} ${f.parentId ? `→ ${e(frames.find(p => p.id === f.parentId)?.label)}` : '→ final result'}</p>` : f.status === 'suspended' ? '<small>Waiting for a child to return.</small>' : '<small>Active call</small>'}</li>`).join('')}</ol>` : '<p class="frame-empty">No calls yet. Start with the root call.</p>';
}

function renderCallTree(frames, parentId = null) {
  const children = frames.filter(f => f.parentId === parentId);
  if (!children.length) return '';
  return `<ul class="call-tree">${children.map(f => `<li><span>${e(f.label)} <small>${f.status === 'returned' ? `→ ${e(f.returned)}` : e(f.status)}</small></span>${renderCallTree(frames,f.id)}</li>`).join('')}</ul>`;
}

function renderArray(value) {
  if (!value) return '';
  try {
    const items = JSON.parse(value);
    if (!Array.isArray(items)) return '';
    return `<div class="array-view" aria-label="Array sketch">${items.slice(0,30).map((v,i) => `<div><span>${e(typeof v === 'object' ? JSON.stringify(v) : v)}</span><small>${i}</small></div>`).join('')}${items.length > 30 ? '<span>…</span>' : ''}</div>`;
  } catch { return '<p class="muted">Array sketch could not be read.</p>'; }
}

function recall() {
  const r = current(), x = lookupLesson(r);
  return `<div class="workspace-columns"><div class="stack"><article class="panel"><div class="eyebrow">MAKE THE REASONING STICK</div><h2>Leave a cue for your future self.</h2><p>Remember why the approach works, not just what the code looked like.</p>${field('Your memory cue', 'cue', 'A short question that brings back the key idea.')}${field('The mistake that taught you something', 'mistake', 'What I assumed → why it failed → what I changed.')}<div class="panel-actions"><span class="muted small">Fixed prototype schedule: 1, 1, 3, or 7 days.</span>${button('Schedule a review for tomorrow', 'schedule', '', 'primary')}</div></article>
    <article class="panel recall-card"><div class="eyebrow">A QUICK RECONSTRUCTION</div><h2>Can you recover the approach?</h2><p>${e(r.cue || 'Explain your approach, dry-run one transition, and invent a fresh edge case. Why would that case catch a mistake?')}</p><label class="field"><span>Try from memory before revealing</span><textarea id="recall-attempt" rows="5" placeholder="Reconstruct your algorithm and explain a tricky step…"></textarea></label>${!recallRevealed ? button('Reveal my saved reasoning', 'reveal-recall', '', 'secondary') : `<div class="recall-answer"><h3>Your saved approach</h3><pre>${e(r.algorithm || r.approach || 'No approach saved yet.')}</pre><p><strong>Invariant:</strong> ${e(r.invariant || 'Not recorded yet.')}</p><p><strong>Mistake:</strong> ${e(r.mistake || 'Not recorded yet.')}</p></div><p>How much could you explain independently?</p><div class="rating-buttons">${['again','hard','good','easy'].map((rating,i) => button(`${rating[0].toUpperCase()+rating.slice(1)}<small>${[1,1,3,7][i]} day${i > 1 ? 's' : ''}</small>`, 'rate', `data-rating="${rating}"`, 'secondary')).join('')}</div>`}</article></div>
    <aside class="stack">${x ? `<article class="panel"><details><summary>Reveal pattern & a useful comparison</summary><h3>${e(x.pattern)}</h3><p>${e(x.invariant)}</p><div class="rule"></div><p>${e(x.contrast)}</p></details><details class="solution-details"><summary>Reveal full approach explanation</summary><p>${e(x.solution)}</p></details></article>` : ''}<article class="panel tint"><h3>What counts as remembering?</h3><p>Can you explain the invariant, reconstruct a step, and apply it to a new input? Recognizing an answer after reveal is different from recalling it.</p><p class="muted small">Review ratings are self-assessments. They do not establish mastery.</p></article><article class="panel"><h3>Review history</h3><p>${r.due ? `Next review: ${e(new Date(r.due).toLocaleDateString())}` : 'Not scheduled yet.'}</p>${r.reviews.slice(-5).reverse().map(rev => `<p class="small">${e(new Date(rev.at).toLocaleDateString())} · ${e(rev.rating)}${rev.assisted ? ' · revealed without an attempt' : ''}</p>`).join('')}</article></aside></div>`;
}

function reviewQueue() {
  const scheduled = records.filter(r => r.due).sort((a,b) => a.due.localeCompare(b.due));
  return `<div class="welcome review-page"><div class="eyebrow">REVISIT, DON'T JUST REREAD</div><h1>A little recall.<br><em>A stronger connection.</em></h1><p class="lead">Reconstruct the approach before you reveal it.<br>Then try a new case that challenges the same assumption.</p><div class="section-heading"><h2>Your upcoming reviews</h2>${badge(`${scheduled.length} scheduled`)}</div>${scheduled.length ? scheduled.map(r => `<article class="review-row"><div><h3>${e(r.title)}</h3><p>${new Date(r.due) <= new Date() ? 'Due now' : `Due ${e(new Date(r.due).toLocaleDateString())}`} · ${r.reviews.length} past reviews</p></div>${button('Try from memory →', 'review-record', `data-id="${e(r.id)}"`, 'secondary')}</article>`).join('') : empty('Make a little room for review.', 'Open a problem’s Recall tab and schedule your first review.')}</div>`;
}

function showModal(html) { modal.innerHTML = html; modal.showModal(); }
function modalHeading(title) { return `<div class="section-heading"><h2 id="modal-title">${title}</h2>${button('×', 'close-modal', 'aria-label="Close dialog"', 'icon-button')}</div>`; }

function caseIdentity(input) {
  const ordered = value => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,ordered(value[key])]));
    return value;
  };
  try { return `json:${JSON.stringify(ordered(JSON.parse(input)))}`; }
  catch { return `text:${input.trim()}`; }
}

function contextDialog(preview, message = '') {
  const r = current();
  showModal(`${modalHeading('Review question context')}<p>${e(message || 'Edit the captured fields, then choose which ones to apply. Your approach and algorithm are preserved.')}</p>${preview.truncated ? '<p class="warning">Capture was limited to 30,000 characters. Check for missing details.</p>' : ''}<form id="context-form"><input type="hidden" name="url" value="${e(r.url)}">${[['title','Title',r.title],['description','Problem description',r.description],['examples','Examples',r.example],['constraints','Constraints',r.constraints]].map(([key,label,existing]) => `<label class="check-field"><input type="checkbox" name="use-${key}" ${!existing ? 'checked' : ''}>Replace ${label.toLowerCase()}${existing ? ' (currently saved)' : ''}</label><label class="field"><span>${label}</span><textarea name="${key}" rows="${key === 'description' ? 7 : 3}">${e(preview[key] || '')}</textarea></label>`).join('')}<button type="submit" class="primary wide">Apply selected context</button></form>`);
}

async function importQuestionContext() {
  await persist();
  const r = current();
  const manual = { title:r.title,description:r.description || '',examples:r.example,constraints:r.constraints };
  if (!globalThis.chrome?.runtime?.id || sourceTabId === null || !r.url) { contextDialog(manual,'Paste the description, examples, and constraints, then select the fields to apply. Extension capture is available after clicking Study this problem on a LeetCode description page.'); return; }
  notify('Reading this question’s rendered description…');
  try {
    const result = await chrome.runtime.sendMessage({ type:'capture-context',tabId:sourceTabId,url:r.url });
    if (!result?.ok) throw new Error(result?.error || 'Could not read context.');
    if (current()?.id !== r.id) { notify('You switched questions during capture. Import context again for the current question.'); return; }
    if (result.context.url !== r.url) throw new Error('The captured description does not match this question.');
    contextDialog(result.context);
  } catch (error) {
    if (current()?.id !== r.id) { notify('The question changed during capture. Import context again for the current question.'); return; }
    contextDialog(manual,`${error.message} You can paste the context below. Click the extension toolbar action again if its temporary page access expired.`);
  }
}

function addDialog() {
  showModal(`${modalHeading('Bring your own problem')}<p>Capture a LeetCode question, or create a blank workspace.</p><form id="add-form"><label class="field"><span>LeetCode URL (optional)</span><input name="url" type="url" placeholder="https://leetcode.com/problems/two-sum/"></label><label class="field"><span>Title</span><input name="title" maxlength="200" placeholder="Name your problem (optional for a link)"></label><p class="muted small">Links are deduplicated. Existing notes reopen automatically. Supported questions receive authored hints. Other questions receive general prompts.</p><button class="primary wide" type="submit">Open workspace ↗</button></form>`);
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify({ version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), records }, null, 2)], { type:'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `code-visualizer-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function importDialog() {
  showModal(`${modalHeading('Bring your notebook')}<p>Import a JSON backup or a CSV export of a Notion tracker.</p><label class="field"><span>Choose a file (maximum 5 MB)</span><input id="import-file" type="file" accept=".json,.csv,application/json,text/csv"></label><p class="muted small">Existing questions are preserved. Imports add new records only; they never silently replace your work. Browser and extension notebooks are separate—use JSON to transfer them.</p><div id="import-preview"></div>`);
}

function csvMapping(csv) {
  const fields = ['url','title','topic','status','notes'];
  const choices = name => `<option value="">Skip</option>${csv.headers.map((h,i) => `<option value="${i}" ${new RegExp(name === 'url' ? 'url|link' : name === 'title' ? 'title|name|problem' : name, 'i').test(h) ? 'selected' : ''}>${e(h)}</option>`).join('')}`;
  return `<h3>Map your columns</h3><p class="muted small">A LeetCode URL is required for stable identity. Rows without one will be reported and skipped.</p><form id="csv-map">${fields.map(name => `<label class="field"><span>${name[0].toUpperCase()+name.slice(1)}</span><select name="${name}">${choices(name)}</select></label>`).join('')}<button type="submit" class="secondary">Preview records</button></form><div id="mapped-preview"></div>`;
}

function previewImport(items, errors = []) {
  const newItems = items.filter(r => !records.some(old => old.id === r.id));
  importPreview = newItems;
  return `<div class="import-result"><h3>${newItems.length} new problems</h3><p>${items.length - newItems.length} already in your notebook; preserved.</p><ul>${newItems.slice(0,8).map(r => `<li>${e(r.title)}</li>`).join('')}</ul>${errors.length ? `<details open><summary>${errors.length} rows skipped</summary>${errors.slice(0,20).map(err => `<p class="small">Row ${err.row}: ${e(err.message)}</p>`).join('')}</details>` : ''}${button('Add new problems', 'confirm-import', newItems.length ? '' : 'disabled', 'primary')}</div>`;
}

root.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'search') { filter = el.value; document.querySelector('#record-list').innerHTML = recordList(); return; }
  if (el.dataset.field && current()) {
    if (el.dataset.field === 'algorithm') algorithmDrafts.set(current().id, el.value);
    else current()[el.dataset.field] = el.value;
    markDirty();
  }
});

// Flush an edit batch on blur as well as during autosave.
root.addEventListener('focusout', event => {
  if (event.target.dataset.field === 'algorithm' && current()) {
    persist().catch(() => {});
  }
});

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  event.preventDefault();
  try {
    const action = el.dataset.action;
    if (action === 'home' || action === 'workspace') { await persist(); view = 'workspace'; if (action === 'home') activeId = ''; render(); }
    if (action === 'add') addDialog();
    if (action === 'import-context') await importQuestionContext();
    if (action === 'close-modal') modal.close();
    if (action === 'exercise') await openRecord(makeRecord({ exerciseId: el.dataset.id }));
    if (action === 'select') await selectRecord(el.dataset.id);
    if (action === 'reviews') { await persist(); view = 'reviews'; render(); }
    if (action === 'tab' || action === 'next') {
      await persist(); tab = el.dataset.tab; cursor = current().snapshots.length - 1; restoreSnapshotDraft(); render();
      document.querySelector(`#tab-${tabs.indexOf(tab)}`).focus();
    }
    if (action === 'hint-focus') { if (['approach','recursion','implementation'].includes(el.dataset.focus)) hintFocus = el.dataset.focus; render(); }
    if (action === 'hint') { current().hintHistory.push({ focus:hintFocus,revision:current().revision,level: current().hintCount + 1, at: new Date().toISOString() }); current().hintCount = Math.min(5, current().hintCount + 1); markDirty(); await persist(); render(); }
    if (action === 'suggest-case') { caseLevel = 1; render(); }
    if (action === 'reveal-case') { caseLevel = 2; render(); }
    if (action === 'next-case') { caseIndex++; caseLevel = 0; render(); }
    if (action === 'use-case') {
      const c = exercise().cases[caseIndex % exercise().cases.length], form = document.querySelector('#case-form');
      form.elements.category.value = c.category; form.elements.input.value = c.input; form.elements.why.value = c.why;
      if (caseLevel > 1) form.elements.expected.value = c.expected;
      form.elements.expected.focus(); form.dataset.provenance = 'authored-suggestion';
    }
    if (action === 'check-case') { const c = current().cases.find(c => c.id === el.dataset.id); c.reference = checkCase(current().exerciseId, c.input); markDirty(); await persist(); render(); }
    if (action === 'run-case') {
      const c = current().cases.find(c => c.id === el.dataset.id);
      await persist(); tab = 'Dry run'; cursor = -1; frameDraft = []; visualDraft = emptyVisual(); render(); document.querySelector('#snapshot-form').elements.input.value = c.input;
    }
    if (action === 'visual-mode') { visualDraft = emptyVisual(el.dataset.kind); render(); }
    if (action === 'visual-set-array') { visualDraft = setVisualArray(visualDraft,JSON.parse(document.querySelector('#array-values').value)); render(); }
    if (action === 'visual-select-cell') { const index = Number(el.dataset.index); document.querySelector('#array-cell-index').value = index; document.querySelector('#array-cell-value').value = JSON.stringify(visualDraft.values[index]); }
    if (action === 'visual-edit-cell') {
      const index = Number(document.querySelector('#array-cell-index').value), values = [...visualDraft.values];
      if (!Number.isInteger(index) || index < 0 || index >= values.length) throw new Error('Choose an existing array cell index.');
      values[index] = JSON.parse(document.querySelector('#array-cell-value').value); visualDraft = setVisualArray(visualDraft,values); render();
    }
    if (action === 'visual-pointer') { visualDraft = putPointer(visualDraft,document.querySelector('#pointer-name').value,Number(document.querySelector('#pointer-index').value)); render(); }
    if (action === 'visual-remove-pointer') { visualDraft = { ...visualDraft,pointers:visualDraft.pointers.filter(p => p.name !== el.dataset.name) }; render(); }
    if (action === 'visual-node') { visualDraft = putTreeNode(visualDraft,{ id:document.querySelector('#tree-id').value,value:JSON.parse(document.querySelector('#tree-value').value),parentId:document.querySelector('#tree-parent').value,side:document.querySelector('#tree-side').value }); render(); }
    if (action === 'visual-select-node') { visualDraft = { ...visualDraft,activeNodeId:el.dataset.id }; render(); const node = visualDraft.nodes.find(n => n.id === el.dataset.id); document.querySelector('#tree-id').value = node.id; document.querySelector('#tree-value').value = JSON.stringify(node.value); }
    if (action === 'visual-object') { visualDraft = putObject(visualDraft,document.querySelector('#object-id').value,JSON.parse(document.querySelector('#object-values').value)); render(); }
    if (action === 'visual-reference') { visualDraft = putReference(visualDraft,document.querySelector('#reference-name').value,document.querySelector('#reference-target').value); render(); }
    if (action === 'enter-frame') { frameDraft = enterFrame(frameDraft, document.querySelector('#frame-label').value, document.querySelector('#frame-locals').value); document.querySelector('#frame-list').innerHTML = renderFrames(frameDraft) + renderCallTree(frameDraft); }
    if (action === 'update-frame') { frameDraft = updateActiveFrame(frameDraft,document.querySelector('#frame-locals').value); document.querySelector('#frame-list').innerHTML = renderFrames(frameDraft) + renderCallTree(frameDraft); }
    if (action === 'return-frame') { frameDraft = returnFrame(frameDraft, document.querySelector('#return-value').value); document.querySelector('#frame-list').innerHTML = renderFrames(frameDraft) + renderCallTree(frameDraft); }
    if (['snapshot','prev-snapshot','next-snapshot'].includes(action)) {
      cursor = action === 'snapshot' ? Number(el.dataset.index) : cursor + (action === 'prev-snapshot' ? -1 : 1);
      cursor = Math.max(0, Math.min(cursor, current().snapshots.length-1)); restoreSnapshotDraft(); render();
    }
    if (action === 'clear-draft') { cursor = -1; frameDraft = []; visualDraft = emptyVisual(); formDrafts.delete(`${activeId}:${view}:${tab}:-1`); renderedKey = ''; render(); }
    if (action === 'schedule') { current().due = new Date(Date.now()+86_400_000).toISOString(); current().status = 'Practiced'; markDirty(); await persist(); notify('Review scheduled for tomorrow.'); render(); }
    if (action === 'review-record') { await selectRecord(el.dataset.id); tab = 'Recall'; render(); }
    if (action === 'reveal-recall') {
      const attempt = document.querySelector('#recall-attempt').value;
      recallRevealed = true; render(); document.querySelector('#recall-attempt').value = attempt;
    }
    if (action === 'rate') {
      const attempt = document.querySelector('#recall-attempt').value.trim();
      const old = current(), next = reviewRecord(old, el.dataset.rating);
      next.reviews.at(-1).assisted = !attempt; next.reviews.at(-1).attempt = attempt;
      records[records.indexOf(old)] = next; markDirty(); await persist(); recallRevealed = false; notify('Review saved. Your next review is scheduled.'); render();
    }
    if (action === 'export') {
      try { await persist(); } catch { /* Export in-memory edits even if storage rejects a conflict. */ }
      downloadBackup(); notify('Backup exported, including current in-memory work.');
    }
    if (action === 'import') { await persist(); importDialog(); }
    if (action === 'confirm-import') {
      await writeRecords(importPreview, { onlyNew: true }); records = await readRecords(); records.forEach(r => savedVersions.set(r.id,r.updatedAt)); importPreview = null; modal.close(); render(); notify('New problems added. Existing work was preserved.');
    }
    if (action === 'delete-data') showModal(`${modalHeading('Delete this device’s notebook?')}<p>This removes notes, cases, dry runs, and review history from this browser only. Export a backup first if you want to keep them.</p><div class="inline-actions">${button('Export a backup', 'export', '', 'secondary')}${button('Delete notebook', 'confirm-delete', '', 'danger-button')}</div>`);
    if (action === 'confirm-delete') { clearTimeout(saveTimer); await persist(); await writeRecords([], { clear:true }); records = []; activeId = ''; dirty = false; algorithmDrafts.clear(); formDrafts.clear(); savedVersions.clear(); renderedKey = ''; modal.close(); render(); notify('This browser’s notebook was deleted.'); }
  } catch (error) { notify(error instanceof SyntaxError ? 'Please check your JSON syntax. Use double quotes for keys.' : error.message, true); }
});

document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'context-form') {
      const old = current(), fields = ['title','description','examples','constraints'].filter(key => Object.hasOwn(data,`use-${key}`));
      if (!fields.length) throw new Error('Select at least one field to apply.');
      records[records.indexOf(old)] = applyContext(old,data,fields); markDirty(); await persist(); modal.close(); render(); notify('Selected question context saved.');
    }
    if (form.id === 'add-form') { if (!data.url.trim() && !data.title.trim()) throw new Error('Enter a problem title or a LeetCode link.'); await openRecord(makeRecord({ url:data.url.trim(), title:data.title.trim() })); modal.close(); }
    if (form.id === 'case-form') {
      if (current().cases.some(c => caseIdentity(c.input) === caseIdentity(data.input))) throw new Error('That input is already in your collection.');
      current().cases.push({ id:uid(), ...data, revision:current().revision, provenance:form.dataset.provenance || 'learner', at:new Date().toISOString() });
      markDirty(); await persist(); form.reset(); delete form.dataset.provenance; render(); notify('Case saved. Try your prediction before checking the reference.');
    }
    if (form.id === 'snapshot-form') {
      if (data.diagram && !Array.isArray(JSON.parse(data.diagram))) throw new Error('An array sketch must be a JSON array.');
      const old = current(), next = addSnapshot(old, { ...data, frames:frameDraft, visual:visualDraft });
      records[records.indexOf(old)] = next; cursor = next.snapshots.length-1; markDirty(); await persist(); render(); notify('Snapshot recorded.');
    }
    if (form.id === 'csv-map') {
      const result = mapCSV(form._csv, data); document.querySelector('#mapped-preview').innerHTML = previewImport(result.records, result.errors);
    }
  } catch (error) { notify(error instanceof SyntaxError ? 'Check the JSON syntax before continuing.' : error.message, true); }
});

modal.addEventListener('change', async event => {
  if (event.target.id !== 'import-file') return;
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 5 MB.');
    const source = await file.text(), preview = document.querySelector('#import-preview');
    importPreview = null;
    if (file.name.toLowerCase().endsWith('.csv')) {
      const csv = parseCSV(source); preview.innerHTML = csvMapping(csv); document.querySelector('#csv-map')._csv = csv;
    } else preview.innerHTML = previewImport(validateBackup(JSON.parse(source)));
  } catch (error) { importPreview = null; document.querySelector('#import-preview').textContent = error.message; }
});

root.addEventListener('keydown', event => {
  if (event.target.closest?.('[data-action="visual-select-node"]') && ['Enter',' '].includes(event.key)) { event.preventDefault(); event.target.dispatchEvent(new Event('click',{ bubbles:true })); return; }
  if (event.target.getAttribute('role') !== 'tab' || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault(); const index = tabs.indexOf(tab);
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  document.querySelector(`#tab-${target}`).click();
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist().catch(() => {}); });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
channel?.addEventListener('message', () => notify('This notebook changed in another tab. Reload before editing the same problem.'));

// A question captured by the extension is resolved only on an explicit open action.
async function captureFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const url = params.get('problem');
  const sourceId = params.get('tab');
  if (sourceId !== null && /^\d+$/.test(sourceId)) { sourceTabId = Number(sourceId); try { sessionStorage.setItem('cv-source-tab',sourceId); } catch {} }
  if (url) {
    canonicalLeetCode(url);
    await openRecord(makeRecord({ url }));
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (params.has('unsupported')) notify('Open a LeetCode problem and click the extension again, or add a link manually.', true);
}

async function init() {
  try {
    await openDatabase(); records = await readRecords(); records.forEach(r => savedVersions.set(r.id,r.updatedAt));
    try { activeId = sessionStorage.getItem('cv-active') || ''; const savedTab = sessionStorage.getItem('cv-source-tab'); if (/^\d+$/.test(savedTab || '')) sourceTabId = Number(savedTab); } catch { /* Optional selection. */ }
    if (!current()) activeId = '';
    await captureFromHash(); render();
    window.addEventListener('hashchange', () => captureFromHash().catch(error => notify(error.message, true)));
  } catch (error) {
    root.innerHTML = `<main class="loading"><h1>We couldn’t open your notebook.</h1><p>${e(error.message)}</p><p>Enable browser storage and reload. No existing data has been deleted.</p></main>`;
  }
}
init();
