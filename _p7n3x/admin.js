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

    // Clock and date, iPhone style: "3:35", "Sat Nov 21". The Lock Screen sheet's preview shows the same.
    var clocks = [[$('lock-time'), $('lock-date')], [$('wl-time'), $('wl-date')]], clockTimer = 0;
    function tick() {
        var now = new Date(), h = now.getHours() % 12 || 12, m = now.getMinutes();
        var t = h + ':' + (m < 10 ? '0' : '') + m;
        var d = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
        clocks.forEach(function (c) {
            if (c[0].textContent !== t) { c[0].textContent = t; fitClock(c[0]); }
            c[1].textContent = d;
        });
    }
    // Keep the numerals inside the frame: 12:35 is wider than 3:35, so squeeze it sideways.
    function fitClock(span) {
        if (!span) { clocks.forEach(function (c) { fitClock(c[0]); }); return; }
        var frame = span.parentNode.clientWidth;
        if (!frame) return;
        // "3:35" spans ~80% of the frame, as on the phone; "12:47" gets nearly the full width so it isn't squeezed thin.
        var box = frame * (span.textContent.length > 4 ? 0.97 : 0.86);
        span.style.setProperty('--lk-sx', 1);
        var w = span.scrollWidth;
        if (w > box) span.style.setProperty('--lk-sx', (box / w).toFixed(3));
    }
    function startClock() {
        tick();
        clearInterval(clockTimer);
        clockTimer = setInterval(tick, 1000);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitClock(); });
    window.addEventListener('resize', function () { fitClock(); });

    // The status bar takes the wallpaper's colour while the lock screen is up.
    var themeMeta = document.querySelector('meta[name="theme-color"]'), appTheme = themeMeta.content, wallTop = '#e9be32';
    function lockTheme(on) { themeMeta.content = on ? wallTop : appTheme; }

    /* Wallpaper: the built-in yellow one, or a photo set in Lock Screen.
       The last one seen is kept on this device so the lock screen paints right away. */
    var WALL = 'ad-wall';
    var wallCfg = recall(WALL) || {};
    function wallUrl(part, v) { return FN + 'get-lock?part=' + part + '&v=' + encodeURIComponent(v); }

    // Clock colours from one base colour: a lighter top, the colour, a slightly deeper bottom.
    function mix(hex, to, t) {
        var a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
        var r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
        var g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
        var bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
        return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
    }
    function paintClock(root, hex) {
        var vars = ['--lk-c1', '--lk-c2', '--lk-c3', '--lk-ink', '--lk-shadow'];
        if (!hex) { vars.forEach(function (v) { root.style.removeProperty(v); }); return; }
        var dark = parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11 < 110;
        root.style.setProperty('--lk-c1', mix(hex, dark ? '#000000' : '#ffffff', dark ? 0.2 : 0.55));
        root.style.setProperty('--lk-c2', hex);
        root.style.setProperty('--lk-c3', mix(hex, '#000000', 0.08));
        root.style.setProperty('--lk-ink', mix(hex, dark ? '#000000' : '#ffffff', 0.35));
        root.style.setProperty('--lk-shadow', dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.18)');
    }

    function applyWall(cfg) {
        wallCfg = cfg || {};
        var custom = !!wallCfg.v;
        var bg = $('lock-bg'), fill = $('lock-fill'), sub = $('lock-subject');
        lockEl.classList.toggle('is-custom', custom);
        if (custom) {
            bg.src = fill.src = wallUrl('bg', wallCfg.v);
            if (wallCfg.depth) { sub.src = wallUrl('subject', wallCfg.v); sub.classList.add('ad-lock__subject--full'); }
        } else {
            bg.removeAttribute('src'); fill.removeAttribute('src');
            sub.src = '/_p7n3x/lock-subject.webp'; sub.classList.remove('ad-lock__subject--full');
        }
        bg.hidden = fill.hidden = !custom;
        sub.hidden = custom && !wallCfg.depth;
        paintClock(lockEl, custom ? wallCfg.clock : null);
        wallTop = custom && wallCfg.top ? wallCfg.top : '#e9be32';
        if (!lockEl.hidden) lockTheme(true);
        store(WALL, custom ? wallCfg : null);
    }
    applyWall(wallCfg);
    fetch(FN + 'get-lock?part=config', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) { if (cfg && (cfg.v || 0) !== (wallCfg.v || 0)) applyWall(cfg); })
        .catch(function () {});

    function wake() {
        if (lockEl.classList.contains('is-pass')) return;
        lockEl.classList.add('is-pass');
        lockErr.textContent = '';
        lockInput.focus();               // inside the tap, so iOS raises the keyboard
    }
    function sleep() {
        lockEl.classList.remove('is-pass');
        lockInput.value = '';
        lockErr.textContent = '';
        lockInput.blur();
    }
    Array.prototype.forEach.call(lockEl.querySelectorAll('[data-wake]'), function (b) { b.addEventListener('click', wake); });
    $('lock-cancel').addEventListener('click', sleep);

    // Swipe up anywhere on the lock face, as on the phone.
    var swipeY = null;
    lockEl.addEventListener('pointerdown', function (e) { swipeY = lockEl.classList.contains('is-pass') ? null : e.clientY; });
    lockEl.addEventListener('pointerup', function (e) { if (swipeY != null && swipeY - e.clientY > 40) wake(); swipeY = null; });

    // On a keyboard, typing on the lock face starts the password; Escape goes back.
    document.addEventListener('keydown', function (e) {
        if (lockEl.hidden) return;
        if (e.key === 'Escape' && lockEl.classList.contains('is-pass')) { sleep(); return; }
        if (!lockEl.classList.contains('is-pass') && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || e.key === 'Enter')) wake();
    });

    startClock();
    lockTheme(true);

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
            lockInput.blur();
            setTimeout(function () {
                lockEl.hidden = true;
                lockEl.classList.remove('is-leaving', 'is-pass');
                clearInterval(clockTimer);
                lockTheme(false);
                app.hidden = false;
                requestAnimationFrame(function () { app.classList.add('is-in'); glass(); });
                markMe();
                syncNotes();
                syncPhotos();
                if (view === 'view-stats') syncStats();
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
        lockEl.classList.remove('is-pass');
        lockEl.hidden = false;
        lockTheme(true);
        startClock();
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
        $('view-stats').hidden = id !== 'view-stats';
        var notes = id === 'view-notes';
        actNew.hidden = id === 'view-stats';
        actNew.setAttribute('aria-label', notes ? 'New note' : 'Add photos');
        actNew.querySelector('use').setAttribute('href', notes ? '#i-compose' : '#i-plus');
        closeMenus();
        if (id === 'view-roll') { window.scrollTo(0, document.documentElement.scrollHeight); }
        else window.scrollTo(0, 0);
        if (id === 'view-stats' && pw && Date.now() - statsAt > 60000) syncStats();
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
            if (a === 'refresh-stats') syncStats().then(function (ok) { if (ok) say('Stats Up to Date'); });
            if (a === 'wallpaper') openWall();
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
            if (s.id === 'sheet-wall') wl = null;   // let the photo and its cutout go
            if (s.id === 'sheet-photo') $('sp-video').pause();
        });
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', function () {
            if (b.closest('#sheet-import') && importing) return;
            closeSheets();
        });
    });

    /* ═══════════ Stats ═══════════
       Who came to the site and from where, counted by /js/track.js. */
    var statsAt = 0, statDays = recall('ad-stat-days') || 7;
    var segBtns = Array.prototype.slice.call(document.querySelectorAll('.ad-seg [data-days]'));
    function markSeg() { segBtns.forEach(function (b) { b.setAttribute('aria-checked', String(+b.dataset.days === statDays)); }); }
    segBtns.forEach(function (b) {
        b.addEventListener('click', function () { statDays = +b.dataset.days; store('ad-stat-days', statDays); markSeg(); syncStats(); });
    });
    markSeg();

    // This device's own visits aren't counted unless you ask for them to be.
    function markMe() {
        try { if (recall('ad-count-me')) localStorage.removeItem('kv-me'); else localStorage.setItem('kv-me', '1'); } catch (_) {}
    }
    $('st-me').checked = !!recall('ad-count-me');
    $('st-me').addEventListener('change', function () { store('ad-count-me', this.checked || null); markMe(); });

    function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
    function flag(code) {
        return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint.apply(null, code.split('').map(function (c) { return 127397 + c.charCodeAt(0); })) + '  ' : '';
    }
    var PAGE_NAMES = { '/': 'Home', '/blog.html': 'Blog', '/roll.html': 'B-Roll', '/404.html': 'Page not found' };
    function pageName(p) {
        if (PAGE_NAMES[p]) return PAGE_NAMES[p];
        var n = p.replace(/^\/(work\/)?/, '').replace(/\.html$/, '').replace(/\/$/, '');
        return n ? n.split(/[-_]/).map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' ') : p;
    }
    function ago(t) {
        var m = Math.round((Date.now() - t) / 60000);
        if (m < 1) return 'Just now';
        if (m < 60) return m + ' min ago';
        return Math.floor(m / 60) + ' hr ago';
    }
    function dayLabel(date, long) {
        return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', long ? { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    // A ranked list: name, count and share of the total, with a thin bar for the share.
    function rankList(id, rows, total, unit) {
        var box = $(id);
        box.textContent = '';
        if (!rows.length) { box.appendChild(el('div', 'ad-stat ad-stat--empty', 'Nothing yet')); return; }
        rows.forEach(function (r) {
            var share = total ? r.n / total : 0;
            var row = el('div', 'ad-stat');
            var line = el('div', 'ad-stat__row');
            var name = el('span', 'ad-stat__name', r.name);
            if (r.title) name.title = r.title;
            line.appendChild(name);
            line.appendChild(el('span', 'ad-stat__n', fmt(r.n) + (total ? ' · ' + Math.round(share * 100) + '%' : '')));
            row.appendChild(line);
            var meter = el('div', 'ad-stat__meter');
            var fillBar = el('span');
            fillBar.style.width = Math.max(1.5, share * 100) + '%';
            meter.appendChild(fillBar);
            row.appendChild(meter);
            row.setAttribute('aria-label', r.name + ': ' + fmt(r.n) + ' ' + unit + (total ? ', ' + Math.round(share * 100) + ' percent' : ''));
            box.appendChild(row);
        });
    }

    // Visitors per day. Each day is a button: hover, focus or tap shows its numbers.
    function chart(series) {
        var box = $('st-chart'), plot = $('st-plot'), tip = $('st-tip'), axis = $('st-axis');
        box.hidden = series.length < 2;
        if (box.hidden) return;
        plot.textContent = ''; axis.textContent = ''; tip.hidden = true;
        plot.style.gap = series.length > 40 ? '1px' : '2px';
        var max = Math.max.apply(null, series.map(function (d) { return d.visitors; }).concat(1));
        box.querySelector('.ad-chart__hd').textContent = 'Visitors per day · busiest ' + fmt(max);
        function show(col) {
            plot.querySelectorAll('.is-on').forEach(function (c) { c.classList.remove('is-on'); });
            col.classList.add('is-on');
            plot.classList.add('is-picked');
            tip.textContent = col.dataset.tip;
            tip.hidden = false;
        }
        function hide() {
            plot.classList.remove('is-picked');
            plot.querySelectorAll('.is-on').forEach(function (c) { c.classList.remove('is-on'); });
            tip.hidden = true;
        }
        series.forEach(function (d) {
            var col = el('button', 'ad-chart__col');
            col.type = 'button';
            var text = dayLabel(d.date, true) + ' · ' + fmt(d.visitors) + ' visitor' + (d.visitors === 1 ? '' : 's') + ' · ' + fmt(d.views) + ' view' + (d.views === 1 ? '' : 's');
            col.dataset.tip = text;
            col.setAttribute('aria-label', text);
            if (!d.visitors) col.classList.add('is-zero');
            var bar = el('span', 'ad-chart__bar');
            bar.style.height = (d.visitors / max * 100) + '%';
            col.appendChild(bar);
            col.addEventListener('mouseenter', function () { show(col); });
            col.addEventListener('focus', function () { show(col); });
            col.addEventListener('click', function () { show(col); });
            plot.appendChild(col);
        });
        plot.onmouseleave = hide;
        axis.appendChild(el('span', '', dayLabel(series[0].date)));
        axis.appendChild(el('span', '', 'Today'));
    }

    function renderStats(d) {
        $('stats-count').textContent = statDays === 1 ? 'Today' : 'Last ' + statDays + ' days';
        $('st-visitors').textContent = fmt(d.visitors);
        $('st-views').textContent = fmt(d.views);
        $('st-now').textContent = fmt(d.now);
        chart(d.series || []);
        rankList('st-sources', (d.sources || []).map(function (r) { return { name: r[0], n: r[1] }; }), d.visitors, 'visitors');
        rankList('st-countries', (d.countries || []).map(function (r) { return { name: flag(r[0]) + r[1], n: r[2] }; }), d.visitors, 'visitors');
        rankList('st-cities', (d.cities || []).map(function (r) { return { name: r[0], n: r[1] }; }), d.visitors, 'visitors');
        rankList('st-pages', (d.pages || []).map(function (r) { return { name: pageName(r[0]), n: r[1], title: r[0] }; }), d.views, 'views');
        rankList('st-devices', (d.devices || []).map(function (r) { return { name: r[0], n: r[1] }; }), d.visitors, 'visitors');

        var recent = $('st-recent');
        recent.textContent = '';
        if (!d.recent || !d.recent.length) recent.appendChild(el('div', 'ad-stat ad-stat--empty', 'No visits yet today'));
        (d.recent || []).forEach(function (v) {
            var row = el('div', 'ad-stat');
            var line = el('div', 'ad-stat__row');
            line.appendChild(el('span', 'ad-stat__name', pageName(v.p)));
            line.appendChild(el('span', 'ad-stat__n', ago(v.t)));
            row.appendChild(line);
            var place = v.ci ? v.ci + (v.cn ? ', ' + v.cn : '') : (v.cn || '');
            row.appendChild(el('p', 'ad-stat__sub', [flag(v.c).trim() + (place ? ' ' + place : ''), v.s ? 'from ' + v.s : '', v.d].filter(function (x) { return x && x.trim(); }).join(' · ')));
            recent.appendChild(row);
        });
        glass();
    }

    function syncStats() {
        $('stats-count').textContent = 'Loading…';
        return api('get-stats', { days: statDays }).then(function (d) {
            statsAt = Date.now();
            renderStats(d);
            return true;
        }).catch(function (err) {
            $('stats-count').textContent = err.message;
            return false;
        });
    }

    /* ═══════════ Lock Screen ═══════════
       Pick a photo, drag and zoom it into the phone's shape, and the person in it
       is cut out (MediaPipe, in this browser) so the clock can sit behind them. */
    var W_OUT = 1179, H_OUT = 2556;
    var MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
    var MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
    var wl = null;            // the photo being set up: { work, z, cx, cy, cut, depth, clock, token }
    var wlKeep = null;        // settings for the saved photo when no new one is chosen
    var wlToken = 0;
    var wlFrame = $('wl-frame'), wlBg = $('wl-bg'), wlCut = $('wl-cut'), wlSaved = $('wl-saved'), wlDefault = $('wl-default');
    var wlStatus = $('wl-status'), wlSave = $('wl-save'), wlReset = $('wl-reset');

    function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    function wlSay(msg, kind) { wlStatus.textContent = msg || ''; wlStatus.className = 'ad-status' + (kind ? ' is-' + kind : ''); }

    function openWall() {
        wl = null;
        wlToken++;
        var custom = !!wallCfg.v;
        wlKeep = custom ? { clock: wallCfg.clock || '#ffffff', depth: !!wallCfg.depth } : null;
        wlFrame.classList.remove('is-photo');
        wlFrame.style.backgroundImage = custom ? 'url("' + wallUrl('bg', wallCfg.v) + '")' : '';
        wlFrame.style.backgroundSize = 'cover';
        wlBg.hidden = true; wlCut.hidden = true;
        wlDefault.hidden = custom;
        wlSaved.hidden = !(custom && wallCfg.depth);
        if (custom && wallCfg.cut) wlSaved.src = wallUrl('subject', wallCfg.v);
        $('wl-controls').hidden = !custom;
        $('wl-zoom').closest('.ad-field').hidden = true;
        $('wl-depth').checked = !!(custom && wallCfg.depth);
        $('wl-depth').disabled = !(custom && wallCfg.cut);
        markSwatch(custom ? wallCfg.clock : null);
        paintClock(wlFrame, custom ? wallCfg.clock : null);
        wlReset.hidden = !custom;
        wlReset.classList.remove('is-confirm');
        wlReset.textContent = 'Use the Original Wallpaper';
        $('wl-hint').hidden = false;
        wlSave.disabled = true;
        wlSay('');
        openSheet('sheet-wall');
        tick();
        requestAnimationFrame(function () { fitClock($('wl-time')); });
    }

    function markSwatch(value) {
        document.querySelectorAll('.ad-swatches [data-clock]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.clock === value)); });
        var pick = document.querySelector('.ad-swatches__pick');
        var known = value === 'auto' || !!document.querySelector('.ad-swatches [data-clock="' + value + '"]');
        pick.setAttribute('aria-checked', String(!!value && !known));
        if (value && value !== 'auto') $('wl-color').value = value;
    }

    // The part of the photo that shows, for the current zoom and position.
    function wlView() {
        var iw = wl.work.width, ih = wl.work.height;
        var s = Math.max(W_OUT / iw, H_OUT / ih) * wl.z;
        var vw = W_OUT / s, vh = H_OUT / s;
        wl.cx = Math.min(iw - vw / 2, Math.max(vw / 2, wl.cx));
        wl.cy = Math.min(ih - vh / 2, Math.max(vh / 2, wl.cy));
        return { x: wl.cx - vw / 2, y: wl.cy - vh / 2, w: vw, h: vh };
    }

    // Clock colour picked from the photo, as iOS does: the top's hue, made light
    // (or dark, when the top of the photo is already light).
    function photoColours(v) {
        var c = canvas(12, 26), g = c.getContext('2d');
        g.drawImage(wl.work, v.x, v.y, v.w, v.h, 0, 0, 12, 26);
        var px = g.getImageData(0, 0, 12, 11).data, r = 0, gr = 0, b = 0, n = 0;
        // Judge only what's behind the person (the clock sits on that), not their hair or face.
        var behind = null;
        if (wl.cut) {
            var m = canvas(12, 26), mg = m.getContext('2d');
            mg.drawImage(wl.cut, v.x, v.y, v.w, v.h, 0, 0, 12, 26);
            behind = mg.getImageData(0, 0, 12, 11).data;
        }
        for (var i = 0; i < px.length; i += 4) {
            var wt = behind ? 1 - behind[i + 3] / 255 : 1;
            r += px[i] * wt; gr += px[i + 1] * wt; b += px[i + 2] * wt; n += wt;
        }
        if (n < 1) { r = gr = b = 0; n = 0; for (var j2 = 0; j2 < px.length; j2 += 4) { r += px[j2]; gr += px[j2 + 1]; b += px[j2 + 2]; n++; } }
        r /= n * 255; gr /= n * 255; b /= n * 255;
        var top = g.getImageData(0, 0, 12, 1).data, tr = 0, tg = 0, tb = 0;
        for (var j = 0; j < top.length; j += 4) { tr += top[j]; tg += top[j + 1]; tb += top[j + 2]; }
        var hexOf = function (R, G, B) { return '#' + ((1 << 24) | (Math.round(R) << 16) | (Math.round(G) << 8) | Math.round(B)).toString(16).slice(1); };
        var mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
        if (d) {
            s = d / (1 - Math.abs(2 * l - 1));
            h = mx === r ? ((gr - b) / d) % 6 : mx === gr ? (b - r) / d + 2 : (r - gr) / d + 4;
            h *= 60; if (h < 0) h += 360;
        }
        var L = l > 0.72 ? 0.2 : 0.88, S = s < 0.12 ? 0 : Math.min(0.85, s * 0.9 + 0.15);
        var k = function (n2) { var a = S * Math.min(L, 1 - L), kk = (n2 + h / 30) % 12; return 255 * (L - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1))); };
        return { clock: hexOf(k(0), k(8), k(4)), top: hexOf(tr / 12, tg / 12, tb / 12) };
    }

    function wlClock() {
        if (wl) return wl.clock === 'auto' ? photoColours(wlView()).clock : wl.clock;
        return wlKeep ? wlKeep.clock : null;
    }

    var wlFrameReq = 0;
    function wlRender() {
        cancelAnimationFrame(wlFrameReq);
        wlFrameReq = requestAnimationFrame(function () {
            if (!wl) return;
            var v = wlView();
            var r = wlFrame.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
            var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
            [wlBg, wlCut].forEach(function (c) { if (c.width !== cw) c.width = cw; if (c.height !== ch) c.height = ch; });
            wlBg.getContext('2d').drawImage(wl.work, v.x, v.y, v.w, v.h, 0, 0, cw, ch);
            wlCut.hidden = !(wl.cut && wl.depth);
            if (!wlCut.hidden) {
                var g = wlCut.getContext('2d');
                g.clearRect(0, 0, cw, ch);
                g.drawImage(wl.cut, v.x, v.y, v.w, v.h, 0, 0, cw, ch);
            }
            paintClock(wlFrame, wlClock());
        });
    }

    $('wl-pick').addEventListener('click', function () { $('wl-file').click(); });
    $('wl-file').addEventListener('change', function () {
        var file = this.files && this.files[0];
        this.value = '';
        if (file) loadWallPhoto(file);
    });

    function loadWallPhoto(file) {
        var token = ++wlToken;
        wlSay('Opening the photo…');
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onerror = function () { URL.revokeObjectURL(url); wlSay('That file could not be opened as a photo.', 'error'); };
        img.onload = function () {
            URL.revokeObjectURL(url);
            if (token !== wlToken) return;
            // Work at up to 2560px on the long side: plenty for a 1179 × 2556 crop with room to zoom.
            var k = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
            var work = canvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
            work.getContext('2d').drawImage(img, 0, 0, work.width, work.height);
            wl = { work: work, z: 1, cx: work.width / 2, cy: work.height / 2, cut: null, depth: false, clock: 'auto' };
            wlKeep = null;
            wlFrame.style.backgroundImage = '';
            wlFrame.classList.add('is-photo');
            wlBg.hidden = false; wlDefault.hidden = true; wlSaved.hidden = true;
            $('wl-controls').hidden = false;
            $('wl-zoom').closest('.ad-field').hidden = false;
            $('wl-zoom').value = 1;
            $('wl-depth').checked = false;
            $('wl-depth').disabled = true;
            $('wl-hint').hidden = true;
            markSwatch('auto');
            wlSave.disabled = false;
            wlRender();
            wlSay('Finding you in the photo…');
            cutout(work).then(function (res) {
                if (token !== wlToken || !wl) return;
                if (res.cover < 0.015) {
                    wlSay('No person found in this photo, so the clock sits in front.');
                    return;
                }
                wl.cut = res.cut;
                wl.depth = true;
                $('wl-depth').checked = true;
                $('wl-depth').disabled = false;
                wlRender();
                wlSay('Drag to move the photo. Pinch or use Zoom to resize it.');
            }).catch(function () {
                if (token !== wlToken) return;
                wlSay('Couldn’t cut you out (the cutout tool didn’t load). The clock will sit in front.', 'error');
            });
        };
        img.src = url;
    }

    // Drag to move, pinch or scroll to zoom.
    var wlPointers = new Map(), wlPinch = 0;
    function pinchDist() { var p = Array.from(wlPointers.values()); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
    wlFrame.addEventListener('pointerdown', function (e) {
        if (!wl) return;
        wlFrame.setPointerCapture(e.pointerId);
        wlPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (wlPointers.size === 2) wlPinch = pinchDist();
    });
    wlFrame.addEventListener('pointermove', function (e) {
        if (!wl || !wlPointers.has(e.pointerId)) return;
        var prev = wlPointers.get(e.pointerId);
        wlPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (wlPointers.size === 2) {
            var d = pinchDist();
            if (wlPinch) setZoom(wl.z * d / wlPinch);
            wlPinch = d;
            return;
        }
        var v = wlView(), r = wlFrame.getBoundingClientRect();
        wl.cx -= (e.clientX - prev.x) * v.w / r.width;
        wl.cy -= (e.clientY - prev.y) * v.h / r.height;
        wlRender();
    });
    function endPointer(e) { wlPointers.delete(e.pointerId); if (wlPointers.size < 2) wlPinch = 0; }
    wlFrame.addEventListener('pointerup', endPointer);
    wlFrame.addEventListener('pointercancel', endPointer);
    wlFrame.addEventListener('wheel', function (e) {
        if (!wl) return;
        e.preventDefault();
        setZoom(wl.z * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    function setZoom(z) {
        wl.z = Math.min(3, Math.max(1, z));
        $('wl-zoom').value = wl.z;
        wlRender();
    }
    $('wl-zoom').addEventListener('input', function () { if (wl) setZoom(+this.value); });

    $('wl-depth').addEventListener('change', function () {
        if (wl) { wl.depth = this.checked; wlRender(); }
        else if (wlKeep) {
            wlKeep.depth = this.checked;
            wlSaved.hidden = !this.checked;
            wlSave.disabled = false;
        }
    });

    function setClock(value) {
        markSwatch(value);
        if (wl) { wl.clock = value; wlRender(); }
        else if (wlKeep) {
            wlKeep.clock = value === 'auto' ? wallCfg.clock : value;
            paintClock(wlFrame, wlKeep.clock);
            wlSave.disabled = false;
        }
    }
    document.querySelectorAll('.ad-swatches [data-clock]').forEach(function (b) {
        b.addEventListener('click', function () { setClock(b.dataset.clock); });
    });
    $('wl-color').addEventListener('input', function () { setClock(this.value.toLowerCase()); });

    wlSave.addEventListener('click', function () {
        var body;
        if (wl) {
            var v = wlView(), colours = photoColours(v);
            var out = canvas(W_OUT, H_OUT), g = out.getContext('2d');
            g.drawImage(wl.work, v.x, v.y, v.w, v.h, 0, 0, W_OUT, H_OUT);
            body = { bg: out.toDataURL('image/jpeg', 0.86), depth: wl.depth, clock: wl.clock === 'auto' ? colours.clock : wl.clock, top: colours.top };
            if (wl.cut) {
                g.clearRect(0, 0, W_OUT, H_OUT);
                g.drawImage(wl.cut, v.x, v.y, v.w, v.h, 0, 0, W_OUT, H_OUT);
                body.subject = out.toDataURL('image/webp', 0.86);   // browsers without WebP give PNG; the server takes both
            }
        } else if (wlKeep) {
            body = { keep: true, depth: wlKeep.depth, clock: wlKeep.clock };
        } else return;
        wlSave.disabled = true;
        wlSay('Saving…');
        api('save-lock', body).then(function (res) {
            applyWall(res.config);
            closeSheets();
            say('Lock Screen Updated');
        }).catch(function (err) {
            wlSave.disabled = false;
            wlSay(err.message, 'error');
        });
    });

    wlReset.addEventListener('click', function () {
        if (!wlReset.classList.contains('is-confirm')) {
            wlReset.classList.add('is-confirm');
            wlReset.textContent = 'Tap Again to Use the Original';
            return;
        }
        wlReset.disabled = true;
        api('save-lock', { reset: true }).then(function () {
            applyWall({});
            closeSheets();
            say('Original Wallpaper Back');
        }).catch(function (err) { wlSay(err.message, 'error'); }).then(function () { wlReset.disabled = false; });
    });

    /* The cutout. MediaPipe's person model gives a rough mask at 256px; a guided
       filter then snaps its edge to the edges in the photo, so hair and
       shoulders follow the real outline instead of a blurry blob. */
    // MediaPipe comes from a CDN, so it runs in a sandboxed frame with its own
    // opaque origin: it gets the pixels and returns the mask, and can never reach
    // this page, the password in memory or this site's storage.
    var segmenterP = null;
    function segmenter() {
        if (segmenterP) return segmenterP;
        segmenterP = new Promise(function (resolve, reject) {
            var frame = document.createElement('iframe');
            frame.setAttribute('sandbox', 'allow-scripts');
            frame.setAttribute('aria-hidden', 'true');
            frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
            frame.srcdoc = '<script type="module">' +
                'try {' +
                'const v = await import("' + MP + '/vision_bundle.mjs");' +
                'const files = await v.FilesetResolver.forVisionTasks("' + MP + '/wasm");' +
                'const seg = await v.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: "' + MP_MODEL + '", delegate: "CPU" }, runningMode: "IMAGE", outputCategoryMask: false, outputConfidenceMasks: true });' +
                'addEventListener("message", (e) => {' +
                '  try {' +
                '    const res = seg.segment(e.data.image), m = res.confidenceMasks[0];' +
                '    const mask = m.getAsFloat32Array().slice(), w = m.width, h = m.height;' +
                '    res.confidenceMasks.forEach((x) => x.close());' +
                '    parent.postMessage({ id: e.data.id, mask, w, h }, "*", [mask.buffer]);' +
                '  } catch (err) { parent.postMessage({ id: e.data.id, error: String(err) }, "*"); }' +
                '});' +
                'parent.postMessage({ ready: true }, "*");' +
                '} catch (err) { parent.postMessage({ failed: String(err) }, "*"); }' +
                '<\/script>';
            var pending = {}, nextId = 1;
            var timer = setTimeout(function () { fail('timeout'); }, 60000);
            function fail(why) { clearTimeout(timer); frame.remove(); segmenterP = null; reject(new Error(why)); }
            window.addEventListener('message', function (e) {
                if (e.source !== frame.contentWindow || !e.data) return;
                if (e.data.failed) return fail(e.data.failed);
                if (e.data.ready) {
                    clearTimeout(timer);
                    resolve({
                        segment: function (imageData) {
                            return new Promise(function (ok, no) {
                                var id = nextId++;
                                pending[id] = { ok: ok, no: no };
                                frame.contentWindow.postMessage({ id: id, image: imageData }, '*');
                            });
                        }
                    });
                    return;
                }
                var job = pending[e.data.id];
                if (!job) return;
                delete pending[e.data.id];
                if (e.data.error) job.no(new Error(e.data.error)); else job.ok(e.data);
            });
            document.body.appendChild(frame);
        });
        return segmenterP;
    }

    // Mean over a (2r+1)² square, edges handled by averaging only what's inside.
    function boxBlur(src, w, h, r) {
        var tmp = new Float32Array(w * h), out = new Float32Array(w * h), P = new Float64Array(Math.max(w, h) + 1), x, y, a, b;
        for (y = 0; y < h; y++) {
            P[0] = 0;
            for (x = 0; x < w; x++) P[x + 1] = P[x] + src[y * w + x];
            for (x = 0; x < w; x++) { a = Math.max(0, x - r); b = Math.min(w, x + r + 1); tmp[y * w + x] = (P[b] - P[a]) / (b - a); }
        }
        for (x = 0; x < w; x++) {
            P[0] = 0;
            for (y = 0; y < h; y++) P[y + 1] = P[y] + tmp[y * w + x];
            for (y = 0; y < h; y++) { a = Math.max(0, y - r); b = Math.min(h, y + r + 1); out[y * w + x] = (P[b] - P[a]) / (b - a); }
        }
        return out;
    }
    function guidedFilter(I, p, w, h, r, eps) {
        var n = w * h, i, II = new Float32Array(n), Ip = new Float32Array(n);
        for (i = 0; i < n; i++) { II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
        var mI = boxBlur(I, w, h, r), mP = boxBlur(p, w, h, r), mII = boxBlur(II, w, h, r), mIp = boxBlur(Ip, w, h, r);
        var A = new Float32Array(n), B = new Float32Array(n);
        for (i = 0; i < n; i++) {
            A[i] = (mIp[i] - mI[i] * mP[i]) / (mII[i] - mI[i] * mI[i] + eps);
            B[i] = mP[i] - A[i] * mI[i];
        }
        var mA = boxBlur(A, w, h, r), mB = boxBlur(B, w, h, r), q = new Float32Array(n);
        for (i = 0; i < n; i++) q[i] = mA[i] * I[i] + mB[i];
        return q;
    }

    function cutout(work) {
        return segmenter().then(function (seg) {
            var k = Math.min(1, 1280 / Math.max(work.width, work.height));
            var gw = Math.round(work.width * k), gh = Math.round(work.height * k), n = gw * gh, i;
            var guide = canvas(gw, gh), gg = guide.getContext('2d');
            gg.drawImage(work, 0, 0, gw, gh);

            var pixels = gg.getImageData(0, 0, gw, gh);
            return seg.segment(pixels).then(function (res) {
            var raw = res.mask, mw = res.w, mh = res.h;
            var p = new Float32Array(n);
            for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
                var sx = Math.min(mw - 1, Math.floor(x * mw / gw)), sy = Math.min(mh - 1, Math.floor(y * mh / gh));
                p[y * gw + x] = 1 - raw[sy * mw + sx];
            }

            var px = pixels.data, I = new Float32Array(n);
            for (i = 0; i < n; i++) I[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
            var q = guidedFilter(I, p, gw, gh, Math.max(4, Math.round(Math.max(gw, gh) / 180)), 0.0008);

            var maskData = gg.createImageData(gw, gh), md = maskData.data, cover = 0;
            for (i = 0; i < n; i++) {
                var t = Math.min(1, Math.max(0, (q[i] - 0.3) / 0.4)), a = t * t * (3 - 2 * t);
                md[i * 4 + 3] = Math.round(a * 255);
                cover += a;
            }
            var mask = canvas(gw, gh);
            mask.getContext('2d').putImageData(maskData, 0, 0);
            var cut = canvas(work.width, work.height), cg = cut.getContext('2d');
            cg.drawImage(work, 0, 0);
            cg.globalCompositeOperation = 'destination-in';
            cg.drawImage(mask, 0, 0, work.width, work.height);
            return { cut: cut, cover: cover / n };
            });
        });
    }

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
    function videoUrl(p) { return FN + 'get-gallery-video?uid=' + encodeURIComponent(p.video.uid); }
    function clockTime(s) { s = Math.round(+s || 0); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

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
        var vids = photos.filter(function (p) { return p.video; }).length, stills = photos.length - vids;
        $('roll-count').textContent = [stills ? stills + (stills === 1 ? ' Photo' : ' Photos') : '', vids ? vids + (vids === 1 ? ' Video' : ' Videos') : ''].filter(Boolean).join(' · ') || '0 Photos';
        var frag = document.createDocumentFragment();
        photos.forEach(function (p, i) {
            var b = el('button', 'ad-tile');
            b.type = 'button';
            b.dataset.id = p.id;
            b.setAttribute('aria-label', (p.caption || (p.video ? 'Video' : 'Photo')) + ', ' + N.rowDate(dayOf(p)));
            if (p.video) b.appendChild(el('span', 'ad-tile__dur', clockTime(p.video.dur)));
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

    /* ── Videos ──
       Shrunk here before upload: 720p H.264 MP4 at about 2.5 Mbps, at most a
       minute long, without sound (B-Roll plays muted). Frames come from playing
       the file once in a hidden player, so it takes about as long as the clip. */
    var VIDEO_LONG_SIDE = 1280, VIDEO_MAX_SECONDS = 60, VIDEO_PART = 3 * 1024 * 1024;

    // When a video was shot: the movie header's creation time (seconds since 1904, UTC).
    function videoDate(file) {
        function find(buf) {
            var b = new Uint8Array(buf);
            for (var i = 4; i < b.length - 24; i++) {
                if (b[i] === 0x6d && b[i + 1] === 0x76 && b[i + 2] === 0x68 && b[i + 3] === 0x64) {   // "mvhd"
                    var v = new DataView(buf, i + 4), secs = v.getUint8(0) === 1 ? v.getUint32(4) * 4294967296 + v.getUint32(8) : v.getUint32(4);
                    if (!secs) return null;
                    var d = new Date((secs - 2082844800) * 1000);
                    return d.getFullYear() > 2000 && d.getTime() < Date.now() + 86400000 ? localStamp(d) : null;
                }
            }
            return null;
        }
        var head = file.slice(0, 1 << 20), tail = file.slice(Math.max(0, file.size - (4 << 20)));
        return head.arrayBuffer().then(function (b) { return find(b) || tail.arrayBuffer().then(find); }).catch(function () { return null; });
    }

    function once(target, ev) {
        return new Promise(function (res, rej) {
            function ok() { target.removeEventListener('error', bad); res(); }
            function bad() { target.removeEventListener(ev, ok); rej(new Error('This video can’t be read in this browser. Try adding it from your phone.')); }
            target.addEventListener(ev, ok, { once: true });
            target.addEventListener('error', bad, { once: true });
        });
    }
    function even(n) { return Math.max(2, Math.round(n / 2) * 2); }

    function processVideo(file, progress) {
        var url = URL.createObjectURL(file);
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('playsinline', '');
        // On screen (barely) so phones keep decoding it
        v.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
        document.body.appendChild(v);
        var lock = null;
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
        function cleanup() { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); URL.revokeObjectURL(url); if (lock) lock.release().catch(function () {}); }

        var meta = once(v, 'loadedmetadata');
        v.src = url;
        return meta.then(function () {
            var sw = v.videoWidth, sh = v.videoHeight;
            if (!sw || !sh) throw new Error('This video can’t be read in this browser.');
            var dur = Math.min(v.duration || 0, VIDEO_MAX_SECONDS);
            var k = Math.min(1, VIDEO_LONG_SIDE / Math.max(sw, sh));
            var tw = even(sw * k), th = even(sh * k);

            // Poster and grid tile from the first frame
            var seek = once(v, 'seeked');
            v.currentTime = Math.min(0.1, dur / 2);
            return seek.then(function () {
                var pk = Math.min(1, 1600 / Math.max(sw, sh));
                var pc = canvas(Math.round(sw * pk), Math.round(sh * pk));
                pc.getContext('2d').drawImage(v, 0, 0, pc.width, pc.height);
                var poster = pc.toDataURL('image/jpeg', 0.82);
                var tk = Math.min(1, 400 / Math.min(pc.width, pc.height));
                var tc = canvas(Math.max(1, Math.round(pc.width * tk)), Math.max(1, Math.round(pc.height * tk)));
                tc.getContext('2d').drawImage(pc, 0, 0, tc.width, tc.height);
                var thumb = webpOK ? tc.toDataURL('image/webp', 0.74) : tc.toDataURL('image/jpeg', 0.78);
                var base = { poster: poster, thumb: thumb, w: pc.width, h: pc.height, dur: dur, trimmed: (v.duration || 0) > VIDEO_MAX_SECONDS + 0.5 };

                if (!window.VideoEncoder || !window.VideoFrame) {
                    // Can't shrink here: send the file as it is, if it's a reasonable size.
                    if (file.size > 60 * 1024 * 1024) throw new Error('This browser can’t shrink videos and this one is over 60MB. Add it from your phone.');
                    return Object.assign(base, { blob: file });
                }
                return encode(v, tw, th, dur, progress).then(function (blob) {
                    // An MP4 that's already smaller (and not trimmed) is kept as it is.
                    if (file.type === 'video/mp4' && file.size <= blob.size && !base.trimmed) blob = file;
                    return Object.assign(base, { blob: blob });
                });
            });
        }).then(function (out) { cleanup(); return out; }, function (err) { cleanup(); throw err; });
    }

    function encode(v, tw, th, dur, progress) {
        var bitrate = Math.round(2500000 * (tw * th) / (1280 * 720));
        var codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42e01f'];
        function pick(i) {
            if (i >= codecs.length) return Promise.reject(new Error('This browser can’t make MP4 video. Try Safari or Chrome.'));
            var cfg = { codec: codecs[i], width: tw, height: th, bitrate: bitrate, framerate: 30, avc: { format: 'avc' } };
            return VideoEncoder.isConfigSupported(cfg).then(function (r) { return r.supported ? cfg : pick(i + 1); }, function () { return pick(i + 1); });
        }
        return Promise.all([pick(0), import('/_p7n3x/vendor/mp4-muxer.mjs')]).then(function (got) {
            var cfg = got[0], M = got[1];
            var muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: tw, height: th, frameRate: 30 }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
            var failure = null;
            var enc = new VideoEncoder({ output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); }, error: function (e) { failure = e; } });
            enc.configure(cfg);
            var c = canvas(tw, th), g = c.getContext('2d');
            var n = 0, lastT = -1;

            return new Promise(function (resolve, reject) {
                var finished = false;
                function grab(t) {
                    if (finished) return;
                    if (failure) return finish(failure);
                    if (t >= dur) return finish();
                    if (t > lastT) {
                        lastT = t;
                        g.drawImage(v, 0, 0, tw, th);
                        var frame = new VideoFrame(c, { timestamp: Math.round(t * 1e6) });
                        enc.encode(frame, { keyFrame: n % 60 === 0 });
                        frame.close();
                        n++;
                        progress(Math.min(1, t / dur));
                    }
                }
                function finish(err) {
                    if (finished) return;
                    finished = true;
                    v.pause();
                    if (err) return reject(err instanceof Error ? err : new Error(String(err)));
                    if (!n) return reject(new Error('No frames could be read from this video.'));
                    enc.flush().then(function () {
                        enc.close();
                        muxer.finalize();
                        resolve(new Blob([muxer.target.buffer], { type: 'video/mp4' }));
                    }, reject);
                }
                if (v.requestVideoFrameCallback) {
                    var onFrame = function (now, m) { grab(m.mediaTime); if (!finished) v.requestVideoFrameCallback(onFrame); };
                    v.requestVideoFrameCallback(onFrame);
                } else {
                    var timer = setInterval(function () { if (finished) clearInterval(timer); else grab(v.currentTime); }, 33);
                }
                v.addEventListener('ended', function () { finish(); }, { once: true });
                var start = once(v, 'seeked');
                v.currentTime = 0;
                start.then(function () { return v.play(); }).catch(finish);
            });
        });
    }

    // Upload in 3MB chunks (each request stays under the 6MB function limit).
    function uploadVideo(blob, progress) {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        var id = Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
        var parts = Math.ceil(blob.size / VIDEO_PART);
        function base64(part) {
            return new Promise(function (res, rej) {
                var r = new FileReader();
                r.onload = function () { res(String(r.result).split(',')[1] || ''); };
                r.onerror = function () { rej(new Error('Could not read the video.')); };
                r.readAsDataURL(part);
            });
        }
        function send(i, tries) {
            return base64(blob.slice(i * VIDEO_PART, (i + 1) * VIDEO_PART)).then(function (data) {
                return api('save-gallery-video', { uid: id, part: i, data: data });
            }).catch(function (err) {
                if (tries < 2 && !/Signed out/.test(err.message)) return send(i, tries + 1);
                throw err;
            });
        }
        var chain = Promise.resolve();
        for (var i = 0; i < parts; i++) {
            (function (i) { chain = chain.then(function () { return send(i, 0).then(function () { progress((i + 1) / parts); }); }); }(i));
        }
        return chain.then(function () { return { uid: id, parts: parts, size: blob.size }; });
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
            var isVideo = /^video\//.test(file.type) || /\.(mov|mp4|m4v)$/i.test(file.name || '');
            if (!isVideo && !/^image\/(jpeg|png|webp)$/.test(file.type)) { skipped++; return; }
            // Until the metadata is read, fall back to the file's own date
            var mod = new Date(file.lastModified || Date.now());
            var item = { uid: ++uid, file: file, video: isVideo, url: URL.createObjectURL(file), caption: '', date: N.iso(mod), stamp: localStamp(mod), fromPhoto: false };
            queue.push(item);
            (isVideo ? videoDate(file) : exifDate(file)).then(function (s) {
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
        $('si-status').textContent = skipped ? skipped + ' file' + (skipped === 1 ? '' : 's') + ' skipped. Photos (JPG, PNG, WebP) and videos only.' : '';
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
            var img;
            if (item.video) {
                img = document.createElement('video');
                img.muted = true; img.playsInline = true; img.preload = 'metadata';
                img.src = item.url + '#t=0.1';   // shows a frame, not a black box
            } else {
                img = document.createElement('img');
                img.alt = '';
                img.src = item.url;
            }
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
        var nv = queue.filter(function (q) { return q.state !== 'done' && q.video; }).length;
        var noun = nv === 0 ? 'Photo' : nv === left ? 'Video' : 'Item';
        $('si-title').textContent = 'Add ' + left + ' ' + noun + (left === 1 ? '' : 's');
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
                var of = (i + 1) + ' of ' + todo.length;
                status.textContent = 'Adding ' + of + '…';
                var fields = { caption: item.caption.trim(), place: place, takenAt: item.date, takenStamp: item.stamp };
                var job = item.video
                    ? processVideo(item.file, function (f) { status.textContent = 'Shrinking video ' + of + '… ' + Math.round(f * 100) + '%'; })
                        .then(function (out) {
                            if (out.trimmed) say('Videos are kept to the first minute');
                            return uploadVideo(out.blob, function (f) { status.textContent = 'Uploading video ' + of + '… ' + Math.round(f * 100) + '%'; })
                                .then(function (up) {
                                    return api('save-gallery', Object.assign({ image: out.poster, thumb: out.thumb, w: out.w, h: out.h, video: { uid: up.uid, parts: up.parts, size: up.size, dur: out.dur } }, fields));
                                });
                        })
                    : process(item.file).then(function (out) {
                        return api('save-gallery', Object.assign({ image: out.image, thumb: out.thumb, w: out.w, h: out.h }, fields));
                    });
                return job.then(function () { item.state = 'done'; done++; }, function (err) {
                    item.state = 'failed'; failed++;
                    item.error = err && err.message;
                });
            }).then(renderQueue);
        }, Promise.resolve()).then(function () {
            importing = false;
            renderQueue();
            syncPhotos();
            if (!failed) {
                closeSheets();
                $('si-place').value = '';
                say(done === 1 ? 'Added to B-Roll' : done + ' Added to B-Roll');
            } else {
                var why = todo.filter(function (q) { return q.state === 'failed' && q.error; }).map(function (q) { return q.error; })[0];
                status.className = 'ad-status is-error';
                status.textContent = done + ' added, ' + failed + ' failed' + (why ? ' (' + why + ')' : '') + '. The failed ones are outlined; tap Add to try again.';
            }
        });
    });

    /* ── Edit a photo ── */
    var editing = null;
    function openPhoto(p) {
        editing = p;
        var img = $('sp-img'), vid = $('sp-video');
        img.hidden = !!p.video;
        vid.hidden = !p.video;
        if (p.video) {
            img.removeAttribute('src');
            vid.poster = fullUrl(p);
            vid.src = videoUrl(p);
            vid.play().catch(function () {});
        } else {
            vid.pause(); vid.removeAttribute('src');
            img.src = tileUrl(p);
            var full = new Image();
            full.onload = function () { if (editing === p) img.src = full.src; };
            full.src = fullUrl(p);
        }
        $('sp-caption').value = p.caption || '';
        $('sp-place').value = p.place || '';
        $('sp-date').value = dayOf(p);
        $('sp-link').value = p.link || '';
        var meta = ['Added ' + N.longDate(String(p.createdAt || '').slice(0, 10))];
        if (p.w && p.h) meta.push(p.w + ' × ' + p.h);
        if (p.video) meta.push(clockTime(p.video.dur) + ' video, ' + (p.video.size / 1048576).toFixed(1) + 'MB');
        meta.push(p.thumb ? 'Fast preview ready' : 'No fast preview yet');
        $('sp-meta').textContent = meta.join(' · ');
        $('sp-view').href = '/roll.html#photo-' + p.id;
        var del = $('sp-delete');
        del.classList.remove('is-confirm');
        del.textContent = p.video ? 'Delete Video' : 'Delete Photo';
        $('sp-title').textContent = p.video ? 'Video' : 'Photo';
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
