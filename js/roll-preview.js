/* ─────────────────────────────────────────
   B-ROLL — homepage preview
   The newest photos from the roll as a tight
   square grid; each tile opens that photo in
   roll.html, the count links to the whole roll.
───────────────────────────────────────── */
(function () {
    'use strict';

    var grid    = document.getElementById('br-preview');
    var countEl = document.getElementById('gallery-count');
    var empty   = document.getElementById('br-preview-empty');
    if (!grid) return;

    var IMG  = '/.netlify/functions/get-gallery-image?id=';
    var MAX  = 8;

    function showEmpty() {
        grid.hidden = true;
        if (empty) empty.hidden = false;
        if (countEl) countEl.textContent = '';
    }

    function shotTime(it) {
        var stamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(it.takenStamp || '') ? it.takenStamp : null;
        if (!stamp && /^\d{4}-\d{2}-\d{2}$/.test(it.takenAt || '')) {
            var up = /T(\d{2}:\d{2}:\d{2})/.exec(it.createdAt || '');
            stamp = it.takenAt + 'T' + (up ? up[1] : '12:00:00');
        }
        var t = stamp ? new Date(stamp).getTime() : new Date(it.createdAt || 0).getTime();
        return isNaN(t) ? 0 : t;
    }

    function render(items) {
        // Newest first on the home page: the roll itself runs oldest → newest.
        // Newest shot first
        var sorted = items.slice().sort(function (a, b) {
            return (shotTime(b) - shotTime(a)) || ((b.id || 0) - (a.id || 0));
        });
        var shown = sorted.slice(0, MAX);

        while (grid.firstChild) grid.removeChild(grid.firstChild);
        shown.forEach(function (item, i) {
            var a = document.createElement('a');
            a.className = 'br-pv';
            a.href = '/roll.html#photo-' + encodeURIComponent(item.id);
            a.setAttribute('aria-label', (item.caption || 'Photo') + ' — open in B-Roll');
            var img = document.createElement('img');
            img.src = IMG + encodeURIComponent(item.id) + (item.thumb ? '&size=thumb&v=' + encodeURIComponent(item.thumb) : '');
            if (i < 4 && 'fetchPriority' in img) img.fetchPriority = 'high';
            img.alt = item.caption || item.place || '';
            img.loading = i < 4 ? 'eager' : 'lazy';
            img.decoding = 'async';
            img.addEventListener('load', function () { img.classList.add('is-loaded'); });
            if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
            a.appendChild(img);
            grid.appendChild(a);
        });

        grid.hidden = false;
        if (empty) empty.hidden = true;
        if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' photo' : ' photos');
    }

    fetch('/.netlify/functions/get-gallery')
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (list) {
            if (!Array.isArray(list) || !list.length) { showEmpty(); return; }
            render(list);
        })
        .catch(showEmpty);
}());
