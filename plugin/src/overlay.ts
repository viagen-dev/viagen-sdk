export function buildPreviewScript(): string {
  return /* js */ `
(function() {
  if (document.getElementById('viagen-preview-btn')) return;

  var btn = document.createElement('button');
  btn.id = 'viagen-preview-btn';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span style="vertical-align:middle;">Feedback</span>';
  btn.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:99998;padding:8px 14px;background:#ffffff;color:#525252;border:1px solid #e5e5e5;border-radius:20px;font-size:12px;font-weight:500;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;letter-spacing:-0.01em;transition:border-color 0.15s,color 0.15s,box-shadow 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);display:flex;align-items:center;';
  btn.onmouseenter = function() { btn.style.borderColor = '#d4d4d4'; btn.style.color = '#171717'; btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1),0 1px 3px rgba(0,0,0,0.06)'; };
  btn.onmouseleave = function() { btn.style.borderColor = '#e5e5e5'; btn.style.color = '#525252'; btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)'; };

  btn.addEventListener('click', function() { openFeedback(); });
  document.body.appendChild(btn);

  function loadHtml2Canvas() {
    return new Promise(function(resolve, reject) {
      if (typeof window.html2canvas !== 'undefined') { resolve(window.html2canvas); return; }
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function() { resolve(window.html2canvas); };
      s.onerror = function() { reject(new Error('Failed to load html2canvas')); };
      document.head.appendChild(s);
    });
  }

  function openFeedback() {
    btn.disabled = true;
    var origHTML = btn.innerHTML;
    btn.innerHTML = '<span style="vertical-align:middle;">Capturing\u2026</span>';

    loadHtml2Canvas().then(function(h2c) {
      return h2c(document.documentElement, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });
    }).then(function(canvas) {
      var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      btn.disabled = false;
      btn.innerHTML = origHTML;
      showModal(dataUrl);
    }).catch(function(e) {
      console.warn('[viagen-preview] Screenshot failed:', e);
      btn.disabled = false;
      btn.innerHTML = origHTML;
      showModal(null);
    });
  }

  function showModal(screenshotDataUrl) {
    var overlay = document.createElement('div');
    overlay.id = 'viagen-preview-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;';

    var modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:560px;width:calc(100% - 32px);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);box-sizing:border-box;';

    /* Header */
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
    var title = document.createElement('h2');
    title.textContent = 'Send Feedback';
    title.style.cssText = 'margin:0;font-size:16px;font-weight:600;color:#171717;';
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:none;border:none;font-size:22px;cursor:pointer;color:#a3a3a3;padding:0;line-height:1;transition:color 0.15s;';
    closeBtn.onmouseenter = function() { closeBtn.style.color = '#171717'; };
    closeBtn.onmouseleave = function() { closeBtn.style.color = '#a3a3a3'; };
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    /* Screenshot preview */
    if (screenshotDataUrl) {
      var imgWrap = document.createElement('div');
      imgWrap.style.cssText = 'margin-bottom:16px;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;background:#f5f5f5;';
      var img = document.createElement('img');
      img.src = screenshotDataUrl;
      img.style.cssText = 'width:100%;display:block;max-height:220px;object-fit:cover;object-position:top;';
      imgWrap.appendChild(img);
      modal.appendChild(imgWrap);
    } else {
      var pageRef = document.createElement('div');
      pageRef.textContent = 'Page: ' + window.location.href;
      pageRef.style.cssText = 'margin-bottom:16px;padding:10px 12px;background:#f5f5f5;border-radius:8px;font-size:12px;color:#737373;word-break:break-all;';
      modal.appendChild(pageRef);
    }

    /* Textarea */
    var label = document.createElement('label');
    label.textContent = 'Describe your feedback';
    label.style.cssText = 'display:block;font-size:13px;font-weight:500;color:#525252;margin-bottom:8px;';
    modal.appendChild(label);

    var textarea = document.createElement('textarea');
    textarea.placeholder = 'e.g. The button color looks off, the layout breaks on mobile\u2026';
    textarea.style.cssText = 'width:100%;min-height:96px;border:1px solid #e5e5e5;border-radius:8px;padding:12px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;outline:none;transition:border-color 0.15s;color:#171717;';
    textarea.onfocus = function() { textarea.style.borderColor = '#a3a3a3'; };
    textarea.onblur = function() { textarea.style.borderColor = '#e5e5e5'; };
    modal.appendChild(textarea);

    /* Status */
    var statusEl = document.createElement('div');
    statusEl.style.cssText = 'margin-top:10px;font-size:13px;color:#737373;display:none;min-height:20px;';
    modal.appendChild(statusEl);

    /* Buttons */
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;justify-content:flex-end;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:9px 16px;background:#f5f5f5;color:#525252;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:background 0.15s;';
    cancelBtn.onmouseenter = function() { cancelBtn.style.background = '#e5e5e5'; };
    cancelBtn.onmouseleave = function() { cancelBtn.style.background = '#f5f5f5'; };
    cancelBtn.onclick = function() { overlay.remove(); };
    var submitBtn = document.createElement('button');
    submitBtn.textContent = 'Create Task';
    submitBtn.style.cssText = 'padding:9px 16px;background:#171717;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:background 0.15s;';
    submitBtn.onmouseenter = function() { if (!submitBtn.disabled) submitBtn.style.background = '#404040'; };
    submitBtn.onmouseleave = function() { if (!submitBtn.disabled) submitBtn.style.background = '#171717'; };

    submitBtn.addEventListener('click', function() {
      var feedback = textarea.value.trim();
      if (!feedback) {
        textarea.style.borderColor = '#ef4444';
        textarea.focus();
        return;
      }
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      submitBtn.textContent = 'Creating\u2026';
      submitBtn.style.opacity = '0.7';
      statusEl.style.display = 'block';
      statusEl.style.color = '#737373';
      statusEl.textContent = 'Submitting your feedback\u2026';

      var payload = {
        prompt: feedback,
        pageUrl: window.location.href,
        screenshot: screenshotDataUrl || undefined,
      };

      fetch('/via/preview/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function(res) {
        if (!res.ok) {
          return res.json().catch(function() { return {}; }).then(function(e) {
            throw new Error(e.error || 'HTTP ' + res.status);
          });
        }
        return res.json();
      }).then(function() {
        /* Success state */
        modal.innerHTML = '';
        var successDiv = document.createElement('div');
        successDiv.style.cssText = 'text-align:center;padding:32px 24px;';
        var check = document.createElement('div');
        check.style.cssText = 'width:48px;height:48px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;font-size:22px;font-weight:700;';
        check.textContent = '\\u2713';
        var h3 = document.createElement('h3');
        h3.textContent = 'Task Created!';
        h3.style.cssText = 'margin:0 0 8px;font-size:16px;font-weight:600;color:#171717;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;';
        var p = document.createElement('p');
        p.textContent = 'Your feedback has been submitted successfully.';
        p.style.cssText = 'margin:0;color:#737373;font-size:14px;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;';
        successDiv.appendChild(check);
        successDiv.appendChild(h3);
        successDiv.appendChild(p);
        modal.appendChild(successDiv);
        setTimeout(function() { overlay.remove(); }, 2500);
      }).catch(function(err) {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = 'Create Task';
        submitBtn.style.opacity = '1';
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Error: ' + (err.message || 'Failed to submit. Please try again.');
      });
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(submitBtn);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    var escHandler = function(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
    setTimeout(function() { textarea.focus(); }, 50);
  }
})();
`;
}

