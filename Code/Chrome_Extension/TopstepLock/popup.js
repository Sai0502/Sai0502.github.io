// TopstepLock popup
const timeInput = document.getElementById('targetTime');
const lockBtn = document.getElementById('lockBtn');
const debugBtn = document.getElementById('debugBtn');
const statusEl = document.getElementById('status');
const debugDetails = document.getElementById('debugDetails');
const debugPreview = document.getElementById('debugPreview');

function normalizeTime(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v || '').trim());
  if (!m) return '21:00';
  let h = Number(m[1]);
  if (h < 0) h = 0; if (h > 23) h = 23;
  return String(h).padStart(2, '0') + ':' + m[2];
}

async function getActiveTabUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] && tabs[0].url ? tabs[0].url : '(unknown)';
  } catch (_) { return '(unknown)'; }
}

async function showDebug() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'topstep-lock:debug' });
    if (resp && resp.ok && resp.summary) {
      debugPreview.textContent = resp.summary;
      debugDetails.open = true;
      try {
        const range = document.createRange();
        range.selectNodeContents(debugPreview);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
      try {
        await navigator.clipboard.writeText(resp.summary);
      } catch (_) {}
      return true;
    }
  } catch (_) {}
  return false;
}

lockBtn.addEventListener('click', async () => {
  const t = normalizeTime(timeInput.value);
  timeInput.value = t;
  lockBtn.disabled = true;
  statusEl.textContent = '执行中…';
  statusEl.className = 'status';
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'topstep-lock:execute', targetTime: t });
    if (resp && resp.ok) {
      statusEl.textContent = resp.message || '完成（未点 Confirm）';
      statusEl.className = 'status ok';
    } else {
      const errMsg = resp && resp.error ? resp.error : '未知错误';
      statusEl.textContent = '失败：' + errMsg;
      statusEl.className = 'status err';
      // 错误响应里直接带了调试信息
      if (resp && resp.debugSummary) {
        debugPreview.textContent = resp.debugSummary;
        debugDetails.open = true;
        try {
          const range = document.createRange();
          range.selectNodeContents(debugPreview);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {}
        statusEl.textContent += '｜调试信息已显示在下方，直接全选复制';
      } else {
        await new Promise(r => setTimeout(r, 300));
        const ok = await showDebug();
        if (ok) statusEl.textContent += '｜调试信息已显示在下方';
        else {
          debugPreview.textContent = '(content script 无响应，请刷新页面后重试)';
          debugDetails.open = true;
        }
      }
    }
  } catch (e) {
    const url = await getActiveTabUrl();
    statusEl.textContent = 'content script 未响应：' + e.message + '｜' + url;
    statusEl.className = 'status err';
    debugPreview.textContent = 'content script 未响应。请：\n1. 刷新 topstepx.com 页面\n2. 重新加载扩展\n3. 再点一次立即锁定';
    debugDetails.open = true;
  } finally {
    setTimeout(() => { lockBtn.disabled = false; }, 1500);
  }
});

debugBtn.addEventListener('click', async () => {
  debugBtn.disabled = true;
  statusEl.textContent = '正在收集调试信息…';
  const ok = await showDebug();
  if (ok) {
    statusEl.textContent = '调试信息已显示在下方，直接全选复制';
    statusEl.className = 'status ok';
  } else {
    const url = await getActiveTabUrl();
    statusEl.textContent = 'content script 未响应。当前页：' + url;
    statusEl.className = 'status err';
    debugPreview.textContent = 'content script 未响应。请刷新页面后重试。';
    debugDetails.open = true;
  }
  setTimeout(() => { debugBtn.disabled = false; }, 1500);
});
