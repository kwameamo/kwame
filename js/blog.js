/* ─────────────────────────────────────────
   BLOG — Apple Notes
   Lists notes in Notes' groups, searches them
   as you type, and opens one full screen with
   share, copy link and newer / older notes.
   Every note keeps its link: blog.html?post=<id>
───────────────────────────────────────── */
(function () {
    'use strict';

    var N = window.NotesCore;
    if (!N) return;

    var groupsEl  = document.getElementById('nt-groups');
    var countEl   = document.getElementById('nt-count');
    var topBar    = document.getElementById('nt-top');
    var titleEl   = document.getElementById('nt-title');
    var q         = document.getElementById('nt-q');
    var clearBtn  = document.getElementById('nt-clear');
    var reader    = document.getElementById('nt-reader');
    var scroller  = document.getElementById('nt-scroll');
    var toast     = document.getElementById('nt-toast');
    var toastText = document.getElementById('nt-toast-text');
    var menu      = document.getElementById('nt-menu');
    var moreBtn   = document.getElementById('nt-more');
    var rmenu     = document.getElementById('nt-rmenu');
    var rmoreBtn  = document.getElementById('nt-rmore');

    var notes = [];   // newest first
    var at = -1;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    function glassRefresh() { if (window.LiquidGlass) window.LiquidGlass.refresh(); }

    // Text with the search match highlighted, built without innerHTML
    function marked(text, query) {
        var frag = document.createDocumentFragment();
        if (!query) { frag.appendChild(document.createTextNode(text)); return frag; }
        var lower = text.toLowerCase(), from = 0, i;
        while ((i = lower.indexOf(query, from)) !== -1) {
            if (i > from) frag.appendChild(document.createTextNode(text.slice(from, i)));
            frag.appendChild(el('mark', '', text.slice(i, i + query.length)));
            from = i + query.length;
        }
        if (from < text.length) frag.appendChild(document.createTextNode(text.slice(from)));
        return frag;
    }

    /* ── Load ── */
    function load() {
        return fetch('/.netlify/functions/get-posts')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { if (Array.isArray(d)) return d; throw new Error('no posts'); })
            .catch(function () {
                return fetch('/blog-posts.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
            });
    }

    load().then(function (list) {
        notes = N.sort(Array.isArray(list) ? list : []);
        notes.forEach(function (n) {
            n.folder = n.folder || 'Notes';
            n.text = N.plain(n.content);
            n.preview = N.preview(n);
        });
        countEl.textContent = notes.length + (notes.length === 1 ? ' Note' : ' Notes');
        render();
        openFromUrl(true);
    });

    /* ── List ── */
    function row(note, query) {
        var b = el('button', 'nt-row');
        b.type = 'button';
        b.dataset.id = note.id;
        var t = el('span', 'nt-row__title');
        t.appendChild(marked(note.title || 'New Note', query));
        b.appendChild(t);
        var line = el('span', 'nt-row__line');
        line.appendChild(el('span', 'nt-row__date', N.rowDate(note.date)));
        var p = el('span', 'nt-row__preview');
        var prev = note.preview;
        // While searching, show the words around the match
        if (query) {
            var hit = note.text.toLowerCase().indexOf(query);
            if (hit > 40 && note.preview.toLowerCase().indexOf(query) === -1) prev = '…' + note.text.slice(hit - 30, hit + 120);
        }
        p.appendChild(marked(prev, query));
        line.appendChild(p);
        b.appendChild(line);
        var f = el('span', 'nt-row__folder');
        f.appendChild(icon(note.pinned ? 'nt-i-pin' : 'nt-i-folder'));
        f.appendChild(document.createTextNode(note.folder));
        b.appendChild(f);
        return b;
    }

    function section(label, list, query) {
        var s = el('section', 'nt-group');
        var h = el('h2', 'nt-group__hd', label);
        s.appendChild(h);
        var card = el('div', 'nt-card');
        list.forEach(function (n) { card.appendChild(row(n, query)); });
        s.appendChild(card);
        return s;
    }

    function render() {
        var query = (q.value || '').trim().toLowerCase();
        groupsEl.replaceChildren();
        clearBtn.hidden = !query;

        if (!notes.length) {
            var e = el('p', 'nt-empty');
            e.appendChild(el('strong', '', 'No Notes'));
            e.appendChild(document.createTextNode('Notes from the build will show up here.'));
            groupsEl.appendChild(e);
            return;
        }

        if (query) {
            var top = [], rest = [];
            notes.forEach(function (n) {
                if ((n.title || '').toLowerCase().indexOf(query) !== -1) top.push(n);
                else if (n.text.toLowerCase().indexOf(query) !== -1 || n.folder.toLowerCase().indexOf(query) !== -1) rest.push(n);
            });
            if (!top.length && !rest.length) {
                var none = el('p', 'nt-empty');
                none.appendChild(el('strong', '', 'No Results'));
                none.appendChild(document.createTextNode('Check the spelling or try a new search.'));
                groupsEl.appendChild(none);
            }
            if (top.length) groupsEl.appendChild(section('Top Hits', top, query));
            if (rest.length) groupsEl.appendChild(section('Notes', rest, query));
        } else {
            N.group(notes).forEach(function (g) { groupsEl.appendChild(section(g.label, g.notes, '')); });
        }
        glassRefresh();
    }

    groupsEl.addEventListener('click', function (e) {
        var b = e.target.closest('.nt-row');
        if (!b) return;
        var i = indexOf(+b.dataset.id);
        if (i >= 0) open(i);
    });

    var searchTimer = null;
    q.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(render, 80);
    });
    q.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { q.value = ''; render(); q.blur(); }
        if (e.key === 'Enter') {
            var first = groupsEl.querySelector('.nt-row');
            if (first) first.click();
        }
    });
    clearBtn.addEventListener('click', function () { q.value = ''; render(); q.focus(); });

    // The big title tucks into the bar as it scrolls away, like Notes
    function onScroll() {
        var past = titleEl.getBoundingClientRect().bottom < topBar.getBoundingClientRect().bottom;
        topBar.classList.toggle('is-scrolled', past);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Menus ── */
    function closeMenus() {
        [menu, rmenu].forEach(function (m) { m.classList.remove('is-shown'); });
        moreBtn.setAttribute('aria-expanded', 'false');
        rmoreBtn.setAttribute('aria-expanded', 'false');
    }
    function toggle(m, btn) {
        return function (e) {
            e.stopPropagation();
            var show = !m.classList.contains('is-shown');
            closeMenus();
            m.classList.toggle('is-shown', show);
            btn.setAttribute('aria-expanded', String(show));
            glassRefresh();
        };
    }
    moreBtn.addEventListener('click', toggle(menu, moreBtn));
    rmoreBtn.addEventListener('click', toggle(rmenu, rmoreBtn));
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.nt-menu')) closeMenus();
    });

    /* ── Reader ── */
    function indexOf(id) {
        for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return i;
        return -1;
    }

    function fill(i) {
        var n = notes[i];
        at = i;
        document.getElementById('nt-stamp').textContent = N.longDate(n.date);
        document.getElementById('nt-r-title').textContent = n.title;
        var body = document.getElementById('nt-r-body');
        body.replaceChildren();
        var parsed = new DOMParser().parseFromString(n.content || '', 'text/html');
        // Scripts and inline handlers never come along
        parsed.querySelectorAll('script, style, iframe, object, embed').forEach(function (x) { x.remove(); });
        parsed.querySelectorAll('*').forEach(function (x) {
            Array.prototype.slice.call(x.attributes).forEach(function (a) {
                if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) x.removeAttribute(a.name);
            });
            if (x.tagName === 'A') { x.setAttribute('target', '_blank'); x.setAttribute('rel', 'noopener'); }
        });
        Array.prototype.forEach.call(parsed.body.childNodes, function (node) { body.appendChild(document.importNode(node, true)); });

        var folder = document.getElementById('nt-r-folder');
        folder.replaceChildren(icon('nt-i-folder'), document.createTextNode(n.folder));

        document.getElementById('nt-pos').textContent = (i + 1) + ' / ' + notes.length;
        ['nt-up', 'nt-prev'].forEach(function (id) { document.getElementById(id).disabled = i === 0; });
        ['nt-down', 'nt-next'].forEach(function (id) { document.getElementById(id).disabled = i === notes.length - 1; });
        document.title = n.title + ' — David Kwame Amo';
        scroller.scrollTop = 0;
    }

    var listScroll = 0;
    function open(i, fromHistory) {
        if (i < 0 || i >= notes.length) return;
        closeMenus();
        if (!reader.classList.contains('is-open')) listScroll = window.scrollY;
        fill(i);
        reader.classList.add('is-open');
        reader.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('nt-reading');
        var url = location.pathname + '?post=' + notes[i].id;
        if (!fromHistory) {
            if (history.state && history.state.note) history.replaceState({ note: notes[i].id }, '', url);
            else history.pushState({ note: notes[i].id }, '', url);
        }
        setTimeout(glassRefresh, 450);
        document.getElementById('nt-back').focus({ preventScroll: true });
    }

    function close(fromHistory) {
        if (!reader.classList.contains('is-open')) return;
        closeMenus();
        reader.classList.remove('is-open');
        reader.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('nt-reading');
        document.title = 'Blog — David Kwame Amo';
        window.scrollTo(0, listScroll);
        var row = groupsEl.querySelector('.nt-row[data-id="' + (notes[at] && notes[at].id) + '"]');
        if (row) row.focus({ preventScroll: true });
        if (!fromHistory) {
            if (history.state && history.state.note && history.length > 1 && cameFromList) history.back();
            else history.replaceState(null, '', location.pathname);
        }
        cameFromList = true;
        setTimeout(glassRefresh, 450);
    }

    // A shared link opens the note straight away; Back then goes to the list
    var cameFromList = true;
    function openFromUrl(initial) {
        var id = parseInt(new URLSearchParams(location.search).get('post'), 10);
        var i = isNaN(id) ? -1 : indexOf(id);
        if (i >= 0) {
            if (initial) { cameFromList = false; history.replaceState({ note: id }, '', location.href); }
            open(i, true);
        } else {
            close(true);
        }
    }
    window.addEventListener('popstate', function () { openFromUrl(false); });

    function step(d) { if (at + d >= 0 && at + d < notes.length) open(at + d); }

    document.getElementById('nt-back').addEventListener('click', function () { close(); });
    document.getElementById('nt-up').addEventListener('click', function () { step(-1); });
    document.getElementById('nt-down').addEventListener('click', function () { step(1); });
    document.getElementById('nt-prev').addEventListener('click', function () { closeMenus(); step(-1); });
    document.getElementById('nt-next').addEventListener('click', function () { closeMenus(); step(1); });

    document.addEventListener('keydown', function (e) {
        if (!reader.classList.contains('is-open')) {
            if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
            return;
        }
        if (e.key === 'Escape') { if (rmenu.classList.contains('is-shown')) closeMenus(); else close(); }
        if (e.key === 'ArrowUp' && e.altKey) step(-1);
        if (e.key === 'ArrowDown' && e.altKey) step(1);
    });

    // Swipe right from the left edge goes back, like iOS
    var swipe = null;
    reader.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        swipe = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    reader.addEventListener('touchend', function (e) {
        if (!swipe) return;
        var t = e.changedTouches[0];
        if (t.clientX - swipe.x > 80 && Math.abs(t.clientY - swipe.y) < 60) close();
        swipe = null;
    });

    /* ── Share / copy ── */
    var toastTimer = null;
    function say(msg) {
        toastText.textContent = msg;
        toast.classList.add('is-shown');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 1600);
        glassRefresh();
    }
    function copy(url) {
        var legacy = function () {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (_) {}
            ta.remove();
            say(ok ? 'Link Copied' : url);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { say('Link Copied'); }, legacy);
        else legacy();
    }
    function noteUrl() { return location.origin + location.pathname + '?post=' + notes[at].id; }

    document.getElementById('nt-share').addEventListener('click', function () {
        var n = notes[at];
        if (navigator.share) navigator.share({ title: n.title + ' — David Kwame Amo', text: n.preview, url: noteUrl() }).catch(function () {});
        else copy(noteUrl());
    });
    document.getElementById('nt-copy').addEventListener('click', function () { closeMenus(); copy(noteUrl()); });
    document.getElementById('nt-copy-folder').addEventListener('click', function () {
        closeMenus();
        var url = location.origin + location.pathname;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { say('Link Copied'); }, function () { say(url); });
        else say(url);
    });
}());
