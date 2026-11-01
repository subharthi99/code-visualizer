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
  // innerText flattens <sup>4</sup> into an ordinary digit (10^4 becomes 104).
  // Walk only this description subtree; never mutate the live page to format it.
  const readText = node => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    if (['script','style','noscript'].includes(tag)) return '';
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return '';
    }
    if (tag === 'br') return '\n';
    const value = Array.from(node.childNodes,readText).join('');
    if (tag === 'sup') return `^(${value})`;
    if (tag === 'sub') return `_(${value})`;
    return ['p','div','pre','li','ul','ol','h1','h2','h3','blockquote','tr'].includes(tag) ? `\n${value}\n` : value;
  };
  const body = container.childNodes ? readText(container).replace(/\n{3,}/g,'\n\n').trim() : container.innerText;
  return { url:location.href,title:document.querySelector('h1')?.innerText || '',text:body.slice(0,30_000),truncated:body.length > 30_000 };
}
