// This function is serialized by Chrome. Keep it self-contained and read text only.
export function readLeetCodeContext() {
  const route = new URL(location.href);
  if (!/^\/problems\/[a-z0-9-]+\/(?:description\/?)?$/.test(route.pathname + (route.pathname.endsWith('/') ? '' : '/'))) throw new Error('Open the Description tab before importing context.');
  const selectors = ['[data-track-load="description_content"]','[data-cy="question-content"]','.question-content','.elfjS'];
  let container;
  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (candidate?.getClientRects().length && candidate.innerText.trim()) { container = candidate; break; }
  }
  if (!container) throw new Error('No rendered problem description found. Open Description or paste the context manually.');
  const body = container.innerText;
  return { url:location.href,title:document.querySelector('h1')?.innerText || '',text:body.slice(0,30_000),truncated:body.length > 30_000 };
}