export function buildClientScript(opts: {
  position: string;
  panelWidth: number;
  overlay: boolean;
}): string {
  const pos = opts.position;
  const pw = opts.panelWidth;
  const togglePos =
    pos === "bottom-left"
      ? "bottom:16px;left:16px;"
      : pos === "top-right"
        ? "top:16px;right:16px;"
        : pos === "top-left"
          ? "top:16px;left:16px;"
          : "bottom:16px;right:16px;";
  const panelSide = pos.includes("left") ? "left:0;" : "right:0;";
  const toggleSideKey = pos.includes("left") ? "left" : "right";
  const toggleVerticalKey = pos.includes("top") ? "top" : "bottom";
  const toggleClosedVal = "16px";

  return /* js */ `
(function() {
  if (document.getElementById('viagen-toggle')) return;

  var OVERLAY_ENABLED = ${opts.overlay};
  var EMBED_MODE = new URLSearchParams(window.location.search).has('_viagen_embed');

  /* ---- Error overlay: inject Fix button into shadow DOM ---- */
  if (OVERLAY_ENABLED) {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeName === 'VITE-ERROR-OVERLAY') injectFixButton(added[j]);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function injectFixButton(overlay) {
    if (!overlay.shadowRoot) return;
    setTimeout(function() {
      var root = overlay.shadowRoot;
      if (root.getElementById('viagen-fix-btn')) return;
      var win = root.querySelector('.window') || root.firstElementChild;
      if (!win) return;

      var style = document.createElement('style');
      style.textContent = [
        '.stack { display: none; }',
        '.tip { display: none; }',
        '.frame { max-height: 120px; overflow: hidden; font-size: 12px; }',
        '.window { max-width: 600px; padding: 20px; }',
        '.window.viagen-fixing .message { opacity: 0.4; }',
        '.window.viagen-fixing .file { opacity: 0.4; }',
        '.window.viagen-fixing .frame { opacity: 0.4; }',
        '#viagen-fixing-status { display: none; padding: 16px; text-align: center; font-family: Geist, -apple-system, BlinkMacSystemFont, sans-serif; }',
        '#viagen-fixing-status .label { font-size: 15px; font-weight: 600; color: #171717; }',
        '#viagen-fixing-status .sub { font-size: 12px; color: #737373; margin-top: 4px; }',
        '#viagen-fixing-status .dot { display: inline-block; animation: viagen-pulse 1.5s ease-in-out infinite; }',
        '.window.viagen-fixing #viagen-fixing-status { display: block; }',
        '.window.viagen-fixing #viagen-fix-btn { display: none; }',
        '@keyframes viagen-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }',
      ].join('\\n');
      root.appendChild(style);

      var status = document.createElement('div');
      status.id = 'viagen-fixing-status';
      status.innerHTML = '<div class="label"><span class="dot">&#9679;</span> Fixing...</div><div class="sub">Claude is working on it. Check the chat panel.</div>';
      win.appendChild(status);

      var btn = document.createElement('button');
      btn.id = 'viagen-fix-btn';
      btn.textContent = 'Fix This Error';
      btn.style.cssText = 'display:block;width:100%;margin-top:12px;padding:10px 20px;background:#171717;color:#ffffff;border:1px solid #171717;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;transition:background 0.15s;';
      btn.onmouseenter = function() { if (!btn.disabled) btn.style.background = '#404040'; };
      btn.onmouseleave = function() { if (!btn.disabled) btn.style.background = '#171717'; };
      btn.addEventListener('click', function() { fixError(win); });
      win.appendChild(btn);
    }, 50);
  }

  async function fixError(win) {
    win.classList.add('viagen-fixing');
    try {
      var errorRes = await fetch('/via/error');
      var errorData = await errorRes.json();
      if (!errorData.error) { win.classList.remove('viagen-fixing'); return; }
      var e = errorData.error;
      var prompt = 'Fix this Vite build error in ' +
        (e.loc ? e.loc.file + ':' + e.loc.line : 'unknown file') +
        ':\\n\\n' + e.message +
        (e.frame ? '\\n\\nCode frame:\\n' + e.frame : '');
      if (EMBED_MODE) {
        window.parent.postMessage({ type: 'viagen:send', message: prompt }, '*');
      } else {
        var p = document.getElementById('viagen-panel');
        if (p && p.style.display === 'none') {
          var t = document.getElementById('viagen-toggle');
          if (t) t.click();
        }
        var f = p && p.querySelector('iframe');
        if (f && f.contentWindow) {
          f.contentWindow.postMessage({ type: 'viagen:send', message: prompt }, '*');
        }
      }
    } catch(err) {
      console.error('[viagen] Fix error failed:', err);
      win.classList.remove('viagen-fixing');
    }
  }

  if (EMBED_MODE) return;
  if (window.self !== window.top) return;

  /* ---- Floating toggle + iframe panel ---- */
  var PANEL_KEY = 'viagen_panel_open';
  var panel = document.createElement('div');
  panel.id = 'viagen-panel';
  var PANEL_WIDTH_KEY = 'viagen_panel_width';
  var panelWidth = ${pw};
  try { var saved = parseInt(sessionStorage.getItem(PANEL_WIDTH_KEY)); if (saved >= 280) panelWidth = saved; } catch(e) {}
  panel.style.cssText = 'position:fixed;top:0;${panelSide}bottom:0;width:' + panelWidth + 'px;z-index:99997;display:none;border-${pos.includes("left") ? "right" : "left"}:1px solid #e5e5e5;box-shadow:${pos.includes("left") ? "4" : "-4"}px 0 24px rgba(0,0,0,0.08);';
  var iframe = document.createElement('iframe');
  iframe.src = '/via/ui';
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#ffffff;';

  /* ---- Drag-resize handle ---- */
  var handle = document.createElement('div');
  handle.style.cssText = 'position:absolute;top:0;${pos.includes("left") ? "right" : "left"}:-3px;width:6px;height:100%;cursor:col-resize;z-index:1;background:transparent;transition:background 0.15s;';
  handle.onmouseenter = function() { handle.style.background = '#d4d4d4'; };
  handle.onmouseleave = function() { if (!resizing) handle.style.background = 'transparent'; };
  var resizing = false;

  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    resizing = true;
    handle.style.background = '#d4d4d4';
    iframe.style.pointerEvents = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (!resizing) return;
    var w = ${pos.includes("left") ? "e.clientX" : "window.innerWidth - e.clientX"};
    if (w < 280) w = 280;
    if (w > window.innerWidth - 100) w = window.innerWidth - 100;
    panelWidth = w;
    panel.style.width = w + 'px';
    toggle.style.${toggleSideKey} = (w + 14) + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!resizing) return;
    resizing = false;
    handle.style.background = 'transparent';
    iframe.style.pointerEvents = '';
    try { sessionStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth)); } catch(e) {}
  });

  panel.appendChild(handle);
  panel.appendChild(iframe);
  document.body.appendChild(panel);

  var dotColor = '#d4d4d4';
  function dotHtml() { return '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + dotColor + ';vertical-align:middle;margin-right:4px;"></span>'; }

  var toggle = document.createElement('button');
  toggle.id = 'viagen-toggle';
  toggle.innerHTML = dotHtml() + 'via';
  toggle.style.cssText = 'position:fixed;${togglePos}z-index:99998;padding:8px 14px;background:#ffffff;color:#525252;border:1px solid #e5e5e5;border-radius:20px;font-size:12px;font-weight:500;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;letter-spacing:-0.01em;transition:border-color 0.15s,color 0.15s,background 0.15s,box-shadow 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);';
  toggle.onmouseenter = function() { toggle.style.borderColor = '#d4d4d4'; toggle.style.color = '#171717'; toggle.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1),0 1px 3px rgba(0,0,0,0.06)'; };
  toggle.onmouseleave = function() { if (panel.style.display === 'none') { toggle.style.borderColor = '#e5e5e5'; toggle.style.color = '#525252'; toggle.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)'; } };

  fetch('/via/health').then(function(r) { return r.json(); }).then(function(data) {
    dotColor = data.configured ? '#22c55e' : '#ef4444';
    if (panel.style.display === 'none') toggle.innerHTML = dotHtml() + 'via';
  }).catch(function() {
    dotColor = '#ef4444';
    if (panel.style.display === 'none') toggle.innerHTML = dotHtml() + 'via';
  });

  function setPanelOpen(open) {
    panel.style.display = open ? 'block' : 'none';
    toggle.innerHTML = open ? '\\u2715' : dotHtml() + 'via';
    toggle.style.${toggleSideKey} = open ? (panelWidth + 14) + 'px' : '${toggleClosedVal}';
    toggle.style.${toggleVerticalKey} = open ? '${pos.includes("top") ? "16" : "11"}px' : '12px';
    toggle.style.borderColor = open ? '#d4d4d4' : '#e5e5e5';
    toggle.style.color = open ? '#737373' : '#525252';
    toggle.style.background = open ? '#ffffff' : '#ffffff';
    try { sessionStorage.setItem(PANEL_KEY, open ? '1' : ''); } catch(e) {}
  }

  toggle.addEventListener('click', function() {
    setPanelOpen(panel.style.display === 'none');
  });
  document.body.appendChild(toggle);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.style.display !== 'none') setPanelOpen(false);
  });

  if (new URLSearchParams(window.location.search).has('_viagen_chat')) {
    setPanelOpen(true);
  } else {
    try { if (sessionStorage.getItem(PANEL_KEY)) setPanelOpen(true); } catch(e) {}
  }
})();
`;
}
