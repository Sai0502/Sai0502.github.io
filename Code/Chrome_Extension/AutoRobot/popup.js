const STORAGE = {
  scripts: "autorobot1.scripts",
  draft: "autorobot1.draft",
  recording: "autorobot1.recording"
};

const state = {
  scripts: [],
  view: "list",
  editingScript: null,
  recording: false
};

const els = {
  subtitle: document.getElementById("subtitle"),
  backButton: document.getElementById("backButton"),
  listView: document.getElementById("listView"),
  editorView: document.getElementById("editorView"),
  scriptList: document.getElementById("scriptList"),
  newScriptButton: document.getElementById("newScriptButton"),
  scriptNameInput: document.getElementById("scriptNameInput"),
  recordButton: document.getElementById("recordButton"),
  stopRecordButton: document.getElementById("stopRecordButton"),
  actionList: document.getElementById("actionList"),
  saveButton: document.getElementById("saveButton"),
  cancelButton: document.getElementById("cancelButton")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadState();
  bindEvents();
  render();
}

async function loadState() {
  const data = await chrome.storage.local.get({
    [STORAGE.scripts]: [],
    [STORAGE.draft]: null,
    [STORAGE.recording]: false
  });
  state.scripts = Array.isArray(data[STORAGE.scripts]) ? data[STORAGE.scripts] : [];
  state.editingScript = data[STORAGE.draft] || null;
  state.recording = Boolean(data[STORAGE.recording]);
  state.view = state.editingScript ? "editor" : "list";
}

function bindEvents() {
  els.newScriptButton.addEventListener("click", () => openEditor(createScript()));
  els.backButton.addEventListener("click", closeEditorWithoutSaving);
  els.cancelButton.addEventListener("click", closeEditorWithoutSaving);
  els.saveButton.addEventListener("click", saveEditingScript);
  els.recordButton.addEventListener("click", startRecording);
  els.stopRecordButton.addEventListener("click", stopRecording);
  els.scriptNameInput.addEventListener("input", () => {
    if (!state.editingScript) return;
    state.editingScript.name = els.scriptNameInput.value;
    persistDraft();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STORAGE.draft]) {
      state.editingScript = changes[STORAGE.draft].newValue || state.editingScript;
      if (state.view === "editor") renderActions();
    }
    if (changes[STORAGE.recording]) {
      state.recording = Boolean(changes[STORAGE.recording].newValue);
      if (state.view === "editor") renderEditorChrome();
    }
  });
}

