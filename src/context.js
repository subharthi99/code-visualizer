import { canonicalLeetCode } from './domain.js';

export function normalizeContext(capture) {
  const source = canonicalLeetCode(capture?.url);
  const path = new URL(capture.url).pathname;
  if (!/^\/problems\/[a-z0-9-]+\/(?:description\/?)?$/.test(path + (path.endsWith('/') ? '' : '/'))) throw new Error('Open the problem description before importing context.');
  const body = typeof capture.text === 'string' ? capture.text.replace(/\r\n/g,'\n').trim().slice(0,30_000) : '';
  if (!body) throw new Error('No visible problem description was found. Open Description or paste the context manually.');
  const exampleAt = body.search(/(?:^|\n)\s*Example\s*\d*\s*:/i);
  const constraintAt = body.search(/(?:^|\n)\s*Constraints\s*:/i);
  const endStatement = Math.min(...[exampleAt,constraintAt,body.length].filter(n => n >= 0));
  return {
    url:source.url,
    title:(typeof capture.title === 'string' ? capture.title.replace(/^\d+\.\s*/,'').trim().slice(0,200) : '') || source.title,
    description:body.slice(0,endStatement).trim(),
    examples:exampleAt >= 0 ? body.slice(exampleAt,constraintAt >= exampleAt ? constraintAt : body.length).trim() : '',
    constraints:constraintAt >= 0 ? body.slice(constraintAt).replace(/^\s*Constraints\s*:\s*/i,'').split(/(?:^|\n)\s*Follow[ -]up\s*:/i)[0].trim() : '',
    truncated:Boolean(capture.truncated) || capture.text.length > 30_000
  };
}

export function applyContext(record, preview, selectedFields) {
  if (record.url && canonicalLeetCode(preview.url).url !== record.url) throw new Error('This context belongs to a different question. Capture the matching tab again.');
  const result = structuredClone(record);
  const mapping = { title:'title',description:'description',examples:'example',constraints:'constraints' };
  const fields = [...new Set(selectedFields)].filter(key => Object.hasOwn(mapping,key));
  for (const key of fields) result[mapping[key]] = String(preview[key] || '').slice(0,key === 'title' ? 200 : 30_000);
  result.contextSource = { url:record.url || '',at:new Date().toISOString(),fields };
  return result;
}
