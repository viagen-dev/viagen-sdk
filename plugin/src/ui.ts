import { buildEditorModule } from "./editor";

export function buildUiHtml(opts?: {
  editable?: boolean;
  git?: boolean;
}): string {
  const hasEditor = opts?.editable ?? false;
  const hasGit = opts?.git ?? false;
  const hasTabs = true; // Logs tab is always present
  const editor = hasEditor ? buildEditorModule() : null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>viagen</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ${
    hasEditor
      ? `<script data-manual src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"><\/script>`
      : ""
  }
  <style>
    ${editor ? editor.css : ""}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #ffffff;
      color: #171717;
      height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background: #ffffff;
    }
    .header h1 {
      font-size: 15px;
      font-weight: 600;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #171717;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #d4d4d4;
    }
    .status-dot.ok { background: #22c55e; }
    .status-dot.error { background: #ef4444; }
    .setup-banner {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      background: #fafafa;
      font-size: 12px;
      color: #525252;
      line-height: 1.6;
      flex-shrink: 0;
      display: none;
    }
    .setup-banner code {
      font-family: 'Geist Mono', ui-monospace, monospace;
      color: #171717;
      font-size: 11px;
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .msg-system {
      font-size: 12px;
      color: #525252;
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      line-height: 1.5;
    }
    .msg-system .system-icon {
      flex-shrink: 0;
      color: #a3a3a3;
    }
    .msg-system .system-text {
      flex: 1;
    }
    .msg-system .system-action {
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      background: #171717;
      color: #ffffff;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .msg-system .system-action:hover { background: #404040; }
    .msg-system .system-dismiss {
      color: #a3a3a3;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px;
      flex-shrink: 0;
      transition: color 0.15s;
      background: none;
      border: none;
    }
    .msg-system .system-dismiss:hover { color: #525252; }
    .btn {
      padding: 5px 10px;
      border: 1px solid #e5e5e5;
      background: #ffffff;
      color: #525252;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .btn:hover { border-color: #d4d4d4; color: #171717; background: #fafafa; }
    .btn.btn-danger:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
    .btn.active { border-color: #171717; color: #171717; }
    .btn-dark {
      padding: 5px 10px;
      background: #171717;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .btn-dark:hover { background: #404040; }
    .btn-dark:disabled { background: #d4d4d4; cursor: default; }
    .btn-dark.icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px 7px;
      min-width: 28px;
      min-height: 28px;
    }
    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px 7px;
      min-width: 28px;
      min-height: 28px;
    }
    .icon-btn.active { border-color: #171717; color: #171717; }
    .activity-bar {
      padding: 6px 16px;
      border-bottom: 1px solid #e5e5e5;
      background: #fafafa;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #a3a3a3;
      flex-shrink: 0;
      display: none;
      animation: pulse 2s ease-in-out infinite;
    }
    .activity-bar.done {
      animation: none;
      color: #525252;
    }
    .thinking-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      align-items: center;
    }
    .thinking-indicator .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a3a3a3;
      animation: thinking-bounce 1.4s ease-in-out infinite;
    }
    .thinking-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
    .thinking-indicator .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes thinking-bounce {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .msg-summary {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #a3a3a3;
      padding: 4px 0;
    }
    .session-timer {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #a3a3a3;
      margin-left: 8px;
      font-weight: 400;
    }
    .session-timer.warning { color: #d97706; }
    .session-timer.critical { color: #ef4444; }
    .messages {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .msg {
      font-size: 13px;
      line-height: 1.6;
      word-wrap: break-word;
      min-width: 0;
      max-width: 100%;
    }
    .label {
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: block;
      margin-bottom: 3px;
    }
    .msg-user {
      background: #f5f5f5;
      padding: 10px 12px;
      border-radius: 10px;
      align-self: flex-end;
      width: fit-content;
      max-width: 85%;
    }
    .msg-user .label { color: #a3a3a3; }
    .msg-user .text { color: #171717; }
    .msg-assistant .label { color: #a3a3a3; }
    .msg-assistant .text {
      color: #404040;
    }
    .msg-assistant .text a {
      color: #2563eb;
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-color: #2563eb40;
    }
    .msg-assistant .text a:hover { text-decoration-color: #2563eb; }
    .msg-assistant .text strong { color: #171717; font-weight: 600; }
    .msg-assistant .text em { font-style: italic; }
    .msg-assistant .text .md-code {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11.5px;
      color: #7c3aed;
      background: #f0edf9;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .msg-assistant .text .md-pre {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11.5px;
      line-height: 1.6;
      color: #404040;
    }
    .msg-assistant .text .md-li {
      display: block;
      padding-left: 14px;
      text-indent: -14px;
      line-height: 1.6;
    }
    .msg-assistant .text .md-li:first-child,
    .msg-assistant .text br + .md-li { margin-top: 4px; }
    .msg-assistant .text .md-li:last-child { margin-bottom: 4px; }
    .msg-assistant .text .md-li::before {
      content: '\\2022\\00a0\\00a0';
      color: #d4d4d4;
    }
    .msg-assistant .text .md-h {
      display: block;
      color: #171717;
      margin-top: 6px;
      font-weight: 600;
    }


    .tool-group {
    }
    .tool-group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
    }
    .tool-group-header:hover { background: #f5f5f5; border-radius: 6px; }
    .tool-group-icon {
      flex-shrink: 0;
      color: #a3a3a3;
    }
    .tool-group-label {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #A3A3A4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      line-height: 1.4;
    }
    .tool-group-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      margin-left: 14px;
      padding-left: 12px;
      border-left: 2px solid #e5e5e5;
    }
    .tool-group.expanded .tool-group-body {
      max-height: 2000px;
      overflow-y: auto;
    }
    .tool-group-item {
      padding: 6px 4px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #737373;
      line-height: 1.4;
      word-break: break-word;
    }
    .tool-group-item.clickable,
    .task-tool-item.clickable {
      cursor: pointer;
      transition: background 0.15s;
    }
    .tool-group-item.clickable:hover,
    .task-tool-item.clickable:hover {
      background: #f5f5f5;
      border-radius: 4px;
    }
    .tool-cmd {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #7c3aed;
      background: #f0edf9;
      padding: 1px 5px;
      border-radius: 3px;
    }
    .tool-group-item.committed,
    .task-tool-item.committed {
      cursor: default;
      pointer-events: none;
      opacity: 0.55;
      background: #f5f5f5;
    }
    .task-group {
    }
    .task-group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      cursor: pointer;
      -webkit-user-select: none;
      user-select: none;
    }
    .task-group:not(.expanded) .task-group-header {
    }
    .task-group-header:hover { background: #f5f5f5; border-radius: 6px; }
    .task-group-checkbox {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1.5px solid #d4d4d4;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      background: #fff;
    }
    .task-group-checkbox svg {
      display: none;
    }
    .task-group.running .task-group-checkbox {
      border-color: #a3a3a3;
      animation: task-checkbox-pulse 1.5s ease-in-out infinite;
    }
    @keyframes task-checkbox-pulse {
      0%, 100% { border-color: #a3a3a3; }
      50% { border-color: #d4d4d4; }
    }
    .task-group.completed .task-group-checkbox {
      background: #22c55e;
      border-color: #22c55e;
    }
    .task-group.completed .task-group-checkbox svg {
      display: block;
    }
    .task-group.failed .task-group-checkbox {
      background: #dc2626;
      border-color: #dc2626;
    }
    .task-group.failed .task-group-checkbox svg {
      display: block;
    }
    .task-group-title {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #171717;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }
    .task-group.completed .task-group-title {
      color: #a3a3a3;
    }
    .task-group.failed .task-group-title {
      color: #a3a3a3;
    }
    .task-group-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      margin-left: 14px;
      padding-left: 12px;
      border-left: 2px solid #e5e5e5;
    }
    .task-group.expanded .task-group-body {
      max-height: 5000px;
      overflow-y: auto;
    }
    .task-group-body .msg {
      margin: 0;
    }
    .task-tool-item {
      padding: 6px 4px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #737373;
      line-height: 1.4;
      word-break: break-word;
    }


    .task-group-body .tool-group {
      border-radius: 0;
      border-left: none;
      border-right: none;
      border-bottom: none;
    }
    .task-group-body .msg-assistant {
      padding: 8px 12px;
      border-top: 1px solid #e5e5e5;
    }
    .task-group-body .msg-error {
      border-radius: 0;
      border-left: none;
      border-right: none;
      border-bottom: none;
    }


    .msg-error {
      font-size: 12px;
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 7px 10px;
    }
    .update-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #525252;
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 10px;
      padding: 8px 12px;
      margin: 0 0 8px 0;
      line-height: 1.5;
      flex-shrink: 0;
    }
    .update-banner .system-icon {
      flex-shrink: 0;
      color: #a3a3a3;
    }
    .update-banner .system-text {
      flex: 1;
    }
    .update-banner .system-action {
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      background: #171717;
      color: #ffffff;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .update-banner .system-action:hover { background: #404040; }
    .update-banner .system-dismiss {
      color: #a3a3a3;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px;
      flex-shrink: 0;
      transition: color 0.15s;
      background: none;
      border: none;
    }
    .update-banner .system-dismiss:hover { color: #525252; }
    .input-area {
      padding: 12px 16px;
      flex-shrink: 0;
      background: #ffffff;
    }
    .input-wrap {
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      transition: border-color 0.15s, box-shadow 0.15s;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    }
    .input-wrap:focus-within { box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); }
    .input-wrap.disabled { opacity: 0.4; }
    .input-area textarea {
      width: 100%;
      padding: 10px 12px 0 12px;
      border: none;
      background: transparent;
      color: #171717;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      resize: none;
      height: auto;
      min-height: 20px;
      overflow: hidden;
      line-height: 1.5;
    }
    .input-area textarea::placeholder { color: #a3a3a3; }
    .input-bottom {
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 6px 8px 8px 8px;
    }
    .send-btn {
      padding: 6px 8px;
      background: #f0f0f0;
      color: #737373;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .send-btn:hover { background: #e5e5e5; color: #525252; }
    .send-btn.active { background: #171717; color: #ffffff; border-color: #171717; }
    .send-btn.active:hover { background: #404040; border-color: #404040; }
    .attach-btn {
      padding: 6px 6px;
      background: transparent;
      color: #a3a3a3;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
      margin-right: 2px;
    }
    .attach-btn:hover { color: #525252; background: #f5f5f5; }
    .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .send-btn.stop { background: #ef4444; color: #ffffff; border-color: #ef4444; opacity: 1; cursor: pointer; }
    .send-btn.stop:hover { background: #dc2626; border-color: #dc2626; }
    .drop-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(37,99,235,0.08);
      border: 2px dashed #2563eb;
      border-radius: 12px;
      z-index: 100;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .drop-overlay.visible { display: flex; }
    .drop-overlay span {
      font-size: 13px;
      font-weight: 600;
      color: #2563eb;
      background: #ffffff;
      padding: 8px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .status-bar {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 5px 16px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      color: #a3a3a3;
      border-top: 1px solid #f5f5f5;
      flex-shrink: 0;
      background: #ffffff;
    }
    .status-bar span { cursor: pointer; transition: color 0.15s; }
    .status-bar span:hover { color: #525252; }
    .status-bar .d-add { color: #16a34a; }
    .status-bar .d-del { color: #dc2626; }
    .changes-header {
      padding: 8px 14px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      background: #f5f5f5;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
    }
    .changes-header-sep {
      color: #737373;
      font-size: 14px;
      flex-shrink: 0;
    }
    .changes-header-branch {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #525252;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 3px 8px;
      background: #ffffff;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .changes-header-branch:hover { border-color: #d4d4d4; color: #171717; background: #fafafa; }
    .changes-header-branch a {
      color: inherit;
      text-decoration: none;
    }
    .changes-header-pr {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #a3a3a3;
      text-decoration: none;
      transition: color 0.15s;
    }
    .changes-header-pr:hover { color: #525252; }
    .changes-header-stats {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #737373;
    }
    .tab-bar {
      display: flex;
      border-bottom: 1px solid #e5e5e5;
      flex-shrink: 0;
      background: #ffffff;
      gap: 0;
    }
    .tab {
      flex: none;
      padding: 9px 16px;
      font-size: 12px;
      font-weight: 500;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #a3a3a3;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .tab svg { flex-shrink: 0; }
    .tab:hover { color: #525252; }
    .tab.active { color: #171717; border-bottom-color: #171717; }
    .changes-file {
      padding: 8px 16px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      color: #525252;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.1s;
      border-bottom: 1px solid #f5f5f5;
    }
    .changes-file:hover { background: #fafafa; color: #171717; }
    .changes-file .file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .changes-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .changes-dot.M { background: #d97706; }
    .changes-dot.A { background: #16a34a; }
    .changes-dot.q { background: #16a34a; }
    .changes-dot.D { background: #dc2626; }
    .changes-dot.R { background: #2563eb; }
    .changes-badge {
      font-size: 10px;
      color: #a3a3a3;
      font-family: 'Geist Mono', ui-monospace, monospace;
    }
    .changes-header .stat-add { color: #16a34a; }
    .changes-header .stat-del { color: #dc2626; }
    .changes-header .stat-files { color: #525252; }
    .file-delta {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 10px;
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .file-delta .d-add { color: #16a34a; }
    .file-delta .d-del { color: #dc2626; }
    .diff-view {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.6;
      background: #ffffff;
    }
    .diff-line {
      padding: 0 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .diff-add { color: #16a34a; background: #f0fdf4; }
    .diff-del { color: #dc2626; background: #fef2f2; }
    .diff-hunk { color: #7c3aed; background: #f5f3ff; padding-top: 6px; margin-top: 4px; }
    .diff-meta { color: #a3a3a3; }
    .diff-ctx { color: #737373; }
    .changes-empty {
      padding: 16px;
      color: #a3a3a3;
      font-size: 12px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      text-align: center;
      margin-top: 40%;
    }
    .editor-header {
      padding: 8px 14px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      background: #f5f5f5;
    }
    .editor-back {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      min-height: 28px;
      padding: 5px 7px;
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      color: #525252;
      cursor: pointer;
      flex-shrink: 0;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .editor-back:hover { border-color: #d4d4d4; color: #171717; background: #fafafa; }
    .editor-filename {
      flex: 1;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .logs-header {
      padding: 8px 14px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
      background: #f5f5f5;
    }
    .logs-header span {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
    }
    .logs-list {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      background: #ffffff;
    }
    .log-entry {
      padding: 8px 16px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      color: #525252;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.1s;
      border-bottom: 1px solid #f5f5f5;
    }
    .log-entry:hover { background: #fafafa; color: #171717; }
    .log-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a3a3a3;
    }
    .log-entry.warn .log-icon { background: #d97706; }
    .log-entry.error .log-icon { background: #dc2626; }
    .log-icon svg { display: none; }
    .log-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .log-time {
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 10px;
      color: #a3a3a3;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .logs-empty {
      padding: 16px;
      color: #a3a3a3;
      font-size: 12px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      text-align: center;
      margin-top: 40%;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:0;">
      <h1><span class="status-dot" id="status-dot"></span> via <span class="session-timer" id="session-timer"></span></h1>
    </div>
    <div style="display:flex;gap:4px;align-items:center;">
      <button class="btn icon-btn" id="view-preview" title="Preview app" style="display:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
      <button class="btn icon-btn" id="view-toggle" title="Toggle view">
        <svg id="view-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>
      </button>
      <button class="btn icon-btn" id="sound-btn" title="Toggle completion sound">
        <svg id="sound-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>
      </button>
      <button class="btn" id="reset-btn" style="display:none;">Reset</button>
    </div>
  </div>
  ${
    hasTabs
      ? `<div class="tab-bar" id="tab-bar">
    <button class="tab active" data-tab="chat"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>Chat</button>
    ${hasGit ? '<button class="tab" data-tab="changes" id="changes-tab" style="position:relative;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 13h2"/><path d="M9 17h6"/></svg>Changes<span id="changes-dot" style="display:none;position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:#d97706;"></span></button>' : ""}
    ${hasEditor ? '<button class="tab" data-tab="files"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>Files</button>' : ""}
    <button class="tab" data-tab="logs"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>Logs</button>
  </div>`
      : ""
  }
  <div id="chat-view" style="display:flex;flex-direction:column;flex:1;overflow:hidden;position:relative;">
    <div class="drop-overlay" id="drop-overlay"><span>Drop files to upload</span></div>
    <div class="setup-banner" id="setup-banner"></div>

    <div class="activity-bar" id="activity-bar"></div>
    <div class="messages" id="messages"></div>
    <div class="input-area">
      <div id="update-banner-container"></div>
      <div class="input-wrap" id="input-wrap">
        <textarea id="input" rows="1" placeholder="What do you want to build?" autofocus></textarea>
        <div class="input-bottom">
          <input type="file" id="file-input" multiple style="display:none;">
          <button class="attach-btn" id="attach-btn" title="Upload files"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
          <button class="send-btn" id="send-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
        </div>
      </div>
    </div>
    <div class="status-bar" id="status-bar">${hasGit ? '<span id="status-branch"></span><span id="status-diff"></span>' : ""}<span id="status-cost" style="display:none;margin-left:auto;"></span></div>
  </div>
  ${editor ? editor.html : ""}
  ${
    hasGit
      ? `<div id="changes-view" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
    <div class="changes-header" id="changes-header" style="display:none;">
      <span class="changes-header-branch" id="changes-branch-name"></span>
      <span class="changes-header-sep changes-sep-pr" id="changes-sep-pr" style="display:none;">&middot;</span>
      <a class="changes-header-pr" id="changes-pr-link" target="_blank" style="display:none;"></a>
      <span class="changes-header-sep changes-sep-stats" id="changes-sep-stats" style="display:none;">&middot;</span>
      <span class="changes-header-stats" id="changes-stats"></span>
      <span style="flex:1;"></span>
      <button class="btn-dark icon-btn" id="commit-btn" title="Git commit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/></svg></button>
      <button class="btn btn-danger icon-btn" id="revert-btn" title="Revert changes" style="color:#dc2626;border-color:#fecaca;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
    </div>
    <div id="changes-list-view" style="flex:1;overflow-y:auto;">
      <div id="changes-list" style="padding:0;"></div>
    </div>
    <div id="changes-diff-view" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
      <div class="editor-header">
        <button class="editor-back" id="diff-back" title="Back to changes"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
        <span class="editor-filename" id="diff-filename"></span>
      </div>
      <div class="diff-view" id="diff-content"></div>
    </div>
  </div>`
      : ""
  }
  <div id="logs-view" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
    <div class="logs-header">
      <span id="logs-count"></span>
      <button class="btn-dark icon-btn" id="logs-refresh" title="Refresh"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
    </div>
    <div class="logs-list" id="logs-list"></div>
  </div>
  <script>
    var SOUND_KEY = 'viagen_sound';
    var messagesEl = document.getElementById('messages');
    var inputEl = document.getElementById('input');
    var sendBtn = document.getElementById('send-btn');
    var resetBtn = document.getElementById('reset-btn');
    var soundBtn = document.getElementById('sound-btn');
    var activityBar = document.getElementById('activity-bar');
    var currentTextSpan = null;
    var isStreaming = false;
    var chatLog = []; // Array of { type: 'user'|'text'|'tool'|'error'|'summary', content: string }
    var unloading = false;
    var historyTimestamp = 0;
    var historyPoll = null;
    var healthTaskId = null;
    var healthProjectId = null;
    var sendStartTime = 0;
    var toolCount = 0;
    var activityTimer = null;
    var soundEnabled = false;

    var soundIcon = document.getElementById('sound-icon');
    var speakerOn = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>';
    var speakerOff = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';

    function updateSoundIcon() {
      soundIcon.innerHTML = soundEnabled ? speakerOn : speakerOff;
      soundBtn.classList.toggle('active', soundEnabled);
    }

    // Load sound preference
    try { soundEnabled = localStorage.getItem(SOUND_KEY) === '1'; } catch(e) {}
    updateSoundIcon();

    soundBtn.addEventListener('click', function() {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch(e) {}
      updateSoundIcon();
      // Play a short test beep on first enable
      if (soundEnabled) playDoneSound();
    });

    function playDoneSound() {
      if (!soundEnabled) return;
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch(e) {}
    }

    function scrollToBottom() {
      requestAnimationFrame(function() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }

    function formatDuration(ms) {
      if (ms < 1000) return ms + 'ms';
      var secs = Math.round(ms / 1000);
      if (secs < 60) return secs + 's';
      var mins = Math.floor(secs / 60);
      secs = secs % 60;
      return mins + 'm ' + secs + 's';
    }

    function updateActivityBar() {
      if (!isStreaming) return;
      var elapsed = formatDuration(Date.now() - sendStartTime);
      var parts = [elapsed];
      if (toolCount > 0) parts.push(toolCount + (toolCount === 1 ? ' action' : ' actions'));
      activityBar.textContent = parts.join(' · ');
    }

    function showActivity() {
      activityBar.style.display = 'block';
      activityBar.classList.remove('done');
      updateActivityBar();
      activityTimer = setInterval(updateActivityBar, 1000);
    }

    var sessionCostUsd = 0;
    var sessionInputTokens = 0;
    var sessionOutputTokens = 0;

    function formatCost(usd) {
      if (usd < 0.01) return '<$0.01';
      return '$' + usd.toFixed(2);
    }

    function formatTokens(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
      return String(n);
    }

    function hideActivity(usage) {
      if (activityTimer) { clearInterval(activityTimer); activityTimer = null; }
      var elapsed = formatDuration(Date.now() - sendStartTime);
      var parts = ['Done in ' + elapsed];
      if (toolCount > 0) parts.push(toolCount + (toolCount === 1 ? ' action' : ' actions'));
      if (usage && usage.costUsd != null) {
        parts.push(formatCost(usage.costUsd));
        sessionCostUsd += usage.costUsd;
        sessionInputTokens += (usage.inputTokens || 0);
        sessionOutputTokens += (usage.outputTokens || 0);
      }
      activityBar.textContent = parts.join(' \\u00b7 ');
      activityBar.classList.add('done');
      setTimeout(function() { activityBar.style.display = 'none'; }, 5000);
      // Update status bar with session total
      var costEl = document.getElementById('status-cost');
      if (costEl && sessionCostUsd > 0) {
        costEl.textContent = formatCost(sessionCostUsd) + ' (' + formatTokens(sessionInputTokens + sessionOutputTokens) + ' tokens)';
        costEl.style.display = '';
      }
    }
    window.addEventListener('beforeunload', function() { unloading = true; stopHistoryPolling(); });
    window.addEventListener('pagehide', function() { unloading = true; });
    try { window.parent.addEventListener('beforeunload', function() { unloading = true; }); } catch(e) {}

    function appendHistoryEntries(entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.timestamp) historyTimestamp = Math.max(historyTimestamp, entry.timestamp);
        if (entry.role === 'user' && entry.type === 'message') {
          chatLog.push({ type: 'user', content: entry.text });
          // First user message in task mode: show task link instead of raw prompt
          if (chatLog.filter(function(e) { return e.type === 'user'; }).length === 1 && healthTaskId) {
            var taskUrl = 'https://app.viagen.dev/projects/' + healthProjectId + '/tasks/' + healthTaskId;
            var div = document.createElement('div');
            div.className = 'msg msg-user';
            div.innerHTML = '<span class="label">Task</span><span class="text">Working on <a href="' + escapeHtml(taskUrl) + '" target="_blank" style="color:#2563eb;text-decoration:underline;">Via Task</a></span>';
            messagesEl.appendChild(div);
          } else {
            renderUserMessage(entry.text);
          }
        } else if (entry.role === 'assistant' && entry.type === 'text') {
          chatLog.push({ type: 'text', content: entry.text });
          closeToolGroup();
          closeAllTaskGroups('completed');
          renderTextBlock(entry.text);
        } else if (entry.role === 'assistant' && entry.type === 'tool_use') {
          if (entry.name === 'EnterPlanMode' || entry.name === 'ExitPlanMode') {
            // Silent — internal Claude workflow state, not shown in UI
          } else if (entry.name === 'TodoWrite' || entry.name === 'TaskOutput' || entry.name === 'AskUserQuestion') {
            // Silent — internal Claude bookkeeping, not shown in UI
          } else if (entry.name === 'Task') {
            var taskDesc = (entry.input && entry.input.description) ? entry.input.description : 'Task';
            chatLog.push({ type: 'tool', content: formatTool(entry.name, entry.input) });
            openTaskGroup(taskDesc, entry.toolUseId);
          } else {
            var label = formatTool(entry.name, entry.input);
            chatLog.push({ type: 'tool', content: label });
            renderToolBlock(entry.name, entry.input);
          }
        } else if (entry.role === 'assistant' && entry.type === 'task_started') {
          // task_started is a backup — task group may already be open from tool_use
          var tid = entry.toolUseId;
          if (tid && taskGroupMap[tid]) { /* already opened */ }
          else if (!currentTaskGroup) openTaskGroup(entry.text || 'Task', tid);
        } else if (entry.role === 'assistant' && entry.type === 'task_notification') {
          closeTaskGroup(entry.toolUseId, entry.status || 'completed', entry.text, null);
        }
        // Skip 'result' entries — they duplicate the last text block
      }
      closeToolGroup();
      closeAllTaskGroups('completed');
      if (entries.length > 0) messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function loadHistory() {
      try {
        var res = await fetch('/via/chat/history');
        var data = await res.json();
        if (!data.entries || data.entries.length === 0) return;
        chatLog = [];
        messagesEl.innerHTML = '';
        appendHistoryEntries(data.entries);
        markCommittedFiles();
      } catch(e) {}
    }

    async function pollHistory() {
      if (isStreaming) return;
      try {
        var res = await fetch('/via/chat/history?since=' + historyTimestamp);
        var data = await res.json();
        if (data.entries && data.entries.length > 0) {
          appendHistoryEntries(data.entries);
          markCommittedFiles();
        }
      } catch(e) {}
    }

    function startHistoryPolling() {
      stopHistoryPolling();
      historyPoll = setInterval(pollHistory, 1500);
    }

    function stopHistoryPolling() {
      if (historyPoll) { clearInterval(historyPoll); historyPoll = null; }
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function renderInline(text) {
      // Split by inline code to protect it from further processing
      var parts = text.split(/(\`[^\`]+\`)/g);
      var out = '';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.charAt(0) === '\`' && p.charAt(p.length - 1) === '\`') {
          out += '<span class="md-code">' + escapeHtml(p.slice(1, -1)) + '</span>';
        } else {
          var s = escapeHtml(p);
          // Bold
          s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
          // Italic (single * not preceded/followed by *)
          s = s.replace(/(?:^|[^*])\\*([^*]+)\\*(?:[^*]|$)/g, function(m, g) { return m.replace('*' + g + '*', '<em>' + g + '</em>'); });
          // Links [text](url)
          s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
          // Bare URLs
          s = s.replace(/(^|\\s)(https?:\\/\\/[^\\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
          out += s;
        }
      }
      return out;
    }

    function renderMarkdown(text) {
      // Split by fenced code blocks
      var parts = text.split(/(^\`\`\`[\\s\\S]*?^\`\`\`)/gm);
      // Fallback: if no code blocks matched, try non-multiline split
      if (parts.length === 1) {
        parts = text.split(/(\`\`\`[\\w]*\\n[\\s\\S]*?\\n\`\`\`)/g);
      }
      var html = '';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.indexOf('\`\`\`') === 0) {
          // Code block — strip fence and optional language tag
          var code = p.replace(/^\`\`\`\\w*\\n?/, '').replace(/\\n?\`\`\`$/, '');
          html += '<pre class="md-pre">' + escapeHtml(code) + '</pre>';
        } else {
          // Process line by line
          var lines = p.split('\\n');
          var lineHtml = [];
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j];
            // Headers
            if (line.match(/^### /)) { lineHtml.push('<strong class="md-h">' + renderInline(line.slice(4)) + '</strong>'); }
            else if (line.match(/^## /)) { lineHtml.push('<strong class="md-h">' + renderInline(line.slice(3)) + '</strong>'); }
            else if (line.match(/^# /)) { lineHtml.push('<strong class="md-h">' + renderInline(line.slice(2)) + '</strong>'); }
            // List items (- or *)
            else if (line.match(/^[-*] /)) { lineHtml.push('<span class="md-li">' + renderInline(line.slice(2)) + '</span>'); }
            // Normal line
            else { lineHtml.push(renderInline(line)); }
          }
          // Join lines, skipping <br> between consecutive list items
          var joined = '';
          for (var k = 0; k < lineHtml.length; k++) {
            if (k > 0) {
              var prevLi = lineHtml[k - 1].indexOf('md-li') !== -1;
              var currLi = lineHtml[k].indexOf('md-li') !== -1;
              if (!(prevLi && currLi)) joined += '<br>';
            }
            joined += lineHtml[k];
          }
          html += joined;
        }
      }
      return html;
    }

    function formatTool(name, input) {
      var i = input || {};
      switch (name) {
        case 'Read': return i.file_path ? 'Reading ' + i.file_path : 'Read';
        case 'Edit': return i.file_path ? 'Editing ' + i.file_path : 'Edit';
        case 'Write': return i.file_path ? 'Writing ' + i.file_path : 'Write';
        case 'Bash': return i.command ? '$ ' + i.command : 'Bash';
        case 'Glob': return i.pattern ? 'Finding ' + i.pattern : 'Glob';
        case 'Grep': return i.pattern ? 'Searching "' + i.pattern + '"' : 'Grep';
        case 'Task': return i.description ? 'Task: ' + i.description : 'Task';
        default: return name;
      }
    }

    function getToolCategory(name) {
      switch (name) {
        case 'Read': return 'reading';
        case 'Grep': case 'Glob': return 'searching';
        case 'Edit': case 'Write': return 'editing';
        case 'Bash': return 'commands';
        default: return 'other';
      }
    }

    function getCategoryLabel(category, count) {
      switch (category) {
        case 'reading': return count === 1 ? 'Reading file' : 'Reading files';
        case 'searching': return count === 1 ? 'Searching' : 'Searching';
        case 'editing': return count === 1 ? 'Editing file' : 'Editing files';
        case 'commands': return count === 1 ? 'Running command' : 'Running commands';
        default: return count === 1 ? 'Tool call' : 'Tool calls';
      }
    }

    function getFilename(filepath) {
      if (!filepath) return '';
      var parts = filepath.replace(/\\\\/g, '/').split('/');
      return parts[parts.length - 1] || filepath;
    }

    function formatToolChild(name, input) {
      var i = input || {};
      switch (name) {
        case 'Read': return i.file_path ? 'Reading ' + getFilename(i.file_path) : 'Read';
        case 'Edit': return i.file_path ? 'Editing ' + getFilename(i.file_path) : 'Edit';
        case 'Write': return i.file_path ? 'Writing ' + getFilename(i.file_path) : 'Write';
        case 'Bash': return i.command ? '$ ' + i.command : 'Bash';
        case 'Glob': return i.pattern ? 'Finding ' + i.pattern : 'Glob';
        case 'Grep': return i.pattern ? 'Searching "' + i.pattern + '"' : 'Grep';
        default: return name;
      }
    }

    function formatToolChildHtml(name, input) {
      var i = input || {};
      switch (name) {
        case 'Bash': return i.command ? '<code class="tool-cmd">' + escapeHtml(i.command) + '</code>' : 'Bash';
        default: return escapeHtml(formatToolChild(name, input));
      }
    }

    // ── Task group system ──
    var taskGroupMap = {};
    var currentTaskGroup = null;
    var checkSvgComplete = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    var checkSvgFailed = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    function getContainer() {
      if (currentTaskGroup) {
        return currentTaskGroup.querySelector('.task-group-body');
      }
      return messagesEl;
    }

    function openTaskGroup(description, toolUseId) {
      // Auto-close any orphaned task group that isn't tracked in the map
      if (currentTaskGroup && !currentTaskGroup._toolUseId) {
        closeTaskGroup(null, 'completed', null, null);
      }
      // Close any active tool group first
      closeToolGroup();
      currentTextSpan = null;

      var group = document.createElement('div');
      group.className = 'msg task-group running expanded';
      group.innerHTML = '<div class="task-group-header">' +
        '<span class="task-group-checkbox">' + checkSvgComplete + '</span>' +
        '<span class="task-group-title">' + escapeHtml(description) + '</span>' +
        '</div>' +
        '<div class="task-group-body"></div>';
      group._toolCount = 0;
      group._toolUseId = toolUseId || null;
      messagesEl.appendChild(group);

      group.querySelector('.task-group-header').addEventListener('click', function() {
        group.classList.toggle('expanded');
      });

      if (toolUseId) {
        taskGroupMap[toolUseId] = group;
      }
      currentTaskGroup = group;
      return group;
    }

    function findTaskGroup(toolUseId) {
      if (toolUseId && taskGroupMap[toolUseId]) {
        return taskGroupMap[toolUseId];
      }
      return currentTaskGroup;
    }

    function closeTaskGroup(toolUseId, status, summary, usage) {
      var group = findTaskGroup(toolUseId);
      if (!group) return;

      // If this is the active task group, close nested tool group
      if (group === currentTaskGroup) {
        closeToolGroup();
        currentTextSpan = null;
      }

      // Update checkbox state
      group.classList.remove('running');
      var statusClass = (status === 'failed') ? 'failed' : 'completed';
      group.classList.add(statusClass);

      // Swap the checkbox SVG
      var checkbox = group.querySelector('.task-group-checkbox');
      if (checkbox) {
        checkbox.innerHTML = (status === 'failed') ? checkSvgFailed : checkSvgComplete;
      }

      // Collapse
      group.classList.remove('expanded');

      // Clean up map
      var id = group._toolUseId;
      if (id && taskGroupMap[id]) {
        delete taskGroupMap[id];
      }
      if (group === currentTaskGroup) {
        currentTaskGroup = null;
      }
    }

    function closeAllTaskGroups(status) {
      // Close any remaining open task groups
      var ids = Object.keys(taskGroupMap);
      for (var i = 0; i < ids.length; i++) {
        closeTaskGroup(ids[i], status, null, null);
      }
      if (currentTaskGroup) {
        closeTaskGroup(null, status, null, null);
      }
    }

    function renderUserMessage(text) {
      var div = document.createElement('div');
      div.className = 'msg msg-user';
      div.innerHTML = '<span class="text">' + escapeHtml(text) + '</span>';
      messagesEl.appendChild(div);
    }

    function renderTextBlock(text) {
      currentTextSpan = null;
      var container = getContainer();
      var div = document.createElement('div');
      div.className = 'msg msg-assistant';
      div.innerHTML = '<span class="text stream-text"></span>';
      container.appendChild(div);
      div.querySelector('.stream-text').innerHTML = renderMarkdown(text);
    }

    var currentToolGroup = null;
    var currentToolGroupCount = 0;
    var currentToolGroupCategory = null;

    function getCategoryIcon(category) {
      switch (category) {
        case 'reading': return '<svg class="tool-group-icon icon-expanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><svg class="tool-group-icon icon-collapsed" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>';
        case 'searching': return '<svg class="tool-group-icon icon-expanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M10 12H3"/><path d="M10 18H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/></svg><svg class="tool-group-icon icon-collapsed" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
        case 'editing': return '<svg class="tool-group-icon icon-expanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.829 2.829 0 0 0-4-4L4 16v4"/><path d="m13.5 6.5 4 4"/><path d="M2 20h20"/></svg><svg class="tool-group-icon icon-collapsed" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.829 2.829 0 0 0-4-4L4 16v4"/><path d="m13.5 6.5 4 4"/></svg>';
        case 'commands': return '<svg class="tool-group-icon icon-expanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><polyline points="7 15 10 12 7 9"/><line x1="13" x2="17" y1="15" y2="15"/></svg><svg class="tool-group-icon icon-collapsed" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>';
        default: return '<svg class="tool-group-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>';
      }
    }

    function createToolGroup(category) {
      var container = getContainer();
      var group = document.createElement('div');
      group.className = 'msg tool-group expanded cat-' + category;
      group.innerHTML = '<div class="tool-group-header">' +
        getCategoryIcon(category) +
        '<span class="tool-group-label">' + escapeHtml(getCategoryLabel(category, 1)) + '</span>' +
        '</div>' +
        '<div class="tool-group-body"></div>';
      group._category = category;
      container.appendChild(group);

      group.querySelector('.tool-group-header').addEventListener('click', function() {
        group.classList.toggle('expanded');
        var isExpanded = group.classList.contains('expanded');
        var iconExp = group.querySelector('.icon-expanded');
        var iconCol = group.querySelector('.icon-collapsed');
        if (iconExp && iconCol) {
          iconExp.style.display = isExpanded ? '' : 'none';
          iconCol.style.display = isExpanded ? 'none' : '';
        }
      });

      return group;
    }

    function updateToolGroupLabel(group, count) {
      var label = group.querySelector('.tool-group-label');
      var cat = group._category || 'other';
      if (label) label.textContent = getCategoryLabel(cat, count);
    }

    function addToolItem(group, text, filePath, html) {
      var body = group.querySelector('.tool-group-body');
      if (!body) return null;

      var item = document.createElement('div');
      item.className = 'tool-group-item' + (filePath ? ' clickable' : '');
      if (html) { item.innerHTML = html; } else { item.textContent = text; }
      if (filePath) {
        item.dataset.filePath = filePath;
        item.addEventListener('click', function() { navigateToDiff(filePath); });
      }
      body.appendChild(item);

      return item;
    }

    function closeToolGroup() {
      if (currentToolGroup) {
        currentToolGroup.classList.remove('expanded');
        var iconExp = currentToolGroup.querySelector('.icon-expanded');
        var iconCol = currentToolGroup.querySelector('.icon-collapsed');
        if (iconExp && iconCol) {
          iconExp.style.display = 'none';
          iconCol.style.display = '';
        }
        currentToolGroup = null;
        currentToolGroupCount = 0;
        currentToolGroupCategory = null;
      }
    }

    function markCommittedFiles() {
      fetch('/via/git/status').then(function(res) { return res.json(); }).then(function(data) {
        var changedPaths = {};
        if (data && data.files) {
          data.files.forEach(function(f) { changedPaths[f.path] = true; });
        }
        var items = document.querySelectorAll('.tool-group-item[data-file-path], .task-tool-item[data-file-path]');
        for (var i = 0; i < items.length; i++) {
          var fp = items[i].dataset.filePath;
          if (fp && !changedPaths[fp]) {
            items[i].classList.remove('clickable');
            items[i].classList.add('committed');
          }
        }
      }).catch(function() {});
    }

    function navigateToDiff(filePath) {
      var changesTab = document.querySelector('[data-tab="changes"]');
      if (!changesTab) return;
      changesTab.click();
      // Wait for changes view to load, then open the diff
      setTimeout(function() {
        if (window._viagenOpenDiff) {
          window._viagenOpenDiff(filePath);
        }
      }, 300);
    }

    function renderToolBlock(name, input) {
      currentTextSpan = null;
      var category = getToolCategory(name);
      var childText = formatToolChild(name, input);
      var childHtml = formatToolChildHtml(name, input);
      var filePath = (name === 'Edit' || name === 'Write') && input && input.file_path ? input.file_path : null;

      if (currentTaskGroup || activeToolUseId) {
        // Inside a task group — render directly as a flat child
        var targetGroup = activeToolUseId ? findTaskGroup(activeToolUseId) : currentTaskGroup;
        if (!targetGroup) targetGroup = currentTaskGroup;
        var body = targetGroup ? targetGroup.querySelector('.task-group-body') : null;
        if (!body) { return; }
        var item = document.createElement('div');
        item.className = 'task-tool-item' + (filePath ? ' clickable' : '');
        item.innerHTML = childHtml;
        if (filePath) {
          item.dataset.filePath = filePath;
          item.addEventListener('click', function() { navigateToDiff(filePath); });
        }
        body.appendChild(item);
      } else if (currentToolGroup && currentToolGroupCategory === category) {
        // Already in a same-category group — just add to it
        currentToolGroupCount++;
        updateToolGroupLabel(currentToolGroup, currentToolGroupCount);
        addToolItem(currentToolGroup, childText, filePath, childHtml);
      } else {
        // Different category or no active group — close current, start new group
        closeToolGroup();
        currentToolGroup = createToolGroup(category);
        currentToolGroupCount = 1;
        currentToolGroupCategory = category;
        addToolItem(currentToolGroup, childText, filePath, childHtml);
      }
    }

    function renderErrorBlock(text) {
      var container = getContainer();
      var div = document.createElement('div');
      div.className = 'msg msg-error';
      div.textContent = text;
      container.appendChild(div);
    }

    function addUserMessage(text) {
      chatLog.push({ type: 'user', content: text });
      closeToolGroup();
      renderUserMessage(text);
      scrollToBottom();
    }

    function showThinkingIndicator() {
      removeThinkingIndicator();
      var container = getContainer();
      var div = document.createElement('div');
      div.className = 'msg msg-assistant thinking-indicator';
      div.id = 'thinking-indicator';
      div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
      container.appendChild(div);
      scrollToBottom();
    }

    function removeThinkingIndicator() {
      var el = document.getElementById('thinking-indicator');
      if (el) el.remove();
    }

    function appendText(text, parentToolUseId) {
      removeThinkingIndicator();
      var last = chatLog[chatLog.length - 1];
      if (last && last.type === 'text') {
        last.content += text;
      } else {
        chatLog.push({ type: 'text', content: text });
      }

      // Parent-level text (no parent) means the sub-agent is done
      if (currentTaskGroup && (parentToolUseId === null || parentToolUseId === undefined)) {
        closeAllTaskGroups('completed');
      }

      closeToolGroup();

      if (!currentTextSpan) {
        var container = getContainer();
        var div = document.createElement('div');
        div.className = 'msg msg-assistant';
        div.innerHTML = '<span class="text stream-text"></span>';
        container.appendChild(div);
        currentTextSpan = div.querySelector('.stream-text');
      }
      var fullText = chatLog[chatLog.length - 1].content;
      currentTextSpan.innerHTML = renderMarkdown(fullText);
      scrollToBottom();
    }

    var activeToolUseId = null;

    function addToolBlock(name, input, toolUseId) {
      removeThinkingIndicator();
      currentTextSpan = null;
      if (name === 'EnterPlanMode' || name === 'ExitPlanMode') {
        // Silent — internal Claude workflow state, not shown in UI
        return;
      }
      if (name === 'TodoWrite' || name === 'TaskOutput' || name === 'AskUserQuestion') {
        // Silent — internal Claude bookkeeping, not shown in UI
        return;
      }
      if (name === 'Task') {
        var taskDesc = (input && input.description) ? input.description : 'Task';
        chatLog.push({ type: 'tool', content: formatTool(name, input) });
        openTaskGroup(taskDesc, toolUseId);
        scrollToBottom();
        return;
      }
      var label = formatTool(name, input);
      chatLog.push({ type: 'tool', content: label });

      renderToolBlock(name, input);
      scrollToBottom();
    }

    function renderToolResult(text) {
      // Results are not displayed at the item level; consumed silently
    }

    function addToolResult(text) {
      chatLog.push({ type: 'tool_result', content: text });

      renderToolResult(text);
    }

    function updateLastGroupSummary(summary) {
      if (!summary) return;
      // If inside a task group, update the task group title with the summary
      if (currentTaskGroup) {
        var titleEl = currentTaskGroup.querySelector('.task-group-title');
        if (titleEl) titleEl.textContent = summary;
        return;
      }
      // Otherwise find the most recently closed tool-group and update its label
      var groups = messagesEl.querySelectorAll('.tool-group');
      if (groups.length === 0) return;
      var lastGroup = groups[groups.length - 1];
      var label = lastGroup.querySelector('.tool-group-label');
      if (label) label.textContent = summary;
    }

    function addErrorBlock(text) {
      chatLog.push({ type: 'error', content: text });
      closeToolGroup();
      renderErrorBlock(text);
      scrollToBottom();
    }

    var maxInputHeight = Math.floor(13 * 1.5 * 8); // 8 lines
    function autoResize() {
      inputEl.style.height = 'auto';
      var newHeight = Math.min(inputEl.scrollHeight, maxInputHeight);
      inputEl.style.height = newHeight + 'px';
      inputEl.style.overflow = inputEl.scrollHeight > maxInputHeight ? 'auto' : 'hidden';
      scrollToBottom();
    }
    function updateSendActive() {
      sendBtn.classList.toggle('active', inputEl.value.trim().length > 0 && !isStreaming);
    }
    inputEl.addEventListener('input', function() { autoResize(); updateSendActive(); });

    var currentAbort = null;
    function setStreaming(v) {
      isStreaming = v;
      inputEl.disabled = v;
      document.getElementById('input-wrap').classList.toggle('disabled', v);
      if (v) {
        sendBtn.disabled = false;
        sendBtn.classList.add('stop');
        sendBtn.classList.remove('active');
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
      } else {
        sendBtn.classList.remove('stop');
        sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
        currentAbort = null;
      }
      updateSendActive();
      if (v) stopHistoryPolling();
      else startHistoryPolling();
    }

    async function sendRaw(text) {
      var abort = new AbortController();
      currentAbort = abort;
      try {
        var res = await fetch('/via/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
          signal: abort.signal,
        });

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var lastUsage = null;

        while (true) {
          var result = await reader.read();
          if (result.done) break;

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (var i = 0; i < lines.length; i++) {
            if (!lines[i].startsWith('data: ')) continue;
            try {
              var data = JSON.parse(lines[i].slice(6));
              if (data.type === 'text') appendText(data.text, data.parentToolUseId);
              else if (data.type === 'tool_use') { toolCount++; updateActivityBar(); activeToolUseId = data.toolUseId || null; addToolBlock(data.name, data.input, data.toolUseId); }
              else if (data.type === 'tool_result') addToolResult(data.text);
              else if (data.type === 'error') addErrorBlock(data.text);
              else if (data.type === 'task_started') {
                var tid = data.toolUseId;
                if (tid && taskGroupMap[tid]) { /* already opened by tool_use */ }
                else if (!currentTaskGroup) { openTaskGroup(data.description || 'Task', tid); }
                scrollToBottom();
              }
              else if (data.type === 'task_notification') { closeTaskGroup(data.toolUseId, data.status, data.summary, data.taskUsage); scrollToBottom(); }
              else if (data.type === 'tool_use_summary') { updateLastGroupSummary(data.summary); }
              else if (data.type === 'done') lastUsage = data;
            } catch (e) {}
          }
        }
      } catch (e) {
        if (abort.signal.aborted) {
          // User cancelled — not an error
        } else if (!unloading) {
          addErrorBlock('Connection failed');
        }
      }

      removeThinkingIndicator();
      closeToolGroup();
      closeAllTaskGroups('completed');
      hideActivity(lastUsage);
      if (!abort.signal.aborted) playDoneSound();
      historyTimestamp = Date.now();
      setStreaming(false);
      markCommittedFiles();
      inputEl.focus();
    }

    async function send() {
      var text = inputEl.value.trim();
      if (!text || isStreaming) return;

      var welcomeMsg = document.getElementById('welcome-msg');
      if (welcomeMsg) welcomeMsg.remove();
      addUserMessage(text);
      inputEl.value = '';
      inputEl.style.height = 'auto';
      updateSendActive();
      setStreaming(true);
      currentTextSpan = null;
      sendStartTime = Date.now();
      toolCount = 0;
      showActivity();
      showThinkingIndicator();

      await sendRaw(text);
    }

    sendBtn.addEventListener('click', function() {
      if (isStreaming && currentAbort) {
        currentAbort.abort();
        return;
      }
      send();
    });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    resetBtn.addEventListener('click', async function () {
      await fetch('/via/chat/reset', { method: 'POST' });
      chatLog = [];

      messagesEl.innerHTML = '';
      currentTextSpan = null;
      inputEl.focus();
    });
    // ── Drag & drop file upload ──
    var chatView = document.getElementById('chat-view');
    var dropOverlay = document.getElementById('drop-overlay');
    var dragCounter = 0;
    chatView.addEventListener('dragenter', function(e) {
      e.preventDefault();
      dragCounter++;
      dropOverlay.classList.add('visible');
    });
    chatView.addEventListener('dragleave', function(e) {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('visible'); }
    });
    chatView.addEventListener('dragover', function(e) { e.preventDefault(); });
    function readFileAsBase64(file) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function() {
          var result = reader.result;
          resolve(result.split(',')[1] || result);
        };
        reader.readAsDataURL(file);
      });
    }
    var MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
    async function uploadFiles(files) {
      if (!files || !files.length) return;
      var uploaded = [];
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > MAX_UPLOAD_SIZE) {
          addErrorBlock(file.name + ' is too large (max 10MB)');
          continue;
        }
        var isText = file.type.startsWith('text/') || /\\.(json|md|txt|csv|js|ts|jsx|tsx|css|html|xml|yaml|yml|toml|sh|py|rb|go|rs|sql|env|log|cfg|ini|conf)$/i.test(file.name);
        try {
          var payload;
          if (isText) {
            payload = { path: '.viagen/uploads/' + file.name, content: await file.text() };
          } else {
            payload = { path: '.viagen/uploads/' + file.name, content: await readFileAsBase64(file), encoding: 'base64' };
          }
          await fetch('/via/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          uploaded.push(file.name);
        } catch (err) {
          addErrorBlock('Failed to upload ' + file.name);
        }
      }
      if (uploaded.length > 0) {
        var msg = uploaded.length === 1
          ? 'I just uploaded a file: .viagen/uploads/' + uploaded[0] + '. Take a look and let me know what you think.'
          : 'I just uploaded ' + uploaded.length + ' files to .viagen/uploads/: ' + uploaded.join(', ') + '. Take a look and let me know what you think.';
        inputEl.value = msg;
        send();
      }
    }
    chatView.addEventListener('drop', async function(e) {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('visible');
      uploadFiles(e.dataTransfer ? e.dataTransfer.files : []);
    });

    // ── Paperclip file picker ──
    var fileInput = document.getElementById('file-input');
    document.getElementById('attach-btn').addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() { uploadFiles(fileInput.files); fileInput.value = ''; });

    // ── View mode detection ──
    var viewMode = 'overlay';
    if (window.self === window.top) viewMode = 'standalone';

    var expandIcon = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
    var contractIcon = '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';

    function updateViewToggle() {
      var icon = document.getElementById('view-toggle-icon');
      var btn = document.getElementById('view-toggle');
      if (viewMode === 'standalone') {
        icon.innerHTML = expandIcon;
        btn.title = 'Split view';
      } else {
        icon.innerHTML = contractIcon;
        btn.title = 'Full screen';
      }
    }

    document.getElementById('view-preview').addEventListener('click', function() {
      if (viewMode === 'overlay') return;
      var target = (window.self !== window.top) ? window.top : window;
      target.location.href = '/';
    });
    document.getElementById('view-toggle').addEventListener('click', function() {
      var target = (window.self !== window.top) ? window.top : window;
      if (viewMode === 'standalone') {
        target.location.href = '/via/iframe';
      } else {
        target.location.href = '/via/ui';
      }
    });

    updateViewToggle();

    // ── Commit + Revert buttons (inside Changes summary bar) ──
    var commitBtn = document.getElementById('commit-btn');
    var revertBtn = document.getElementById('revert-btn');

    if (commitBtn) {
      commitBtn.addEventListener('click', function() {
        if (isStreaming) return;
        var chatTab = document.querySelector('.tab[data-tab="chat"]');
        if (chatTab && !chatTab.classList.contains('active')) chatTab.click();
        inputEl.value = 'Commit all changes and push to the active branch.';
        send();
      });
    }

    if (revertBtn) {
      revertBtn.addEventListener('click', function() {
        if (isStreaming) return;
        if (!confirm('Revert all changes? This cannot be undone.')) return;
        var chatTab = document.querySelector('.tab[data-tab="chat"]');
        if (chatTab && !chatTab.classList.contains('active')) chatTab.click();
        inputEl.value = 'Run git checkout -- . && git clean -fd to revert all changes.';
        send();
      });
    }

    // Accept messages from parent (e.g. "Fix This Error" button)
    window.addEventListener('message', function(ev) {
      if (ev.data && ev.data.type === 'viagen:send' && ev.data.message) {
        inputEl.value = ev.data.message;
        send();
      }
      // Detect iframe split-view mode
      if (ev.data && ev.data.type === 'viagen:context' && ev.data.iframe) {
        viewMode = 'iframe';
        updateViewToggle();
      }
    });

    function startSessionTimer(expiresAt) {
      var timerEl = document.getElementById('session-timer');
      function tick() {
        var remaining = expiresAt - Math.floor(Date.now() / 1000);
        if (remaining <= 0) {
          timerEl.textContent = 'expired';
          timerEl.className = 'session-timer critical';
          return;
        }
        var mins = Math.floor(remaining / 60);
        var secs = remaining % 60;
        timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
        if (remaining <= 120) timerEl.className = 'session-timer critical';
        else if (remaining <= 300) timerEl.className = 'session-timer warning';
        else timerEl.className = 'session-timer';
        setTimeout(tick, 1000);
      }
      tick();
    }

    // Health check — show status and disable input if not configured
    fetch('/via/health')
      .then(function(r) { return r.json(); })
      .then(async function(data) {
        var dot = document.getElementById('status-dot');
        var banner = document.getElementById('setup-banner');
        if (data.configured) {
          dot.className = 'status-dot ok';
        } else {
          dot.className = 'status-dot error';
          inputEl.disabled = true;
          sendBtn.disabled = true;
          inputEl.placeholder = 'Not configured \\u2014 run npx viagen setup';
        }
        // Show checklist banner if anything is missing
        if (data.missing && data.missing.length > 0) {
          banner.style.display = 'block';
          var items = data.missing.map(function(v) {
            var isSet = data.missing.indexOf(v) === -1;
            return '<div style="font-family:Geist Mono,ui-monospace,monospace;font-size:11px;padding:1px 0;">' +
              '<span style="color:' + (isSet ? '#16a34a' : '#dc2626') + ';margin-right:6px;">' + (isSet ? '&#10003;' : '&#10007;') + '</span>' +
              '<span style="color:#525252;">' + escapeHtml(v) + '</span></div>';
          });
          banner.innerHTML = '<div style="margin-bottom:6px;">Missing environment variables:</div>' +
            items.join('') +
            '<div style="margin-top:8px;">Run <code>npx viagen setup</code> to configure, then restart.</div>';
        }
        if (data.session) startSessionTimer(data.session.expiresAt);

        // Store task context for history rendering
        healthTaskId = data.taskId || null;
        healthProjectId = data.projectId || data.environmentId || null;

        // Load chat history from server (source of truth)
        await loadHistory();
        startHistoryPolling();

        // Show welcome message if no chat history
        if (chatLog.length === 0 && !data.prompt) {
          var welcome = document.createElement('div');
          welcome.className = 'msg msg-assistant';
          welcome.id = 'welcome-msg';
          welcome.innerHTML = '<span class="text">\uD83D\uDC4B Amigo! What are you waiting for? Lets get started.</span>';
          messagesEl.appendChild(welcome);
        }

        // Check for changes + branch info on first load
        if (data.git) {
          fetch('/via/git/status').then(function(r) { return r.json(); }).then(function(d) {
            var dot = document.getElementById('changes-dot');
            if (d.files && d.files.length > 0 && dot) dot.style.display = 'block';
            // Update status bar diff summary
            var statusDiff = document.getElementById('status-diff');
            if (statusDiff && (d.insertions || d.deletions)) {
              statusDiff.innerHTML = '<span class="d-add">+' + d.insertions + '</span> <span class="d-del">-' + d.deletions + '</span>';
            }
          }).catch(function() {});

          fetch('/via/git/branch').then(function(r) { return r.json(); }).then(function(d) {
            if (!d.branch) return;
            var branchUrl = d.pr ? d.pr.url : (d.remoteUrl ? d.remoteUrl + '/tree/' + d.branch : null);
            // Status bar
            var statusBar = document.getElementById('status-bar');
            var statusBranch = document.getElementById('status-branch');
            if (statusBar && statusBranch) {
              statusBranch.textContent = '\\u2387 ' + d.branch;
              if (branchUrl) {
                statusBranch.addEventListener('click', function() { window.open(branchUrl, '_blank'); });
              }
            }
            // Status diff click → switch to changes tab
            var statusDiff = document.getElementById('status-diff');
            if (statusDiff) {
              statusDiff.addEventListener('click', function() {
                var changesTab = document.querySelector('[data-tab="changes"]');
                if (changesTab) changesTab.click();
              });
            }
            // Changes tab header — branch name
            var changesHeader = document.getElementById('changes-header');
            var changesBranchName = document.getElementById('changes-branch-name');
            var changesPrLink = document.getElementById('changes-pr-link');
            if (changesHeader && changesBranchName) {
              changesHeader.style.display = 'flex';
              changesBranchName.textContent = '\\u2387 ' + d.branch;
              if (branchUrl && !d.pr) {
                changesBranchName.innerHTML = '<a href="' + branchUrl + '" target="_blank">' + '\\u2387 ' + escapeHtml(d.branch) + '</a>';
              }
            }
            if (changesPrLink && d.pr) {
              changesPrLink.style.display = '';
              changesPrLink.href = d.pr.url;
              changesPrLink.textContent = '#' + d.pr.number + ' ' + d.pr.title;
              var sepPr = document.getElementById('changes-sep-pr');
              if (sepPr) sepPr.style.display = '';
            }
          }).catch(function() {});
        }

        // Check for viagen updates — show as system message in chat
        fetch('/via/version').then(function(r) { return r.json(); }).then(function(v) {
          if (v.updateAvailable && v.latest) {
            var bannerContainer = document.getElementById('update-banner-container');
            var card = document.createElement('div');
            card.className = 'update-banner';
            card.innerHTML = '<svg class="system-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
              '<span class="system-text">viagen <strong>' + escapeHtml(v.latest) + '</strong> is available</span>' +
              '<button class="system-action" id="update-btn">Update</button>' +
              '<button class="system-dismiss" id="update-dismiss">&times;</button>';
            bannerContainer.appendChild(card);
            document.getElementById('update-btn').addEventListener('click', function() {
              card.remove();
              inputEl.value = 'Update viagen to v' + v.latest + ' (npm install viagen@' + v.latest + ') and restart the dev server.';
              send();
            });
            document.getElementById('update-dismiss').addEventListener('click', function() {
              card.remove();
            });
          }
        }).catch(function() {});

        // Only auto-send prompt if no history exists (first boot)
        if (data.prompt && data.configured && chatLog.length === 0) {
          if (data.taskId) {
            // Task mode: show link instead of raw prompt
            var taskUrl = 'https://app.viagen.dev/projects/' + (data.projectId || data.environmentId) + '/tasks/' + data.taskId;
            var div = document.createElement('div');
            div.className = 'msg msg-user';
            div.innerHTML = '<span class="label">Task</span><span class="text">Working on <a href="' + escapeHtml(taskUrl) + '" target="_blank" style="color:#2563eb;text-decoration:underline;">Via Task</a></span>';
            messagesEl.appendChild(div);
            scrollToBottom();
            // Send the prompt silently (don't show it as a user message)
            showActivity();
            setStreaming(true);
            sendStartTime = Date.now();
            toolCount = 0;
            sendRaw(data.prompt);
          } else {
            inputEl.value = data.prompt;
            send();
          }
        }
      })
      .catch(function() {
        document.getElementById('status-dot').className = 'status-dot error';
      });

    // ── Tab switching ──
    ${
      hasTabs
        ? `
    (function() {
      var chatView = document.getElementById('chat-view');
      var filesView = document.getElementById('files-view');
      var changesView = document.getElementById('changes-view');
      var logsView = document.getElementById('logs-view');
      var tabs = document.querySelectorAll('.tab');

      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          tabs.forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var target = tab.dataset.tab;
          chatView.style.display = target === 'chat' ? 'flex' : 'none';
          if (filesView) filesView.style.display = target === 'files' ? 'flex' : 'none';
          if (changesView) changesView.style.display = target === 'changes' ? 'flex' : 'none';
          if (logsView) logsView.style.display = target === 'logs' ? 'flex' : 'none';
          if (target === 'files' && window._viagenLoadFiles) window._viagenLoadFiles();
          if (target === 'changes' && window._viagenLoadChanges) window._viagenLoadChanges();
          if (target === 'logs' && window._viagenLoadLogs) window._viagenLoadLogs();
          if (target !== 'logs' && window._viagenStopLogPolling) window._viagenStopLogPolling();
          if (target === 'chat') inputEl.focus();
        });
      });
    })();
    `
        : ""
    }

    // ── File editor panel ──
    ${editor ? editor.js : ""}

    // ── Changes panel (git diff) ──
    ${
      hasGit
        ? `
    (function() {
      var changesListView = document.getElementById('changes-list-view');
      var changesDiffView = document.getElementById('changes-diff-view');
      var changesListEl = document.getElementById('changes-list');
      var diffContent = document.getElementById('diff-content');
      var diffFilename = document.getElementById('diff-filename');
      var changesTab = document.getElementById('changes-tab');
      var changesHeader = document.getElementById('changes-header');

      var changesDotEl = document.getElementById('changes-dot');
      function updateChangesDot(hasChanges) {
        if (changesDotEl) changesDotEl.style.display = hasChanges ? 'block' : 'none';
      }

      window._viagenLoadChanges = loadChanges;
      window._viagenOpenDiff = openDiff;

      async function loadChanges() {
        changesListView.style.display = 'block';
        changesDiffView.style.display = 'none';
        changesListEl.innerHTML = '<div style="padding:16px;color:#a3a3a3;font-size:12px;font-family:Geist Mono,ui-monospace,monospace;">Loading...</div>';
        try {
          var res = await fetch('/via/git/status');
          var data = await res.json();
          if (!data.git) {
            changesListEl.innerHTML = '<div class="changes-empty">Not a git repository</div>';
            updateChangesDot(false);
            return;
          }
          renderSummary(data);
          renderChanges(data.files);
        } catch(e) {
          changesListEl.innerHTML = '<div style="padding:16px;color:#dc2626;font-size:12px;">Failed to load changes</div>';
        }
      }

      var changesStatsEl = document.getElementById('changes-stats');

      function renderSummary(data) {
        var ins = data.insertions || 0;
        var del = data.deletions || 0;
        var count = data.files ? data.files.length : 0;
        var sepStats = document.getElementById('changes-sep-stats');
        if (count === 0) { changesStatsEl.innerHTML = ''; if (sepStats) sepStats.style.display = 'none'; changesHeader.style.display = 'flex'; return; }
        changesHeader.style.display = 'flex';
        if (sepStats) sepStats.style.display = '';
        var statParts = [];
        statParts.push(count + (count === 1 ? ' file' : ' files'));
        var delta = '';
        if (ins > 0) delta += '<span class="stat-add">+' + ins + '</span>';
        if (ins > 0 && del > 0) delta += ' ';
        if (del > 0) delta += '<span class="stat-del">-' + del + '</span>';
        if (delta) statParts.push(delta);
        changesStatsEl.innerHTML = statParts.join(' <span class="changes-header-sep">&middot;</span> ');
        // Keep status bar diff in sync
        var statusDiff = document.getElementById('status-diff');
        if (statusDiff) {
          if (ins || del) {
            statusDiff.innerHTML = '<span class="d-add">+' + ins + '</span> <span class="d-del">-' + del + '</span>';
          } else {
            statusDiff.innerHTML = '';
          }
        }
      }

      function renderChanges(files) {
        changesListEl.innerHTML = '';
        updateChangesDot(files.length > 0);
        if (files.length === 0) {
          changesListEl.innerHTML = '<div class="changes-empty">No changes</div>';
          return;
        }
        files.forEach(function(f) {
          var item = document.createElement('div');
          item.className = 'changes-file';
          var dotClass = f.status === '?' ? 'q' : f.status;
          var statusLabel = f.status === '?' ? 'Untracked' : f.status === 'M' ? 'Modified' : f.status === 'A' ? 'Added' : f.status === 'D' ? 'Deleted' : f.status === 'R' ? 'Renamed' : f.status;
          var deltaHtml = '';
          if (f.insertions > 0 || f.deletions > 0) {
            deltaHtml = '<span class="file-delta">' +
              (f.insertions > 0 ? '<span class="d-add">+' + f.insertions + '</span>' : '') +
              (f.deletions > 0 ? '<span class="d-del">-' + f.deletions + '</span>' : '') +
              '</span>';
          }
          item.innerHTML = '<span class="changes-dot ' + dotClass + '" title="' + statusLabel + '"></span>' +
            '<span class="file-path" title="' + escapeHtml(f.path) + '">' + escapeHtml(f.path) + '</span>' +
            deltaHtml;
          item.addEventListener('click', function() { openDiff(f.path); });
          changesListEl.appendChild(item);
        });
      }

      async function openDiff(path) {
        changesListView.style.display = 'none';
        changesHeader.style.display = 'none';
        changesDiffView.style.display = 'flex';
        diffFilename.textContent = path;
        diffContent.innerHTML = '<div style="padding:16px;color:#a3a3a3;font-size:12px;font-family:Geist Mono,ui-monospace,monospace;">Loading diff...</div>';

        try {
          var res = await fetch('/via/git/diff?path=' + encodeURIComponent(path));
          var data = await res.json();
          renderDiff(data.diff);
        } catch(e) {
          diffContent.innerHTML = '<div style="padding:16px;color:#dc2626;font-size:12px;">Failed to load diff</div>';
        }
      }

      function renderDiff(diff) {
        diffContent.innerHTML = '';
        if (!diff) {
          diffContent.innerHTML = '<div class="changes-empty">No diff available</div>';
          return;
        }
        var lines = diff.split('\\n');
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          var div = document.createElement('div');
          div.className = 'diff-line';
          if (line.charAt(0) === '+' && !line.startsWith('+++')) {
            div.className += ' diff-add';
          } else if (line.charAt(0) === '-' && !line.startsWith('---')) {
            div.className += ' diff-del';
          } else if (line.startsWith('@@')) {
            div.className += ' diff-hunk';
          } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
            div.className += ' diff-meta';
          } else {
            div.className += ' diff-ctx';
          }
          div.textContent = line;
          diffContent.appendChild(div);
        }
      }

      // Back button
      document.getElementById('diff-back').addEventListener('click', function() {
        changesDiffView.style.display = 'none';
        changesListView.style.display = 'block';
        changesHeader.style.display = 'flex';
      });

    })();
    `
        : ""
    }

    // ── Logs panel ──
    function timeAgo(ts) {
      var diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 5) return 'now';
      if (diff < 60) return diff + 's ago';
      var mins = Math.floor(diff / 60);
      if (mins < 60) return mins + 'm ago';
      var hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      var days = Math.floor(hrs / 24);
      return days + 'd ago';
    }

    (function() {
      var logsList = document.getElementById('logs-list');
      var logsCount = document.getElementById('logs-count');
      var logsRefresh = document.getElementById('logs-refresh');
      var lastTimestamp = 0;
      var pollInterval = null;

      window._viagenLoadLogs = loadLogs;
      window._viagenStopLogPolling = stopPolling;

      async function loadLogs() {
        lastTimestamp = 0;
        logsList.innerHTML = '';
        await fetchLogs();
        startPolling();
      }

      async function fetchLogs() {
        try {
          var url = '/via/logs';
          if (lastTimestamp > 0) url += '?since=' + lastTimestamp;
          var res = await fetch(url);
          var data = await res.json();
          if (data.entries.length === 0 && lastTimestamp === 0) {
            logsList.innerHTML = '<div class="logs-empty">No logs yet</div>';
            logsCount.textContent = '0 entries';
            return;
          }
          if (data.entries.length > 0) {
            // Remove empty placeholder if present
            var empty = logsList.querySelector('.logs-empty');
            if (empty) empty.remove();

            for (var i = 0; i < data.entries.length; i++) {
              var entry = data.entries[i];
              var div = document.createElement('div');
              div.className = 'log-entry' + (entry.level !== 'info' ? ' ' + entry.level : '');
              var iconSvg = entry.level === 'error'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
                : entry.level === 'warn'
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
              div.innerHTML = '<span class="log-icon">' + iconSvg + '</span><span class="log-text">' + escapeHtml(entry.text) + '</span><span class="log-time" data-ts="' + entry.timestamp + '">' + timeAgo(entry.timestamp) + '</span>';
              logsList.appendChild(div);
              lastTimestamp = Math.max(lastTimestamp, entry.timestamp);
            }
            // Auto-scroll to bottom
            logsList.scrollTop = logsList.scrollHeight;
          }
          // Update count
          var total = logsList.querySelectorAll('.log-entry').length;
          logsCount.textContent = total + (total === 1 ? ' entry' : ' entries');
        } catch(e) {
          // Silent fail on poll
        }
      }

      // Update relative timestamps every 30s
      var timeAgoInterval = null;
      function updateTimeAgos() {
        var els = logsList.querySelectorAll('.log-time[data-ts]');
        for (var i = 0; i < els.length; i++) {
          els[i].textContent = timeAgo(parseInt(els[i].getAttribute('data-ts'), 10));
        }
      }

      function startPolling() {
        stopPolling();
        pollInterval = setInterval(fetchLogs, 3000);
        if (timeAgoInterval) clearInterval(timeAgoInterval);
        timeAgoInterval = setInterval(updateTimeAgos, 30000);
      }

      function stopPolling() {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }

      logsRefresh.addEventListener('click', function() {
        lastTimestamp = 0;
        logsList.innerHTML = '';
        fetchLogs();
      });
    })();
  </script>
</body>
</html>`;
}