function createScript() {
  return {
    id: crypto.randomUUID(),
    name: `脚本 ${state.scripts.length + 1}`,
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function render() {
  const editing = state.view === "editor";
  els.listView.classList.toggle("hidden", editing);
  els.editorView.classList.toggle("hidden", !editing);
  els.backButton.classList.toggle("hidden", !editing);
  els.subtitle.textContent = editing ? "动作列表" : "脚本列表";

  if (editing) {
    renderEditor();
  } else {
    renderList();
  }
}

function renderList() {
  els.scriptList.replaceChildren();

  if (state.scripts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有脚本。点击“新增脚本”开始录制。";
    els.scriptList.append(empty);
    return;
  }

  for (const script of state.scripts) {
    const row = document.createElement("div");
    row.className = "script-row";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "script-title";
    title.textContent = script.name || "未命名脚本";

    const meta = document.createElement("div");
    meta.className = "script-meta";
    meta.textContent = `${script.actions?.length || 0} 个动作`;
    titleWrap.append(title, meta);

    row.append(
      titleWrap,
      button("执行", "text-button", () => runScript(script)),
      button("修改", "text-button", () => openEditor(clone(script))),
      button("删除", "danger-button", () => deleteScript(script.id))
    );
    els.scriptList.append(row);
  }
}

function renderEditor() {
  if (!state.editingScript) return;
  els.scriptNameInput.value = state.editingScript.name || "";
  renderEditorChrome();
  renderActions();
}

function renderEditorChrome() {
  els.recordButton.classList.toggle("hidden", state.recording);
  els.stopRecordButton.classList.toggle("hidden", !state.recording);
}

function renderActions() {
  els.actionList.replaceChildren();
  const actions = state.editingScript?.actions || [];

  if (!actions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.recording
      ? "录制中。去网页上点击目标位置，动作会自动出现在这里。"
      : "暂无动作。点击“开始录制动作”，然后在网页上点击目标位置。";
    els.actionList.append(empty);
    return;
  }

  actions.forEach((action, index) => {
    const row = document.createElement("div");
    row.className = "action-row";

    const number = document.createElement("div");
    number.className = "action-number";
    number.textContent = String(index + 1);

    const fields = document.createElement("div");
    fields.className = "action-fields";
    fields.append(...fieldsForAction(action, index));

    row.append(
      number,
      fields,
      button("删除", "danger-button delete-action", () => deleteAction(index))
    );
    els.actionList.append(row);
  });
}

function fieldsForAction(action, index) {
  const type = action.type || "click";
  const common = [
    typeBadge(type),
    labeledInput("停顿(ms)", action.waitMs || 0, value => updateAction(index, { waitMs: Math.max(0, toInt(value, 0)) }))
  ];

  if (type === "scroll") {
    return [
      ...common,
      labeledInput("位置 X", action.x, value => updateAction(index, { x: toInt(value, action.x) })),
      labeledInput("位置 Y", action.y, value => updateAction(index, { y: toInt(value, action.y) })),
      labeledInput("滚动 X", action.deltaX || 0, value => updateAction(index, { deltaX: toInt(value, 0) })),
      labeledInput("滚动 Y", action.deltaY || 0, value => updateAction(index, { deltaY: toInt(value, 0) }))
    ];
  }

  if (type === "key") {
    return [
      ...common,
      labeledTextInput("Key", action.key || "", value => updateAction(index, { key: value })),
      labeledTextInput("Code", action.code || "", value => updateAction(index, { code: value })),
      labeledCheckbox("Ctrl", action.ctrlKey, value => updateAction(index, { ctrlKey: value })),
      labeledCheckbox("Alt", action.altKey, value => updateAction(index, { altKey: value })),
      labeledCheckbox("Shift", action.shiftKey, value => updateAction(index, { shiftKey: value })),
      labeledCheckbox("Meta", action.metaKey, value => updateAction(index, { metaKey: value }))
    ];
  }

  return [
    ...common,
    labeledInput("位置 X", action.x, value => updateAction(index, { x: toInt(value, action.x) })),
    labeledInput("位置 Y", action.y, value => updateAction(index, { y: toInt(value, action.y) })),
    labeledSelect("按键", action.button || "left", [["left", "左键"], ["right", "右键"]], value => updateAction(index, { button: value })),
    labeledInput("点击次数", action.clicks || 1, value => updateAction(index, { clicks: Math.max(1, toInt(value, 1)) })),
    labeledInput("偏移 X", action.offsetX || 0, value => updateAction(index, { offsetX: toInt(value, 0) })),
    labeledInput("偏移 Y", action.offsetY || 0, value => updateAction(index, { offsetY: toInt(value, 0) }))
  ];
}

function typeBadge(type) {
  const badge = document.createElement("div");
  badge.className = `type-badge type-${type}`;
  badge.textContent = type === "scroll" ? "滚动" : type === "key" ? "键盘" : "点击";
  return badge;
}

function labeledInput(label, value, onChange) {
  const wrap = document.createElement("label");
  const span = document.createElement("span");
  const input = document.createElement("input");
  wrap.className = "mini-field";
  span.className = "mini-label";
  span.textContent = label;
  input.type = "number";
  input.value = value ?? 0;
  input.addEventListener("change", () => onChange(input.value));
  wrap.append(span, input);
  return wrap;
}

function labeledTextInput(label, value, onChange) {
  const wrap = document.createElement("label");
  const span = document.createElement("span");
  const input = document.createElement("input");
  wrap.className = "mini-field";
  span.className = "mini-label";
  span.textContent = label;
  input.type = "text";
  input.value = value ?? "";
  input.addEventListener("change", () => onChange(input.value));
  wrap.append(span, input);
  return wrap;
}

function labeledCheckbox(label, value, onChange) {
  const wrap = document.createElement("label");
  const span = document.createElement("span");
  const input = document.createElement("input");
  wrap.className = "mini-field mini-check";
  span.className = "mini-label";
  span.textContent = label;
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", () => onChange(input.checked));
  wrap.append(span, input);
  return wrap;
}

function labeledSelect(label, value, options, onChange) {
  const wrap = document.createElement("label");
  const span = document.createElement("span");
  const select = document.createElement("select");
  wrap.className = "mini-field";
  span.className = "mini-label";
  span.textContent = label;

  for (const [optionValue, text] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = text;
    option.selected = optionValue === value;
    select.append(option);
  }

  select.addEventListener("change", () => onChange(select.value));
  wrap.append(span, select);
  return wrap;
}

function button(text, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}

async function openEditor(script) {
  state.view = "editor";
  state.editingScript = script;
  await persistDraft();
  render();
}

async function closeEditorWithoutSaving() {
  await stopRecording();
  state.view = "list";
  state.editingScript = null;
  await chrome.storage.local.remove(STORAGE.draft);
  render();
}

async function saveEditingScript() {
  if (!state.editingScript) return;
  await stopRecording();

  const script = {
    ...state.editingScript,
    name: (els.scriptNameInput.value || "").trim() || "未命名脚本",
    updatedAt: Date.now()
  };

  const index = state.scripts.findIndex(item => item.id === script.id);
  if (index >= 0) {
    state.scripts[index] = clone(script);
  } else {
    state.scripts.push(clone(script));
  }

  await chrome.storage.local.set({ [STORAGE.scripts]: state.scripts });
  await chrome.storage.local.remove(STORAGE.draft);
  state.editingScript = null;
  state.view = "list";
  render();
}

async function deleteScript(id) {
  const script = state.scripts.find(item => item.id === id);
  const ok = window.confirm(`删除脚本“${script?.name || "未命名脚本"}”？`);
  if (!ok) return;
  state.scripts = state.scripts.filter(item => item.id !== id);
  await chrome.storage.local.set({ [STORAGE.scripts]: state.scripts });
  renderList();
}

async function updateAction(index, patch) {
  if (!state.editingScript?.actions?.[index]) return;
  state.editingScript.actions[index] = {
    ...state.editingScript.actions[index],
    ...patch
  };
  state.editingScript.updatedAt = Date.now();
  await persistDraft();
}

async function deleteAction(index) {
  if (!state.editingScript?.actions) return;
  state.editingScript.actions.splice(index, 1);
  state.editingScript.updatedAt = Date.now();
  await persistDraft();
  renderActions();
}

async function persistDraft() {
  if (!state.editingScript) return;
  state.editingScript.updatedAt = Date.now();
  await chrome.storage.local.set({ [STORAGE.draft]: state.editingScript });
}

async function startRecording() {
  if (!state.editingScript) return;
  await persistDraft();
  await ensureContentScript();
  await chrome.storage.local.set({ [STORAGE.recording]: true });
  await sendToActiveTab({ type: "AUTOROBOT1_START_RECORDING" });
  state.recording = true;
  renderEditorChrome();
  renderActions();
}

async function stopRecording() {
  await chrome.storage.local.set({ [STORAGE.recording]: false });
  await sendToActiveTab({ type: "AUTOROBOT1_STOP_RECORDING" });
  state.recording = false;
}

async function runScript(script) {
  if (!script.actions?.length) {
    window.alert("这个脚本还没有动作。");
    return;
  }
  await ensureContentScript();
  await sendToActiveTab({ type: "AUTOROBOT1_RUN_SCRIPT", actions: script.actions });
}

async function ensureContentScript() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("找不到当前标签页");
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  }).catch(() => undefined);
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}
