/**
 * File editor module — extracted from ui.ts.
 * Returns { css, html, js } strings to be slotted into the chat UI template.
 */
export function buildEditorModule(): { css: string; html: string; js: string } {
  const css = `
    /* ── Prism overrides for viagen light theme ── */
    pre[class*="language-"], code[class*="language-"] {
      color: #404040;
      background: none;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre;
      word-break: normal;
      word-wrap: normal;
    }
    .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #a3a3a3; font-style: italic; }
    .token.punctuation { color: #737373; }
    .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: #c026d3; }
    .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: #16a34a; }
    .token.operator, .token.entity, .token.url { color: #2563eb; }
    .token.atrule, .token.attr-value, .token.keyword { color: #7c3aed; }
    .token.function, .token.class-name { color: #ca8a04; }
    .token.regex, .token.important, .token.variable { color: #dc2626; }

    /* ── File tree ── */
    .file-tree { padding: 8px 0; }
    .tree-item {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #525252;
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
      position: relative;
    }
    .tree-item:hover { background: #fafafa; color: #171717; }
    .tree-item.active { background: #f5f5f5; color: #171717; }
    .tree-icon {
      flex-shrink: 0;
      margin-right: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
    }
    .tree-icon svg {
      width: 14px;
      height: 14px;
    }
    .tree-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tree-group {
      position: relative;
    }
    .tree-group-children {
      position: relative;
    }
    .tree-group-children::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 1px;
      background: #e5e5e5;
      z-index: 1;
    }

    /* ── Editor layout ── */
    .editor-split {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .editor-tree-pane {
      overflow-y: auto;
      border-right: 1px solid #e5e5e5;
      flex-shrink: 0;
      background: #ffffff;
    }
    .editor-main-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .editor-code-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .editor-line-numbers {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 40px;
      padding: 8px 8px 8px 0;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre;
      color: #d4d4d4;
      text-align: right;
      user-select: none;
      pointer-events: none;
      overflow: hidden;
      background: #fafafa;
      border-right: 1px solid #e5e5e5;
      z-index: 2;
    }
    .editor-highlight {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 12px 8px 48px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre;
      overflow: auto;
      color: #404040;
      background: #ffffff;
      margin: 0;
      border: none;
      z-index: 0;
    }
    .editor-highlight code {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      background: none;
      padding: 0;
    }
    .editor-textarea {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      padding: 8px 12px 8px 48px;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 12px;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre;
      overflow: auto;
      background: transparent;
      color: transparent;
      caret-color: #171717;
      border: none;
      resize: none;
      outline: none;
      z-index: 1;
    }
    .editor-image-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #fafafa;
      overflow: auto;
    }
    .editor-image-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 6px;
    }
  `;

  const html = `
    <div id="files-view" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
      <div class="editor-split" id="editor-split">
        <div class="editor-tree-pane" id="editor-tree-pane">
          <div class="file-tree" id="file-tree"></div>
        </div>
        <div class="editor-main-pane" id="editor-main-pane" style="display:none;">
          <div class="editor-header">
            <button class="editor-back" id="editor-back" title="Back to files"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
            <span class="editor-filename" id="editor-filename"></span>
            <button class="btn-dark" id="editor-save" disabled>Save</button>
          </div>
          <div class="editor-code-wrap" id="editor-code-wrap">
            <div class="editor-line-numbers" id="editor-line-numbers"></div>
            <pre class="editor-highlight" id="editor-highlight"><code id="editor-code"></code></pre>
            <textarea id="editor-textarea" class="editor-textarea" spellcheck="false"></textarea>
          </div>
          <div class="editor-image-wrap" id="editor-image-wrap" style="display:none;">
            <img id="editor-image" />
          </div>
        </div>
      </div>
    </div>
  `;

  const js = `
    (function() {
      var IMAGE_EXTS = ['png','jpg','jpeg','gif','svg','webp','ico','bmp'];
      var LANG_MAP = {
        ts: 'typescript', tsx: 'typescript',
        js: 'javascript', jsx: 'javascript',
        css: 'css', scss: 'css',
        html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
        json: 'json',
        md: 'markdown',
      };

      /* ── SVG Icons ── */
      var ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      var ICON_FOLDER_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4l2 3h9a2 2 0 0 1 2 2v1"/><path d="M20 13H8.5A2.5 2.5 0 0 0 6 15.5V19a2 2 0 0 0 2 2h12.4a1 1 0 0 0 1-.97l.6-6.06A1 1 0 0 0 20 13z"/></svg>';
      var ICON_TEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>';
      var ICON_MD = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M8 7h2l2 4 2-4h2"/></svg>';
      var ICON_JSON = '<svg viewBox="0 0 24 24" fill="none"><text x="12" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="#a3a3a3">{;}</text></svg>';
      var ICON_TS = '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3" stroke="#a3a3a3" stroke-width="1.5" fill="none"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#a3a3a3">TS</text></svg>';
      var ICON_JS = '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="3" stroke="#a3a3a3" stroke-width="1.5" fill="none"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#a3a3a3">JS</text></svg>';
      var ICON_HTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/></svg>';
      var ICON_CSS = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.82-.13 2.67-.36"/><path d="M22 12c0-1.66-.4-3.22-1.11-4.6"/><path d="M16 20.41C17.86 19.16 19.27 17.24 19.9 15"/></svg>';
      var ICON_MEDIA = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>';
      var ICON_CONFIG = '<svg viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

      function getFileIcon(filename) {
        var ext = getExt(filename);
        switch(ext) {
          case 'ts': case 'tsx': return ICON_TS;
          case 'js': case 'jsx': case 'mjs': case 'cjs': return ICON_JS;
          case 'json': return ICON_JSON;
          case 'md': case 'mdx': return ICON_MD;
          case 'html': case 'htm': case 'xml': case 'svg': return ICON_HTML;
          case 'css': case 'scss': case 'sass': case 'less': return ICON_CSS;
          case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'ico': case 'bmp': return ICON_MEDIA;
          case 'yml': case 'yaml': case 'toml': case 'ini': case 'env': return ICON_CONFIG;
          default: return ICON_TEXT;
        }
      }

      var treePane = document.getElementById('editor-tree-pane');
      var mainPane = document.getElementById('editor-main-pane');
      var editorSplit = document.getElementById('editor-split');
      var fileTree = document.getElementById('file-tree');
      var editorTextarea = document.getElementById('editor-textarea');
      var editorHighlight = document.getElementById('editor-highlight');
      var editorCode = document.getElementById('editor-code');
      var lineNumbersEl = document.getElementById('editor-line-numbers');
      var codeWrap = document.getElementById('editor-code-wrap');
      var imageWrap = document.getElementById('editor-image-wrap');
      var editorImage = document.getElementById('editor-image');
      var editorSave = document.getElementById('editor-save');
      var editorFilename = document.getElementById('editor-filename');
      var editorBack = document.getElementById('editor-back');

      var editorState = { path: '', original: '', modified: false, lang: '' };
      var expandedDirs = new Set();
      var activeFilePath = '';
      var isWideMode = false;

      function getExt(path) {
        var i = path.lastIndexOf('.');
        return i >= 0 ? path.slice(i + 1).toLowerCase() : '';
      }

      function isImage(path) {
        return IMAGE_EXTS.indexOf(getExt(path)) !== -1;
      }

      function getLang(path) {
        return LANG_MAP[getExt(path)] || '';
      }

      function checkWideMode() {
        var view = document.getElementById('files-view');
        isWideMode = view && view.offsetWidth >= 500;
      }

      /* ── Syntax highlighting ── */
      function highlightCode(text, lang) {
        if (typeof Prism !== 'undefined' && lang && Prism.languages[lang]) {
          return Prism.highlight(text, Prism.languages[lang], lang);
        }
        return escapeHtml(text);
      }

      function updateHighlight() {
        editorCode.innerHTML = highlightCode(editorTextarea.value, editorState.lang);
      }

      function updateLineNumbers() {
        var lines = editorTextarea.value.split('\\n').length;
        var nums = '';
        for (var i = 1; i <= lines; i++) nums += i + '\\n';
        lineNumbersEl.textContent = nums;
      }

      function syncScroll() {
        editorHighlight.scrollTop = editorTextarea.scrollTop;
        editorHighlight.scrollLeft = editorTextarea.scrollLeft;
        lineNumbersEl.scrollTop = editorTextarea.scrollTop;
      }

      /* ── Tree building ── */
      function buildTree(files) {
        var root = { name: '', children: {}, files: [] };
        files.forEach(function(f) {
          var parts = f.split('/');
          var node = root;
          for (var i = 0; i < parts.length - 1; i++) {
            var dirName = parts[i];
            if (!node.children[dirName]) {
              node.children[dirName] = { name: dirName, children: {}, files: [] };
            }
            node = node.children[dirName];
          }
          node.files.push({ name: parts[parts.length - 1], path: f });
        });
        return root;
      }

      function renderTree(node, container, depth, dirPath) {
        // Render subdirectories first
        var dirs = Object.keys(node.children).sort();
        dirs.forEach(function(dirName) {
          var child = node.children[dirName];
          var childPath = dirPath ? dirPath + '/' + dirName : dirName;
          var isExpanded = expandedDirs.has(childPath);

          var group = document.createElement('div');
          group.className = 'tree-group';

          var row = document.createElement('div');
          row.className = 'tree-item';
          var iconEl = document.createElement('span');
          iconEl.className = 'tree-icon';
          iconEl.innerHTML = isExpanded ? ICON_FOLDER_OPEN : ICON_FOLDER;
          row.appendChild(iconEl);
          var labelEl = document.createElement('span');
          labelEl.className = 'tree-label';
          labelEl.textContent = dirName;
          row.appendChild(labelEl);
          group.appendChild(row);

          var childContainer = document.createElement('div');
          childContainer.className = 'tree-group-children';
          childContainer.style.marginLeft = '12px';
          childContainer.style.display = isExpanded ? 'block' : 'none';
          group.appendChild(childContainer);
          container.appendChild(group);

          row.addEventListener('click', function() {
            if (expandedDirs.has(childPath)) {
              expandedDirs.delete(childPath);
              childContainer.style.display = 'none';
              iconEl.innerHTML = ICON_FOLDER;
            } else {
              expandedDirs.add(childPath);
              childContainer.style.display = 'block';
              iconEl.innerHTML = ICON_FOLDER_OPEN;
            }
          });

          renderTree(child, childContainer, 0, childPath);
        });

        // Render files
        node.files.sort(function(a, b) { return a.name.localeCompare(b.name); });
        node.files.forEach(function(file) {
          var row = document.createElement('div');
          row.className = 'tree-item' + (file.path === activeFilePath ? ' active' : '');

          row.dataset.path = file.path;
          var iconEl = document.createElement('span');
          iconEl.className = 'tree-icon';
          iconEl.innerHTML = getFileIcon(file.name);
          row.appendChild(iconEl);
          var labelEl = document.createElement('span');
          labelEl.className = 'tree-label';
          labelEl.textContent = file.name;
          row.appendChild(labelEl);
          row.addEventListener('click', function() { openFile(file.path); });
          container.appendChild(row);
        });
      }

      function renderFileTree(files, projectName) {
        fileTree.innerHTML = '';
        if (files.length === 0) {
          fileTree.innerHTML = '<div style="padding:16px;color:#a3a3a3;font-size:12px;">No editable files configured</div>';
          return;
        }
        // Default: expand all directories
        if (expandedDirs.size === 0) {
          files.forEach(function(f) {
            var parts = f.split('/');
            var path = '';
            for (var i = 0; i < parts.length - 1; i++) {
              path = path ? path + '/' + parts[i] : parts[i];
              expandedDirs.add(path);
            }
          });
        }
        var tree = buildTree(files);

        // Root node
        var rootGroup = document.createElement('div');
        rootGroup.className = 'tree-group';
        var rootRow = document.createElement('div');
        rootRow.className = 'tree-item';
        rootRow.style.paddingLeft = '12px';
        var rootIcon = document.createElement('span');
        rootIcon.className = 'tree-icon';
        rootIcon.innerHTML = ICON_FOLDER_OPEN;
        rootRow.appendChild(rootIcon);
        var rootLabel = document.createElement('span');
        rootLabel.className = 'tree-label';
        rootLabel.textContent = projectName || 'Root';
        rootRow.appendChild(rootLabel);
        rootGroup.appendChild(rootRow);

        var rootChildren = document.createElement('div');
        rootChildren.className = 'tree-group-children';
        rootChildren.style.marginLeft = '28px';
        rootGroup.appendChild(rootChildren);
        fileTree.appendChild(rootGroup);

        renderTree(tree, rootChildren, 0, '');
      }

      /* ── File loading ── */
      var cachedFiles = null;
      var cachedProjectName = null;
      window._viagenLoadFiles = loadFileList;

      async function loadFileList() {
        checkWideMode();
        updateLayout(false);

        fileTree.innerHTML = '<div style="padding:16px;color:#a3a3a3;font-size:12px;font-family:Geist Mono,ui-monospace,monospace;">Loading...</div>';
        try {
          var res = await fetch('/via/files');
          var data = await res.json();
          cachedFiles = data.files;
          cachedProjectName = data.projectName || 'Root';
          renderFileTree(data.files, cachedProjectName);
        } catch(e) {
          fileTree.innerHTML = '<div style="padding:16px;color:#dc2626;font-size:12px;">Failed to load files</div>';
        }
      }

      function updateLayout(showEditor) {
        checkWideMode();
        if (isWideMode) {
          treePane.style.display = 'block';
          treePane.style.width = '200px';
          mainPane.style.display = showEditor ? 'flex' : 'none';
          editorBack.style.display = 'none';
        } else {
          if (showEditor) {
            treePane.style.display = 'none';
            mainPane.style.display = 'flex';
            editorBack.style.display = '';
          } else {
            treePane.style.display = 'block';
            treePane.style.width = '100%';
            mainPane.style.display = 'none';
          }
        }
      }

      function setActiveInTree(path) {
        activeFilePath = path;
        var items = fileTree.querySelectorAll('.tree-item');
        for (var i = 0; i < items.length; i++) {
          items[i].classList.toggle('active', items[i].dataset.path === path);
        }
      }

      async function openFile(path) {
        setActiveInTree(path);
        editorFilename.textContent = path;
        editorSave.disabled = true;
        editorSave.textContent = 'Save';

        if (isImage(path)) {
          codeWrap.style.display = 'none';
          imageWrap.style.display = 'flex';
          editorImage.src = '/via/file/raw?path=' + encodeURIComponent(path);
          editorSave.style.display = 'none';
          editorState = { path: path, original: '', modified: false, lang: '' };
        } else {
          codeWrap.style.display = '';
          imageWrap.style.display = 'none';
          editorSave.style.display = '';
          var lang = getLang(path);
          editorState = { path: path, original: '', modified: false, lang: lang };

          try {
            var res = await fetch('/via/file?path=' + encodeURIComponent(path));
            var data = await res.json();
            editorState.original = data.content;
            editorTextarea.value = data.content;
            updateLineNumbers();
            updateHighlight();
          } catch(e) {
            editorTextarea.value = '// Error loading file';
            updateLineNumbers();
            updateHighlight();
          }
        }

        updateLayout(true);
      }

      /* ── Edit tracking ── */
      function markModified() {
        editorState.modified = (editorTextarea.value !== editorState.original);
        editorSave.disabled = !editorState.modified;
      }

      editorTextarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var start = this.selectionStart;
          var end = this.selectionEnd;
          this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
          this.selectionStart = this.selectionEnd = start + 2;
          updateLineNumbers();
          updateHighlight();
          markModified();
        }
      });

      editorTextarea.addEventListener('input', function() {
        updateLineNumbers();
        updateHighlight();
        markModified();
      });

      editorTextarea.addEventListener('scroll', syncScroll);

      /* ── Save ── */
      editorSave.addEventListener('click', async function() {
        editorSave.disabled = true;
        editorSave.textContent = 'Saving...';
        var content = editorTextarea.value;
        try {
          var res = await fetch('/via/file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: editorState.path, content: content }),
          });
          var data = await res.json();
          if (data.status === 'ok') {
            editorState.original = content;
            editorState.modified = false;
            editorSave.textContent = 'Saved';
            setTimeout(function() { editorSave.textContent = 'Save'; }, 1500);
          } else {
            editorSave.textContent = 'Error';
            setTimeout(function() { editorSave.textContent = 'Save'; editorSave.disabled = false; }, 2000);
          }
        } catch(e) {
          editorSave.textContent = 'Error';
          setTimeout(function() { editorSave.textContent = 'Save'; editorSave.disabled = false; }, 2000);
        }
      });

      /* ── Back button ── */
      editorBack.addEventListener('click', function() {
        if (editorState.modified) {
          if (!confirm('Discard unsaved changes?')) return;
        }
        activeFilePath = '';
        updateLayout(false);
        if (cachedFiles) renderFileTree(cachedFiles, cachedProjectName);
      });

    })();
  `;

  return { css, html, js };
}
