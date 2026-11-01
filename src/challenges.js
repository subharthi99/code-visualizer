import { exercises } from './content.js';
import { canonicalLeetCode, checkCase, clone } from './domain.js';

const challengeCatalog = {
  'valid-parentheses': {
    contract:'JSON string of 1–200 bracket characters: ()[]{}. Bounded local practice checks.',
    cases:[
      ['Nesting order','Can equal counts hide the wrong closing order?','"([)]"','false','Counts alone cannot establish matching nesting.'],
      ['Unmatched opening','Does processing the final character guarantee completion?','"("','false','The stack must be empty after the scan.'],
      ['Early closing','Can a closer arrive with nothing to match?','")("','false','A valid final count cannot repair an invalid prefix.'],
      ['Nested and adjacent','Can your state handle both forms together?','"([]){}"','true','Each closed group must leave the correct earlier state.']
    ]
  },
  'binary-search': {
    contract:'JSON {"nums":[…],"target":…}: 1–200 strictly increasing integers; values and target within ±9999. Return index or -1. Bounded local practice checks.',
    cases:[
      ['Single element','Does your loop inspect a one-element interval?','{"nums":[3],"target":3}','0','A strict left < right guard can skip the last candidate.'],
      ['Missing between values','Can your bounds shrink past each other?','{"nums":[1,3],"target":2}','-1','The interval must become empty when no target exists.'],
      ['Right boundary','Does the last index remain reachable?','{"nums":[-2,0,5],"target":5}','2','An exclusive endpoint used as inclusive can skip or overrun a boundary.'],
      ['Index zero','Do you distinguish zero from not-found?','{"nums":[0,8],"target":0}','0','Index zero is a valid result.']
    ]
  },
  'longest-substring-without-repeating-characters': {
    contract:'JSON string of 0–200 printable ASCII characters, including spaces. Return the longest duplicate-free contiguous length. Bounded local practice checks.',
    cases:[
      ['Stale repeat','Can a last-seen position lie before the current window?','"abba"','2','The left boundary must never move backwards.'],
      ['Repeated run','Is removing one character always enough?','"aaaa"','1','Restore window validity before measuring it.'],
      ['Empty input','What is the length when nothing is scanned?','""','0','Initialization must cover the empty string.'],
      ['Space is a character','Are spaces part of the window?','"a a"','2','Do not silently strip valid input characters.']
    ]
  }
};
function challengeKey(record) {
  try { const slug = canonicalLeetCode(record?.url).slug; return Object.hasOwn(challengeCatalog,slug) ? slug : null; } catch { return null; }
}
export function caseSupport(record) {
  if (record?.exerciseId) return exercises.find(x => x.id === record.exerciseId)?.constraints || null;
  return challengeCatalog[challengeKey(record)]?.contract || null;
}
export function challengeCases(record) {
  if (record?.exerciseId) return exercises.find(x => x.id === record.exerciseId)?.cases || [];
  return (challengeCatalog[challengeKey(record)]?.cases || []).map(([category,prompt,input,expected,why]) => ({ category,prompt,input,expected,why }));
}
export function referenceFor(record, input) {
  if (record?.exerciseId) return checkCase(record.exerciseId,input);
  const key = challengeKey(record);
  if (!key) throw new Error('No supported local contract. This outcome is learner-checked.');
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('Use JSON matching the displayed local practice contract.'); }
  if (key === 'valid-parentheses') {
    if (typeof value !== 'string' || !/^[()[\]{}]{1,200}$/.test(value)) throw new Error('Use a JSON string of 1–200 bracket characters only.');
    const stack = [], pairs = { ')':'(',']':'[','}':'{' };
    for (const c of value) { if ('([{'.includes(c)) stack.push(c); else if (stack.pop() !== pairs[c]) return 'false'; }
    return String(stack.length === 0);
  }
  if (key === 'binary-search') {
    const { nums,target } = value || {};
    if (!Array.isArray(nums) || nums.length < 1 || nums.length > 200 || !nums.every((n,i) => Number.isInteger(n) && Math.abs(n) <= 9999 && (!i || n > nums[i-1])) || !Number.isInteger(target) || Math.abs(target) > 9999) throw new Error('Use 1–200 strictly increasing distinct integers and an integer target within ±9999.');
    // Independent linear oracle, not the learner's proposed binary search.
    return String(nums.indexOf(target));
  }
  if (typeof value !== 'string' || value.length > 200 || /[^\x20-\x7e]/.test(value)) throw new Error('Use a JSON string of 0–200 printable ASCII characters.');
  // Small-input exhaustive oracle, deliberately different from a sliding window.
  let best = 0;
  for (let start = 0; start < value.length; start++) {
    const seen = new Set();
    for (let end = start; end < value.length && !seen.has(value[end]); end++) { seen.add(value[end]); best = Math.max(best,seen.size); }
  }
  return String(best);
}
export function saveCounterexample(record, caseId, details) {
  const next = clone(record), saved = next.cases.find(c => c.id === caseId);
  if (!saved) throw new Error('Choose an existing case.');
  const keys = ['input','actual','expected','lesson'];
  if (!details || !keys.every(key => typeof details[key] === 'string' && details[key].trim() && details[key].length <= 10000)) throw new Error('Provide input, observed result, expected result, and explain the lesson (at most 10,000 characters each).');
  if (details.actual.trim() === details.expected.trim()) throw new Error('A failure needs different observed and expected outcomes.');
  if (caseSupport(record)) {
    const reference = referenceFor(record,details.input);
    if (['valid-parentheses','binary-search','longest-substring-without-repeating-characters'].includes(challengeKey(record)) && reference !== details.expected.trim()) throw new Error('Expected result does not match this input’s local reference.');
  }
  saved.reductions = [...(saved.reductions || []),{ ...Object.fromEntries(keys.map(key => [key,details[key].trim()])),at:new Date().toISOString(),revision:record.revision }];
  return next;
}
