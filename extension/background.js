// 点扩展图标：打开（或切回）同步页面。所有同步逻辑都在那个页面里，页面开着就不会被浏览器中途停掉。
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("app.html");
  const [open] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [url] });
  if (open && open.tabId >= 0) {
    await chrome.tabs.update(open.tabId, { active: true });
    if (open.windowId >= 0) await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});
