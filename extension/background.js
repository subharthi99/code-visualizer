import { canonicalLeetCode } from './src/domain.js';

// URL access is granted by an explicit toolbar click, never a background crawl.
// The path is scoped to the clicked tab. Existing panels retain their saved record
// until the learner explicitly captures a question again.
chrome.action.onClicked.addListener(tab => {
  let url;
  try { url = canonicalLeetCode(tab.url || '').url; } catch { url = ''; }
  const path = `index.html#capture=${Date.now()}${url ? `&problem=${encodeURIComponent(url)}` : '&unsupported=1'}`;
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
