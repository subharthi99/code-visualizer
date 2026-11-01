import { clone } from './domain.js';

export function recallPrompts(record) {
  const hasFailure = record.mistake?.trim() || record.cases.some(c => c.reductions?.length);
  return [
    'Reconstruct the approach and its invariant without opening the saved answer.',
    'Dry-run one transition: what changes, and which call or loop step resumes next?',
    hasFailure ? 'Recall your earlier mistake or failed assumption. Invent a fresh edge case that would expose it and predict the result.' : 'Invent a fresh edge case, predict its result, and explain which assumption it challenges.'
  ];
}
export function recallInterval(record, rating, assisted = false) {
  if (!['again','hard','good','easy'].includes(rating)) throw new Error('Unknown review rating.');
  if (assisted || rating === 'again') return 1;
  const last = record.reviews.at(-1);
  const prior = last && !last.assisted && ['good','easy','hard'].includes(last.rating) ? (Number.isInteger(last.intervalDays) && last.intervalDays >= 1 && last.intervalDays <= 90 ? last.intervalDays : { good:3,easy:7,hard:1 }[last.rating]) : 1;
  if (rating === 'hard') return Math.min(7,Math.max(1,Math.floor(prior / 2)));
  return rating === 'good' ? Math.min(60,Math.max(3,prior * 2)) : Math.min(90,Math.max(7,prior * 3));
}
export function recordRecall(record, rating, evidence, now = new Date()) {
  const next = clone(record);
  const fields = Object.fromEntries(['attempt','transition','edgeCase'].map(key => [key,typeof evidence?.[key] === 'string' ? evidence[key].trim().slice(0,10000) : '']));
  const assisted = Boolean(evidence?.usedHelp) || Object.values(fields).some(value => !value);
  const intervalDays = recallInterval(record,rating,assisted);
  const due = new Date(now); due.setDate(due.getDate() + intervalDays);
  next.reviews.push({ ...fields,at:now.toISOString(),rating,assisted,intervalDays,policy:'recall-v2' });
  next.due = due.toISOString(); next.status = 'Practiced';
  return next;
}
export function reviewOverview(records, now = new Date()) {
  const scheduled = records.filter(r => r.due).sort((a,b) => Date.parse(a.due) - Date.parse(b.due));
  const history = records.flatMap(r => r.reviews);
  return {
    due:scheduled.filter(r => Date.parse(r.due) <= now.getTime()),upcoming:scheduled.filter(r => Date.parse(r.due) > now.getTime()),unscheduled:records.filter(r => !r.due),
    attempts:history.length,independent:history.filter(r => r.assisted === false && ['good','easy'].includes(r.rating)).length,
    needsWork:history.filter(r => r.assisted || ['again','hard'].includes(r.rating)).length
  };
}
