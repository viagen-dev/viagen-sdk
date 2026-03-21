export function buildIframeHtml(opts: { panelWidth: number; appUrl?: string }): string {
  const pw = opts.panelWidth;
  const appSrc = opts.appUrl ?? '/?_viagen_embed=1';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>viagen</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; height: 100vh; background: #f5f5f5; overflow: hidden; }
    #app-frame { flex: 1; border: none; height: 100%; min-width: 200px; }
    #divider {
      width: 1px;
      cursor: col-resize;
      background: #e5e5e5;
      transition: background 0.15s;
      flex-shrink: 0;
      position: relative;
    }
    #divider::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -2px;
      right: -2px;
      z-index: 1;
    }
    #divider:hover, #divider.active { background: #a3a3a3; }
    #chat-frame { width: ${pw}px; border: none; height: 100%; min-width: 280px; background: #ffffff; }
    .dragging iframe { pointer-events: none; }
    #loading {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #f5f5f5; color: #666; font-family: system-ui; z-index: 100;
      transition: opacity 0.3s;
    }
    #loading.hidden { opacity: 0; pointer-events: none; }
    .spinner { width: 20px; height: 20px; border: 2px solid #ddd; border-top-color: #888;
               border-radius: 50%; animation: spin .6s linear infinite; margin-right: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    body.ready { background: #ffffff; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a; }
      #loading { background: #0a0a0a; color: #888; }
      .spinner { border-color: #333; border-top-color: #999; }
      #divider { background: #333; }
      #divider:hover, #divider.active { background: #555; }
      #chat-frame { background: #0a0a0a; }
      body.ready { background: #0a0a0a; }
    }
  </style>
</head>
<body>
  <div id="loading"><div class="spinner"></div><span>Starting dev server\u2026</span></div>
  <iframe id="app-frame"></iframe>
  <div id="divider"></div>
  <iframe id="chat-frame"></iframe>
  <script>
    var appFrame = document.getElementById('app-frame');
    var chatFrame = document.getElementById('chat-frame');
    var loading = document.getElementById('loading');

    // Wait for Vite to be fully initialized before loading iframes.
    // We probe /@vite/client which goes through Vite's transform pipeline
    // and only succeeds after the dev server has finished starting up.
    // Static middleware routes like /via/ui return 200 instantly (before
    // Vite is ready), so they can't be used as readiness probes.
    (async function() {
      for (var i = 0; i < 120; i++) {
        try {
          var r = await fetch('/@vite/client', { credentials: 'same-origin' });
          if (r.ok) break;
        } catch(e) {}
        await new Promise(function(resolve) { setTimeout(resolve, 500); });
      }
      // Set iframe srcs — now Vite should be ready
      chatFrame.src = '/via/ui';
      appFrame.src = ${JSON.stringify(appSrc)};
      // Hide loading overlay once chat frame loads
      chatFrame.addEventListener('load', function() {
        loading.classList.add('hidden');
        document.body.classList.add('ready');
        chatFrame.contentWindow.postMessage({ type: 'viagen:context', iframe: true }, '*');
      });
    })();

    // Relay postMessage from app iframe to chat iframe (e.g. "Fix This Error")
    window.addEventListener('message', function(ev) {
      if (ev.data && ev.data.type === 'viagen:send') {
        chatFrame.contentWindow.postMessage(ev.data, '*');
      }
    });

    // Drag-resizable divider
    var divider = document.getElementById('divider');
    var dragging = false;
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragging = true;
      divider.classList.add('active');
      document.body.classList.add('dragging');
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var chatWidth = window.innerWidth - e.clientX - 2;
      if (chatWidth < 280) chatWidth = 280;
      if (chatWidth > window.innerWidth - 200) chatWidth = window.innerWidth - 200;
      chatFrame.style.width = chatWidth + 'px';
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('active');
      document.body.classList.remove('dragging');
    });
  </script>
</body>
</html>`;
}
