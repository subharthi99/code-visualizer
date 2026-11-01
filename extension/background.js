import { canonicalLeetCode } from './src/domain.js';
import { normalizeContext } from './src/context.js';
import { readLeetCodeContext } from './extract.js';

// URL access is granted by an explicit toolbar click, never a background crawl.
// The path is scoped to the clicked tab. Existing panels retain their saved record
// until the learner explicitly captures a question again.
chrome.action.onClicked.addListener(tab => {
  let url;
  try { url = canonicalLeetCode(tab.url || '').url; } catch { url = ''; }
  const path = `index.html#capture=${Date.now()}&tab=${tab.id}${url ? `&problem=${encodeURIComponent(url)}` : '&unsupported=1'}`;
  const fallback = () => chrome.tabs.create({ url:chrome.runtime.getURL(path) });
  if (chrome.sidePanel && Number.isInteger(tab.id)) {
    // Call open directly in the user gesture; don't await network or storage first.
    let setting;
    try {
      setting = chrome.sidePanel.setOptions({ tabId: tab.id, path, enabled: true });
      const opening = chrome.sidePanel.open({ tabId: tab.id });
      Promise.all([setting, opening]).catch(fallback);
    } catch {
      // A synchronous API error must not strand the configured request or the learner.
      Promise.resolve(setting).catch(() => {});
      fallback();
    }
  } else fallback();
});

chrome.runtime.onMessage?.addListener((message,sender,respond) => {
  if (message?.type !== 'capture-context') return false;
  (async () => {
    try {
      if (sender.id !== chrome.runtime.id || !Number.isInteger(message.tabId)) throw new Error('Invalid context request.');
      const expected = canonicalLeetCode(message.url);
      const sourceTab = await chrome.tabs.get(message.tabId);
      if (!sourceTab.url) throw new Error('Temporary page access is unavailable. Click the extension toolbar action on the source question again.');
      if (canonicalLeetCode(sourceTab.url).url !== expected.url) throw new Error('The source tab is now on a different question. Click Study this problem again.');
      const path = new URL(sourceTab.url).pathname;
      if (!/^\/problems\/[a-z0-9-]+\/(?:description\/?)?$/.test(path + (path.endsWith('/') ? '' : '/'))) throw new Error('Open the Description tab before importing context.');
      const result = await chrome.scripting.executeScript({ target:{ tabId:message.tabId },func:readLeetCodeContext });
      if (!result[0]?.result) throw new Error('Could not read a rendered description. Open Description and try again, or paste the context manually.');
      const context = normalizeContext(result[0]?.result);
      if (context.url !== expected.url) throw new Error('The question changed during capture. Try again.');
      const after = await chrome.tabs.get(message.tabId);
      if (!after.url || canonicalLeetCode(after.url).url !== expected.url) throw new Error('The source question changed during capture. Click Study this problem again.');
      respond({ ok:true,context });
    } catch (error) { respond({ ok:false,error:error.message }); }
  })();
  return true;
});
