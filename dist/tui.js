import { createSignal, Show } from 'solid-js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import os from 'os';

// src/tui.tsx
var STATUS_DIRNAME = "opencode-statusbar";
var STATUS_FILENAME = "status.json";
var POLL_INTERVAL_MS = 2e3;
function sanitizeInstanceName(input) {
  return input.replace(/[^A-Za-z0-9._-]/g, "_");
}
function resolveDefaultInstanceName() {
  const fromEnv = process.env.OPENCODE_STATUSBAR_INSTANCE;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const safe = sanitizeInstanceName(fromEnv);
    if (safe.length > 0) return safe;
  }
  return `pid-${process.pid}`;
}
function resolveStatePath() {
  const fromEnv = process.env.OPENCODE_STATUSBAR_STATE;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? os.tmpdir();
  const instance = resolveDefaultInstanceName();
  return join(runtimeDir, STATUS_DIRNAME, instance, STATUS_FILENAME);
}
function StatusBarComponent(props) {
  const [status, setStatus] = createSignal(null);
  const [lastUpdated, setLastUpdated] = createSignal("");
  const [visible, setVisible] = createSignal(true);
  const statePath = resolveStatePath();
  async function loadStatus() {
    try {
      const raw = await readFile(statePath, "utf8");
      const parsed = JSON.parse(raw);
      setStatus(parsed.status);
      setLastUpdated(new Date(parsed.updatedAt).toLocaleTimeString());
    } catch {
      setStatus(null);
    }
  }
  loadStatus();
  const intervalId = setInterval(loadStatus, POLL_INTERVAL_MS);
  props.api.lifecycle.onDispose(() => {
    clearInterval(intervalId);
  });
  const theme = () => props.theme === "system" ? "dark" : props.theme;
  const isDark = () => theme() === "dark";
  const gitBranch = () => status()?.git.branch ?? "...";
  const isDirty = () => status()?.git.isDirty ?? false;
  const cpuPercent = () => status()?.system.cpuPercent ?? 0;
  const ramUsed = () => status()?.system.ramUsedGB ?? 0;
  const ramTotal = () => status()?.system.ramTotalGB ?? 0;
  const ramPercent = () => status()?.system.ramUsedPercent ?? 0;
  const gitColor = () => isDirty() ? "#f59e0b" : "#22c55e";
  const cpuColor = () => cpuPercent() > 80 ? "#ef4444" : cpuPercent() > 50 ? "#f59e0b" : "#22c55e";
  const ramColor = () => ramPercent() > 80 ? "#ef4444" : ramPercent() > 50 ? "#f59e0b" : "#22c55e";
  const bgColor = () => isDark() ? "#1e1e2e" : "#ffffff";
  const textColor = () => isDark() ? "#cdd6f4" : "#1e1e2e";
  const mutedColor = () => isDark() ? "#6c7086" : "#6c7086";
  const borderColor = () => isDark() ? "#313244" : "#e4e4e7";
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        display: "flex",
        "align-items": "center",
        gap: "16px",
        padding: "6px 12px",
        "background-color": bgColor(),
        "border-top": `1px solid ${borderColor()}`,
        "font-size": "12px",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: textColor(),
        "overflow-x": "auto",
        "white-space": "nowrap"
      }
    },
    /* @__PURE__ */ React.createElement(Show, { when: status() }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", "align-items": "center", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "git:"), /* @__PURE__ */ React.createElement("span", { style: { color: gitColor(), "font-weight": "500" } }, gitBranch()), /* @__PURE__ */ React.createElement(Show, { when: isDirty() }, /* @__PURE__ */ React.createElement("span", { style: { color: "#f59e0b" } }, "*"))), /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "|"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", "align-items": "center", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "cpu:"), /* @__PURE__ */ React.createElement("span", { style: { color: cpuColor(), "font-weight": "500" } }, cpuPercent(), "%")), /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "|"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", "align-items": "center", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "ram:"), /* @__PURE__ */ React.createElement("span", { style: { color: ramColor(), "font-weight": "500" } }, ramUsed().toFixed(1), "/", ramTotal().toFixed(0), "GB"), /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "(", ramPercent(), "%)")), /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor() } }, "|"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", "align-items": "center", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { color: mutedColor(), "font-size": "10px" } }, "updated ", lastUpdated()))),
    /* @__PURE__ */ React.createElement(Show, { when: !status() }, /* @__PURE__ */ React.createElement("div", { style: { color: mutedColor() } }, "Loading status..."))
  );
}
function initializeTui(api, disposeRoot) {
  api.slots.register({
    order: 50,
    slots: {
      home_bottom(ctx) {
        return /* @__PURE__ */ React.createElement(
          StatusBarComponent,
          {
            api,
            theme: ctx.theme.current
          }
        );
      }
    }
  });
  api.lifecycle.onDispose(disposeRoot);
}
var STATUSLINE_PLUGIN_ID = "opencode-statusbar";
var tui = async (api) => {
  initializeTui(api, () => {
  });
};
var plugin = {
  id: STATUSLINE_PLUGIN_ID,
  tui
};
var tui_default = plugin;

export { tui_default as default, initializeTui };
