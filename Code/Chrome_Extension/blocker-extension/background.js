// Service worker：让扩展在无痕模式下保持"已运行"状态
// DNR 规则由浏览器引擎处理，这里不需要写拦截逻辑
// 但必须有实际代码，Chrome 才会注册这个 worker
console.log("[Temptation Blocker] service worker started");

// 监听扩展安装/更新事件（保持 worker 活跃，无实际业务逻辑）
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Temptation Blocker] onInstalled fired");
});
