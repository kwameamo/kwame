/* ─────────────────────────────────────────────────────────────
   ADMIN — Notes and B-Roll
   • Notes: the blog as an Apple Notes folder. Tap a note to edit
     it, compose for a new one. Title, body in light markdown,
     date, folder, pin and an optional preview. Unsaved work is
     kept on this device until it is published.
   • B-Roll: the camera roll as a Photos library. "+" adds photos
     (each one's date is read from the file), tap a photo to edit
     its caption, place, date and link, or delete it. Every
     upload carries a small tile so the public grid loads fast;
     "Build Fast Previews" makes tiles for older photos.
───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var N = window.NotesCore;
    var FN = '/.netlify/functions/';
    var IMG = FN + 'get-gallery-image?id=';
    var pw = '';

    function $(id) { return document.getElementById(id); }
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text != null) e.textContent = text;
        return e;
    }
    function icon(id) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + id);
        svg.appendChild(use);
        return svg;
    }
    function glass() { if (window.LiquidGlass) window.LiquidGlass.refresh(); }
    function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
    function recall(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }

    function api(name, body) {
        return fetch(FN + name, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ password: pw }, body))
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.status === 401) { lock(); throw new Error('Signed out. Unlock again.'); }
                if (!res.ok || data.ok === false || data.error) throw new Error(data.error || ('Server error ' + res.status));
                return data;
            });
        });
    }

    var toastTimer = null;
    function say(msg) {
        $('toast-text').textContent = msg;
        $('toast').classList.add('is-shown');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { $('toast').classList.remove('is-shown'); }, 2200);
        glass();
    }

    /* ═══════════ Lock ═══════════ */
    var lockEl = $('lock'), app = $('app');
    var lockInput = $('lock-input'), lockErr = $('lock-error'), lockForm = $('lock-form');

    lockForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var value = lockInput.value;
        if (!value) return;
        var go = lockForm.querySelector('button');
        go.disabled = true;
        lockErr.textContent = '';
        fetch(FN + 'save-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verify: true, password: value })
        }).then(function (res) {
            go.disabled = false;
            if (res.status === 401) {
                lockInput.value = '';
                lockForm.classList.remove('is-shaking');
                void lockForm.offsetWidth;
                lockForm.classList.add('is-shaking');
                lockErr.textContent = 'Wrong password.';
                lockInput.focus();
                return;
            }
            if (res.status === 429) { lockErr.textContent = 'Too many tries. Wait a few minutes.'; return; }
            if (!res.ok) { lockErr.textContent = 'Server error (' + res.status + '). Try again.'; return; }
            pw = value;
            lockInput.value = '';
            lockEl.classList.add('is-leaving');
            setTimeout(function () {
                lockEl.hidden = true;
                lockEl.classList.remove('is-leaving');
                app.hidden = false;
                requestAnimationFrame(function () { app.classList.add('is-in'); glass(); });
                syncNotes();
                syncPhotos();
            }, 320);
        }).catch(function () {
            go.disabled = false;
            lockErr.textContent = 'No connection. Try again.';
        });
    });

    function lock() {
        pw = '';
        closeEditor(true);
        closeSheets();
        app.classList.remove('is-in');
        app.hidden = true;
        lockEl.hidden = false;
        lockInput.focus();
    }

    /* ═══════════ Shell: tabs, menus, title ═══════════ */
    var view = 'view-notes';
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.ad-tab'));
    var actNew = $('act-new');

    function setView(id) {
        view = id;
        tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.view === id)); });
        $('view-notes').hidden = id !== 'view-notes';
        $('view-roll').hidden = id !== 'view-roll';
        var notes = id === 'view-notes';
        actNew.setAttribute('aria-label', notes ? 'New note' : 'Add photos');
        actNew.querySelector('use').setAttribute('href', notes ? '#i-compose' : '#i-plus');
        closeMenus();
        if (!notes) { window.scrollTo(0, document.documentElement.scrollHeight); }
        else window.scrollTo(0, 0);
        onScroll();
        glass();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { setView(t.dataset.view); }); });
    actNew.addEventListener('click', function () {
        if (view === 'view-notes') openEditor(null);
        else $('roll-file').click();
    });

    function closeMenus() {
        document.querySelectorAll('.ad-menu.is-shown').forEach(function (m) { m.classList.remove('is-shown'); });
        document.querySelectorAll('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }
    document.querySelectorAll('[data-menu]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var m = $(btn.dataset.menu);
            var show = !m.classList.contains('is-shown');
            closeMenus();
            m.classList.toggle('is-shown', show);
            btn.setAttribute('aria-expanded', String(show));
            glass();
        });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.ad-menu')) closeMenus(); });
    document.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
            closeMenus();
            var a = b.dataset.act;
            if (a === 'lock') lock();
            if (a === 'refresh-notes') syncNotes().then(function () { say('Notes Up to Date'); });
            if (a === 'refresh-roll') syncPhotos().then(function () { say('B-Roll Up to Date'); });
            if (a === 'build-thumbs') buildThumbs();
        });
    });

    function onScroll() {
        var v = $(view);
        var title = v.querySelector('.ad-title');
        var top = v.querySelector('.ad-top');
        top.classList.toggle('is-scrolled', title.getBoundingClientRect().bottom < top.getBoundingClientRect().bottom);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ═══════════ Notes ═══════════ */
    var notes = [];
    var DRAFT = 'ad-draft:';

    function syncNotes() {
        return fetch(FN + 'get-posts?fresh=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; })
            .then(function (list) {
                notes = N.sort(Array.isArray(list) ? list : []);
                notes.forEach(function (n) { n.folder = n.folder || 'Notes'; });
                renderNotes();
            });
    }

    function hasDraft(id) { return !!recall(DRAFT + (id == null ? 'new' : id)); }

    function renderNotes() {
        var list = $('notes-list');
        var q = ($('notes-q').value || '').trim().toLowerCase();
        list.replaceChildren();
        $('notes-count').textContent = notes.length + (notes.length === 1 ? ' Note' : ' Notes');

        var shown = notes;
        if (q) {
            shown = notes.filter(function (n) {
                return (n.title + ' ' + N.plain(n.content) + ' ' + n.folder).toLowerCase().indexOf(q) !== -1;
            });
        }

        // An unsaved new note sits on top, like a draft in Notes
        var newDraft = recall(DRAFT + 'new');
        if (newDraft && !q) {
            list.appendChild(el('h2', 'ad-group-hd', 'Draft'));
            var c = el('div', 'ad-card');
            c.appendChild(noteRow({ id: null, title: newDraft.title || 'New Note', date: newDraft.meta && newDraft.meta.date, folder: (newDraft.meta && newDraft.meta.folder) || 'Notes', excerpt: (newDraft.body || '').slice(0, 120) }, true));
            list.appendChild(c);
        }

        if (!shown.length) {
            var e = el('p', 'ad-empty');
            e.appendChild(el('strong', '', q ? 'No Results' : 'No Notes'));
            e.appendChild(document.createTextNode(q ? 'Try another word.' : 'Tap compose to write the first one.'));
            list.appendChild(e);
            return;
        }

        var groups = q ? [{ label: 'Results', notes: shown }] : N.group(shown);
        groups.forEach(function (g) {
            list.appendChild(el('h2', 'ad-group-hd', g.label));
            var card = el('div', 'ad-card');
            g.notes.forEach(function (n) { card.appendChild(noteRow(n, hasDraft(n.id))); });
            list.appendChild(card);
        });
        glass();
    }

    function noteRow(n, draft) {
        var b = el('button', 'ad-row');
        b.type = 'button';
        b.dataset.id = n.id == null ? 'new' : n.id;
        b.appendChild(el('span', 'ad-row__title', n.title || 'New Note'));
        var line = el('span', 'ad-row__line');
        line.appendChild(el('span', 'ad-row__date', n.date ? N.rowDate(n.date) : 'Today'));
        line.appendChild(el('span', 'ad-row__preview', N.preview(n)));
        b.appendChild(line);
        var f = el('span', 'ad-row__folder');
        f.appendChild(icon(n.pinned ? 'i-pin-fill' : 'i-folder'));
        f.appendChild(document.createTextNode(n.folder || 'Notes'));
        if (draft) { f.appendChild(document.createTextNode(' · ')); f.appendChild(el('span', 'ad-row__draft', 'Unsaved changes')); }
        b.appendChild(f);
        return b;
    }

    $('notes-list').addEventListener('click', function (e) {
        var row = e.target.closest('.ad-row');
        if (!row) return;
        if (row.dataset.id === 'new') return openEditor(null);
        var id = +row.dataset.id;
        for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return openEditor(notes[i]);
    });
    $('notes-q').addEventListener('input', renderNotes);

    /* ── Markdown-lite ⇄ HTML ── */
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function safeHref(h) {
        h = String(h).trim();
        if (/^(https?:|mailto:|tel:|\/|#)/i.test(h)) return h.replace(/"/g, '%22');
        if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(h)) return 'https://' + h.replace(/"/g, '%22');
        return '#';
    }
    function inline(t) {
        t = esc(t);
        t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, href) {
            return '<a href="' + safeHref(href.replace(/&amp;/g, '&')) + '" target="_blank" rel="noopener">' + text + '</a>';
        });
        t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
        return t;
    }
    function toHtml(md) {
        return String(md || '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map(function (block) {
            var lines = block.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); });
            if (!lines.length) return '';
            if (lines.every(function (l) { return /^\s*[-*•]\s+/.test(l); })) {
                return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
            }
            if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) {
                return '<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; }).join('') + '</ol>';
            }
            if (lines.every(function (l) { return /^>\s?/.test(l); })) {
                return '<blockquote><p>' + lines.map(function (l) { return inline(l.replace(/^>\s?/, '')); }).join('<br>') + '</p></blockquote>';
            }
            if (lines.length === 1 && /^###\s+/.test(lines[0])) return '<h3>' + inline(lines[0].replace(/^###\s+/, '')) + '</h3>';
            if (lines.length === 1 && /^##?\s+/.test(lines[0])) return '<h2>' + inline(lines[0].replace(/^##?\s+/, '')) + '</h2>';
            return '<p>' + lines.map(inline).join('<br>') + '</p>';
        }).filter(Boolean).join('');
    }
    function toMd(html) {
        var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
        function inl(node) {
            var out = '';
            node.childNodes.forEach(function (c) {
                if (c.nodeType === 3) { out += c.textContent.replace(/\s+/g, ' '); return; }
                if (c.nodeType !== 1) return;
                var tag = c.tagName;
                if (tag === 'BR') out += '\n';
                else if (tag === 'STRONG' || tag === 'B') out += '**' + inl(c) + '**';
                else if (tag === 'EM' || tag === 'I') out += '*' + inl(c) + '*';
                else if (tag === 'A') out += '[' + inl(c) + '](' + (c.getAttribute('href') || '') + ')';
                else out += inl(c);
            });
            return out;
        }
        var blocks = [];
        doc.body.childNodes.forEach(function (c) {
            if (c.nodeType === 3) { if (c.textContent.trim()) blocks.push(c.textContent.trim()); return; }
            if (c.nodeType !== 1) return;
            var tag = c.tagName;
            if (tag === 'H2' || tag === 'H1') blocks.push('## ' + inl(c).trim());
            else if (tag === 'H3' || tag === 'H4') blocks.push('### ' + inl(c).trim());
            else if (tag === 'UL') blocks.push(Array.prototype.map.call(c.children, function (li) { return '- ' + inl(li).trim(); }).join('\n'));
            else if (tag === 'OL') blocks.push(Array.prototype.map.call(c.children, function (li, i) { return (i + 1) + '. ' + inl(li).trim(); }).join('\n'));
            else if (tag === 'BLOCKQUOTE') blocks.push(inl(c).trim().split('\n').map(function (l) { return '> ' + l.trim(); }).join('\n'));
            else blocks.push(inl(c).trim());
        });
        return blocks.filter(Boolean).join('\n\n');
    }

    /* ── Editor ── */
    var editor = $('editor');
    var edTitle = $('ed-title'), edBody = $('ed-body'), edSave = $('ed-save'), edPin = $('ed-pin');
    var ed = null; // { id, meta: { date, folder, pinned, excerpt }, base }

    function grow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

    function snapshot() {
        return JSON.stringify({ t: edTitle.value, b: edBody.value, m: ed.meta });
    }
    function dirty() { return !!ed && snapshot() !== ed.base; }

    function paintEditor() {
        var m = ed.meta;
        $('ed-stamp').textContent = N.longDate(m.date) + ' · ' + (m.folder || 'Notes');
        edPin.setAttribute('aria-pressed', String(!!m.pinned));
        edPin.setAttribute('aria-label', m.pinned ? 'Unpin note' : 'Pin note');
        edPin.querySelector('use').setAttribute('href', m.pinned ? '#i-pin-fill' : '#i-pin');
        edSave.querySelector('span').textContent = ed.id == null ? 'Publish' : 'Save';
        edSave.disabled = ed.id != null && !dirty();
    }

    function saveDraft() {
        if (!ed) return;
        var key = DRAFT + (ed.id == null ? 'new' : ed.id);
        if (dirty() && (edTitle.value.trim() || edBody.value.trim())) {
            store(key, { title: edTitle.value, body: edBody.value, meta: ed.meta, at: Date.now() });
        } else {
            store(key, null);
        }
    }

    var draftTimer = null;
    function changed() {
        grow(edTitle);
        grow(edBody);
        paintEditor();
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveDraft, 400);
    }
    edTitle.addEventListener('input', changed);
    edBody.addEventListener('input', changed);
    edTitle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); edBody.focus(); edBody.setSelectionRange(0, 0); }
    });

    function openEditor(note) {
        var key = DRAFT + (note ? note.id : 'new');
        ed = {
            id: note ? note.id : null,
            meta: {
                date: note ? note.date : N.iso(N.today()),
                folder: note ? (note.folder || 'Notes') : 'Notes',
                pinned: !!(note && note.pinned),
                excerpt: note && note.excerpt && note.excerpt !== N.plain(note.content).slice(0, 180) ? note.excerpt : ''
            }
        };
        edTitle.value = note ? note.title : '';
        edBody.value = note ? toMd(note.content) : '';
        ed.base = snapshot();

        var draft = recall(key);
        if (draft) {
            edTitle.value = draft.title || '';
            edBody.value = draft.body || '';
            if (draft.meta) ed.meta = Object.assign({}, ed.meta, draft.meta);
            if (note) say('Restored Unsaved Changes');
        }

        editor.classList.add('is-open');
        editor.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('ad-editing');
        $('ed-scroll').scrollTop = 0;
        requestAnimationFrame(function () {
            grow(edTitle); grow(edBody);
            paintEditor();
            (note ? edBody : edTitle).focus({ preventScroll: true });
            setTimeout(glass, 450);
        });
    }

    function closeEditor(silent) {
        if (!ed) return;
        saveDraft();
        if (!silent && dirty()) say('Kept as a Draft on This Device');
        ed = null;
        editor.classList.remove('is-open');
        editor.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('ad-editing');
        closeSheets();
        renderNotes();
        setTimeout(glass, 450);
    }

    $('ed-back').addEventListener('click', function () { closeEditor(); });
    $('ed-new').addEventListener('click', function () { saveDraft(); openEditor(null); });
    edPin.addEventListener('click', function () { ed.meta.pinned = !ed.meta.pinned; changed(); });

    edSave.addEventListener('click', function () {
        var title = edTitle.value.trim();
        var body = edBody.value.trim();
        if (!title) { edTitle.focus(); say('Add a Title'); return; }
        if (!body) { edBody.focus(); say('Write Something First'); return; }
        edSave.disabled = true;
        edSave.querySelector('span').textContent = ed.id == null ? 'Publishing…' : 'Saving…';
        var wasNew = ed.id == null;
        var payload = {
            title: title,
            content: toHtml(body),
            date: ed.meta.date,
            folder: ed.meta.folder,
            pinned: !!ed.meta.pinned,
            excerpt: ed.meta.excerpt || ''
        };
        if (!wasNew) payload.id = ed.id;
        api('save-post', payload).then(function (data) {
            store(DRAFT + (wasNew ? 'new' : ed.id), null);
            if (data.post && data.post.id != null) ed.id = data.post.id;
            ed.base = snapshot();
            paintEditor();
            say(wasNew ? 'Published' : 'Saved');
            return syncNotes();
        }).catch(function (err) {
            say(err.message);
            paintEditor();
        });
    });

    // Formatting, applied around the selection
    var fmtBar = document.querySelector('.ad-pill--tools');
    fmtBar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    fmtBar.addEventListener('click', function (e) {
        var b = e.target.closest('[data-fmt]');
        if (!b) return;
        format(b.dataset.fmt);
    });

    function format(kind) {
        var ta = edBody;
        ta.focus();
        var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
        var lineStart = v.lastIndexOf('\n', s - 1) + 1;
        function put(text, a, b) {
            ta.setRangeText(text, s, e, 'end');
            if (a != null) ta.setSelectionRange(s + a, s + b);
        }
        function prefixLines(prefix, test) {
            var end = v.indexOf('\n', e);
            if (end < 0) end = v.length;
            var block = v.slice(lineStart, end);
            var lines = block.split('\n');
            var on = lines.every(function (l) { return test.test(l); });
            var next = lines.map(function (l) { return on ? l.replace(test, '') : prefix + l; }).join('\n');
            ta.setRangeText(next, lineStart, end, 'end');
        }
        if (kind === 'bold') { if (sel) put('**' + sel + '**'); else put('****', 2, 2); }
        if (kind === 'italic') { if (sel) put('*' + sel + '*'); else put('**', 1, 1); }
        if (kind === 'link') {
            if (sel) put('[' + sel + '](https://)', sel.length + 3, sel.length + 11);
            else put('[text](https://)', 1, 5);
        }
        if (kind === 'h2') prefixLines('## ', /^##\s/);
        if (kind === 'list') prefixLines('- ', /^-\s/);
        if (kind === 'quote') prefixLines('> ', /^>\s?/);
        changed();
    }

    edBody.addEventListener('keydown', function (e) {
        // Keep lists and quotes going on Enter, like Notes
        if (e.key === 'Enter' && !e.shiftKey) {
            var v = edBody.value, s = edBody.selectionStart;
            var ls = v.lastIndexOf('\n', s - 1) + 1;
            var line = v.slice(ls, s);
            var m = /^(\s*[-*•]\s+|\s*\d+[.)]\s+|>\s?)/.exec(line);
            if (m) {
                e.preventDefault();
                if (line.trim() === m[1].trim()) { edBody.setRangeText('', ls, s, 'end'); }
                else {
                    var marker = m[1];
                    var num = /^(\s*)(\d+)([.)]\s+)/.exec(marker);
                    if (num) marker = num[1] + (+num[2] + 1) + num[3];
                    edBody.setRangeText('\n' + marker, s, edBody.selectionEnd, 'end');
                }
                changed();
            }
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); format('bold'); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); format('italic'); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); format('link'); }
    });

    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && ed) { e.preventDefault(); edSave.click(); }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && ed) { e.preventDefault(); edSave.click(); }
        if (e.key === 'Escape') {
            if (document.querySelector('.ad-sheet.is-open')) closeSheets();
            else if (ed) closeEditor();
            else closeMenus();
        }
    });

    window.addEventListener('beforeunload', saveDraft);

    /* ── Note details ── */
    function openNoteSheet() {
        var m = ed.meta;
        $('sn-date').value = m.date;
        $('sn-folder').value = m.folder === 'Notes' ? '' : m.folder;
        $('sn-pinned').checked = !!m.pinned;
        $('sn-excerpt').value = m.excerpt || '';
        var folders = {};
        notes.forEach(function (n) { folders[n.folder || 'Notes'] = 1; });
        $('sn-folders').replaceChildren.apply($('sn-folders'), Object.keys(folders).map(function (f) { var o = el('option'); o.value = f; return o; }));
        $('sn-view').hidden = ed.id == null;
        if (ed.id != null) $('sn-view').href = '/blog.html?post=' + ed.id;
        var del = $('sn-delete');
        del.hidden = ed.id == null;
        del.classList.remove('is-confirm');
        del.textContent = 'Delete Note';
        openSheet('sheet-note');
    }
    function readNoteSheet() {
        if (!ed) return;
        ed.meta.date = /^\d{4}-\d{2}-\d{2}$/.test($('sn-date').value) ? $('sn-date').value : ed.meta.date;
        ed.meta.folder = $('sn-folder').value.trim() || 'Notes';
        ed.meta.pinned = $('sn-pinned').checked;
        ed.meta.excerpt = $('sn-excerpt').value.trim();
        changed();
    }
    ['sn-date', 'sn-folder', 'sn-pinned', 'sn-excerpt'].forEach(function (id) {
        $(id).addEventListener('input', readNoteSheet);
        $(id).addEventListener('change', readNoteSheet);
    });
    $('ed-info').addEventListener('click', openNoteSheet);
    $('ed-stamp').addEventListener('click', openNoteSheet);

    $('sn-delete').addEventListener('click', function () {
        var del = $('sn-delete');
        if (!del.classList.contains('is-confirm')) {
            del.classList.add('is-confirm');
            del.textContent = 'Tap Again to Delete';
            return;
        }
        del.disabled = true;
        var id = ed.id;
        api('delete-post', { id: id }).then(function () {
            store(DRAFT + id, null);
            notes = notes.filter(function (n) { return n.id !== id; });
            ed.base = snapshot(); // nothing left to keep as a draft
            closeEditor(true);
            store(DRAFT + id, null);
            renderNotes();
            say('Note Deleted');
        }).catch(function (err) { say(err.message); }).then(function () { del.disabled = false; });
    });

    /* ═══════════ Sheets ═══════════ */
    var lastFocus = null;
    function openSheet(id) {
        lastFocus = document.activeElement;
        var s = $(id);
        s.classList.add('is-open');
        s.setAttribute('aria-hidden', 'false');
        var first = s.querySelector('input:not([type=hidden]), textarea, button');
        setTimeout(function () { if (first && window.matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true }); }, 50);
    }
    function closeSheets() {
        document.querySelectorAll('.ad-sheet.is-open').forEach(function (s) {
            s.classList.remove('is-open');
            s.setAttribute('aria-hidden', 'true');
            if (s.id === 'sheet-import') resetImport();
        });
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () {
            if (b.closest('#sheet-import') && importing) return;
            closeSheets();
        });
    });

    /* ═══════════ B-Roll ═══════════ */
    var photos = [];
    var firstRoll = true;

    function tileUrl(p) { return IMG + encodeURIComponent(p.id) + (p.thumb ? '&size=thumb&v=' + encodeURIComponent(p.thumb) : ''); }
    function fullUrl(p) { return IMG + encodeURIComponent(p.id); }
    function shotTime(it) {
        var stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(it.takenStamp || '') ? it.takenStamp : null;
        if (!stamp && /^\d{4}-\d{2}-\d{2}$/.test(it.takenAt || '')) {
            var up = /T(\d{2}:\d{2}:\d{2})/.exec(it.createdAt || '');
            stamp = it.takenAt + 'T' + (up ? up[1] : '12:00:00');
        }
        var t = stamp ? new Date(stamp).getTime() : new Date(it.createdAt || 0).getTime();
        return isNaN(t) ? 0 : t;
    }
    function dayOf(p) { return /^\d{4}-\d{2}-\d{2}$/.test(p.takenAt || '') ? p.takenAt : String(p.createdAt || '').slice(0, 10); }

    function syncPhotos() {
        return fetch(FN + 'get-gallery?fresh=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : []; })
            .catch(function () { return []; })
            .then(function (list) {
                photos = (Array.isArray(list) ? list : []).slice().sort(function (a, b) {
                    return (shotTime(a) - shotTime(b)) || ((a.id || 0) - (b.id || 0));
                });
                renderPhotos();
            });
    }

    function renderPhotos() {
        var grid = $('roll-grid');
        grid.replaceChildren();
        $('roll-count').textContent = photos.length + (photos.length === 1 ? ' Photo' : ' Photos');
        var frag = document.createDocumentFragment();
        photos.forEach(function (p, i) {
            var b = el('button', 'ad-tile');
            b.type = 'button';
            b.dataset.id = p.id;
            b.setAttribute('aria-label', (p.caption || 'Photo') + ', ' + N.rowDate(dayOf(p)));
            var img = document.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.loading = i >= photos.length - 30 ? 'eager' : 'lazy';
            img.src = tileUrl(p);
            img.addEventListener('load', function () { img.classList.add('is-loaded'); });
            b.appendChild(img);
            if (!p.thumb) b.appendChild(el('span', 'ad-tile__slow'));
            frag.appendChild(b);
        });
        grid.appendChild(frag);
        if (!photos.length) {
            var e = el('p', 'ad-empty');
            e.appendChild(el('strong', '', 'No Photos'));
            e.appendChild(document.createTextNode('Tap + to add the first ones.'));
            grid.appendChild(e);
        }
        var slow = photos.filter(function (p) { return !p.thumb; }).length;
        $('thumb-banner').hidden = !slow && !building;
        if (!building) {
            $('thumb-title').textContent = slow + (slow === 1 ? ' photo loads' : ' photos load') + ' slowly';
            $('thumb-sub').textContent = 'Build small previews so the grid opens instantly.';
        }
        // Places already used, offered as suggestions
        var places = {};
        photos.forEach(function (p) { if (p.place) places[p.place] = 1; });
        $('si-places').replaceChildren.apply($('si-places'), Object.keys(places).map(function (pl) { var o = el('option'); o.value = pl; return o; }));
        if (firstRoll && view === 'view-roll') { firstRoll = false; window.scrollTo(0, document.documentElement.scrollHeight); }
        glass();
    }

    $('roll-grid').addEventListener('click', function (e) {
        var t = e.target.closest('.ad-tile');
        if (!t) return;
        var id = +t.dataset.id;
        for (var i = 0; i < photos.length; i++) if (photos[i].id === id) return openPhoto(photos[i]);
    });

    /* ── Image processing ── */
    function loadImage(src) {
        return new Promise(function (res, rej) {
            var img = new Image();
            img.decoding = 'async';
            img.onload = function () { res(img); };
            img.onerror = function () { rej(new Error('Could not read that image.')); };
            img.src = src;
        });
    }
    var webpOK = (function () {
        try { var c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (_) { return false; }
    }());
    function draw(img, w, h, type, q) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        return c.toDataURL(type, q);
    }
    // The grid tile: its short side 400px, so square crops stay sharp on retina screens
    function makeThumb(img) {
        var w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, 400 / Math.min(w, h));
        var tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
        var url = webpOK ? draw(img, tw, th, 'image/webp', 0.74) : draw(img, tw, th, 'image/jpeg', 0.78);
        if (url.length > 520000) url = draw(img, tw, th, 'image/jpeg', 0.6);
        return url;
    }
    function process(file) {
        var url = URL.createObjectURL(file);
        return loadImage(url).then(function (img) {
            var w = img.naturalWidth, h = img.naturalHeight;
            var k = Math.min(1, 1600 / Math.max(w, h));
            var fw = Math.max(1, Math.round(w * k)), fh = Math.max(1, Math.round(h * k));
            var out = { image: draw(img, fw, fh, 'image/jpeg', 0.82), thumb: makeThumb(img), w: fw, h: fh };
            URL.revokeObjectURL(url);
            return out;
        }, function (err) { URL.revokeObjectURL(url); throw err; });
    }

    // The day a JPEG was taken, from its EXIF (DateTimeOriginal, else DateTime)
    function exifDate(file) {
        if (!/jpe?g/i.test(file.type)) return Promise.resolve(null);
        return file.slice(0, 196608).arrayBuffer().then(function (buf) {
            var v = new DataView(buf);
            if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
            var off = 2;
            while (off + 4 < v.byteLength) {
                var marker = v.getUint16(off);
                var size = v.getUint16(off + 2);
                if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) {
                    var t = off + 10;
                    var le = v.getUint16(t) === 0x4949;
                    var u16 = function (o) { return v.getUint16(t + o, le); };
                    var u32 = function (o) { return v.getUint32(t + o, le); };
                    var ascii = function (o, n) { var s = ''; for (var i = 0; i < n && t + o + i < v.byteLength; i++) { var ch = v.getUint8(t + o + i); if (!ch) break; s += String.fromCharCode(ch); } return s; };
                    var readIfd = function (o, want) {
                        var found = {};
                        if (t + o + 2 > v.byteLength) return found;
                        var n = u16(o);
                        for (var i = 0; i < n; i++) {
                            var e = o + 2 + i * 12;
                            if (t + e + 12 > v.byteLength) break;
                            var tag = u16(e);
                            if (want.indexOf(tag) !== -1) found[tag] = tag === 0x8769 ? u32(e + 8) : ascii(u32(e + 8), 19);
                        }
                        return found;
                    };
                    var ifd0 = readIfd(u32(4), [0x0132, 0x8769]);
                    var exif = ifd0[0x8769] ? readIfd(ifd0[0x8769], [0x9003, 0x9004]) : {};
                    var raw = exif[0x9003] || exif[0x9004] || ifd0[0x0132];
                    var m = /^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(raw || '');
                    if (!m || m[1] === '0000') return null;
                    return m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] ? m[4] + ':' + m[5] + ':' + m[6] : '12:00:00');
                }
                if ((marker & 0xFF00) !== 0xFF00) break;
                off += 2 + size;
            }
            return null;
        }).catch(function () { return null; });
    }

    function localStamp(d) {
        function p(n) { return n < 10 ? '0' + n : String(n); }
        return N.iso(d) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    /* ── Add photos ── */
    var queue = [];
    var importing = false;
    var uid = 0;

    $('roll-file').addEventListener('change', function () {
        var files = Array.prototype.slice.call(this.files || []);
        this.value = '';
        if (!files.length) return;
        var skipped = 0;
        files.forEach(function (file) {
            if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { skipped++; return; }
            // Until the metadata is read, fall back to the file's own date
            var mod = new Date(file.lastModified || Date.now());
            var item = { uid: ++uid, file: file, url: URL.createObjectURL(file), caption: '', date: N.iso(mod), stamp: localStamp(mod), fromPhoto: false };
            queue.push(item);
            exifDate(file).then(function (s) {
                if (!s) return;
                item.stamp = s;
                item.date = s.slice(0, 10);
                item.fromPhoto = true;
                var input = document.querySelector('[data-uid="' + item.uid + '"] input[type=date]');
                if (input) input.value = item.date;
            });
        });
        renderQueue();
        if (!$('sheet-import').classList.contains('is-open')) openSheet('sheet-import');
        $('si-status').className = 'ad-status' + (skipped ? ' is-error' : '');
        $('si-status').textContent = skipped ? skipped + ' file' + (skipped === 1 ? '' : 's') + ' skipped. JPG, PNG or WebP only.' : '';
    });
    $('si-more').addEventListener('click', function () { $('roll-file').click(); });

    function renderQueue() {
        var list = $('si-list');
        list.replaceChildren();
        queue.forEach(function (item) {
            var li = el('li', 'ad-imp');
            li.dataset.uid = item.uid;
            if (item.state === 'done') li.classList.add('is-done');
            if (item.state === 'failed') li.classList.add('is-failed');
            var img = document.createElement('img');
            img.src = item.url;
            img.alt = '';
            li.appendChild(img);
            var f = el('div', 'ad-imp__fields');
            var cap = document.createElement('input');
            cap.type = 'text';
            cap.maxLength = 140;
            cap.placeholder = 'Caption';
            cap.value = item.caption;
            cap.setAttribute('aria-label', 'Caption');
            cap.addEventListener('input', function () { item.caption = cap.value; });
            var date = document.createElement('input');
            date.type = 'date';
            date.value = item.date;
            date.setAttribute('aria-label', 'Date taken');
            date.addEventListener('change', function () {
                if (!date.value) return;
                item.date = date.value;
                // Keep the time of day, so photos from one day stay in the order they were shot
                item.stamp = date.value + (item.stamp ? item.stamp.slice(10) : 'T12:00:00');
            });
            f.appendChild(cap);
            f.appendChild(date);
            li.appendChild(f);
            var x = el('button', 'ad-imp__x');
            x.type = 'button';
            x.setAttribute('aria-label', 'Remove');
            x.appendChild(icon('i-x'));
            x.disabled = importing;
            x.addEventListener('click', function () {
                URL.revokeObjectURL(item.url);
                queue = queue.filter(function (q) { return q !== item; });
                renderQueue();
            });
            li.appendChild(x);
            list.appendChild(li);
        });
        var left = queue.filter(function (q) { return q.state !== 'done'; }).length;
        var go = $('si-go');
        go.disabled = !left || importing;
        go.textContent = importing ? 'Adding…' : left > 1 ? 'Add ' + left : 'Add';
        $('si-title').textContent = left === 1 ? 'Add 1 Photo' : 'Add ' + left + ' Photos';
    }

    function resetImport() {
        if (importing) return;
        queue.forEach(function (q) { URL.revokeObjectURL(q.url); });
        queue = [];
        $('si-status').textContent = '';
        renderQueue();
    }

    $('si-go').addEventListener('click', function () {
        if (importing) return;
        importing = true;
        var place = $('si-place').value.trim();
        var todo = queue.filter(function (q) { return q.state !== 'done'; });
        var done = 0, failed = 0;
        renderQueue();
        var status = $('si-status');
        status.className = 'ad-status';
        // One at a time keeps each request under the function size limit
        todo.reduce(function (chain, item, i) {
            return chain.then(function () {
                status.textContent = 'Adding ' + (i + 1) + ' of ' + todo.length + '…';
                return process(item.file).then(function (out) {
                    return api('save-gallery', {
                        image: out.image,
                        thumb: out.thumb,
                        w: out.w,
                        h: out.h,
                        caption: item.caption.trim(),
                        place: place,
                        takenAt: item.date,
                        takenStamp: item.stamp
                    });
                }).then(function () { item.state = 'done'; done++; }, function () { item.state = 'failed'; failed++; });
            }).then(renderQueue);
        }, Promise.resolve()).then(function () {
            importing = false;
            renderQueue();
            syncPhotos();
            if (!failed) {
                closeSheets();
                $('si-place').value = '';
                say(done === 1 ? 'Photo Added' : done + ' Photos Added');
            } else {
                status.className = 'ad-status is-error';
                status.textContent = done + ' added, ' + failed + ' failed. The failed ones are outlined; tap Add to try again.';
            }
        });
    });

    /* ── Edit a photo ── */
    var editing = null;
    function openPhoto(p) {
        editing = p;
        var img = $('sp-img');
        img.src = tileUrl(p);
        var full = new Image();
        full.onload = function () { if (editing === p) img.src = full.src; };
        full.src = fullUrl(p);
        $('sp-caption').value = p.caption || '';
        $('sp-place').value = p.place || '';
        $('sp-date').value = dayOf(p);
        $('sp-link').value = p.link || '';
        var meta = ['Added ' + N.longDate(String(p.createdAt || '').slice(0, 10))];
        if (p.w && p.h) meta.push(p.w + ' × ' + p.h);
        meta.push(p.thumb ? 'Fast preview ready' : 'No fast preview yet');
        $('sp-meta').textContent = meta.join(' · ');
        $('sp-view').href = '/roll.html#photo-' + p.id;
        var del = $('sp-delete');
        del.classList.remove('is-confirm');
        del.textContent = 'Delete Photo';
        $('sp-status').textContent = '';
        openSheet('sheet-photo');
    }

    $('sp-save').addEventListener('click', function () {
        if (!editing) return;
        var p = editing, btn = $('sp-save');
        var change = { id: p.id };
        var cap = $('sp-caption').value.trim(), place = $('sp-place').value.trim(), link = $('sp-link').value.trim(), date = $('sp-date').value;
        if (cap !== (p.caption || '')) change.caption = cap;
        if (place !== (p.place || '')) change.place = place;
        if (link !== (p.link || '')) change.link = link;
        if (date && date !== dayOf(p)) change.takenAt = date;
        if (Object.keys(change).length === 1) { closeSheets(); return; }
        btn.disabled = true;
        api('update-gallery', change).then(function (data) {
            if (data.item) Object.assign(p, data.item); else Object.assign(p, change);
            closeSheets();
            say('Saved');
            return syncPhotos();
        }).catch(function (err) {
            $('sp-status').className = 'ad-status is-error';
            $('sp-status').textContent = err.message;
        }).then(function () { btn.disabled = false; });
    });

    $('sp-delete').addEventListener('click', function () {
        var del = $('sp-delete');
        if (!del.classList.contains('is-confirm')) {
            del.classList.add('is-confirm');
            del.textContent = 'Tap Again to Delete';
            return;
        }
        var p = editing;
        del.disabled = true;
        api('delete-gallery', { id: p.id }).then(function () {
            photos = photos.filter(function (x) { return x.id !== p.id; });
            closeSheets();
            renderPhotos();
            say('Photo Deleted');
        }).catch(function (err) {
            $('sp-status').className = 'ad-status is-error';
            $('sp-status').textContent = err.message;
        }).then(function () { del.disabled = false; });
    });

    /* ── Fast previews for older photos ── */
    var building = false;
    function buildThumbs() {
        if (building) return;
        var todo = photos.filter(function (p) { return !p.thumb; });
        if (!todo.length) { say('Every Photo Has a Fast Preview'); return; }
        building = true;
        if (view !== 'view-roll') setView('view-roll');
        window.scrollTo(0, 0);
        var go = $('thumb-go'), bar = $('thumb-progress'), fill = bar.querySelector('span');
        $('thumb-banner').hidden = false;
        go.disabled = true;
        bar.hidden = false;
        var done = 0, failed = 0;
        todo.reduce(function (chain, p) {
            return chain.then(function () {
                $('thumb-title').textContent = 'Building previews · ' + (done + failed + 1) + ' of ' + todo.length;
                $('thumb-sub').textContent = 'Keep this page open.';
                return loadImage(fullUrl(p)).then(function (img) {
                    var body = { id: p.id, thumb: makeThumb(img) };
                    if (!p.w) { body.w = img.naturalWidth; body.h = img.naturalHeight; }
                    return api('update-gallery', body);
                }).then(function (data) {
                    if (data.item) Object.assign(p, data.item);
                    done++;
                    var tile = document.querySelector('.ad-tile[data-id="' + p.id + '"] .ad-tile__slow');
                    if (tile) tile.remove();
                }, function () { failed++; }).then(function () {
                    fill.style.width = Math.round((done + failed) / todo.length * 100) + '%';
                });
            });
        }, Promise.resolve()).then(function () {
            building = false;
            go.disabled = false;
            bar.hidden = true;
            fill.style.width = '0';
            say(failed ? done + ' built, ' + failed + ' failed' : 'All Previews Built');
            syncPhotos();
        });
    }
    $('thumb-go').addEventListener('click', buildThumbs);

    lockInput.focus();
}());
