/* ─────────────────────────────────────────────────────────────
   B-ROLL — a camera roll
   Pulls the photos uploaded from /_p7n3x and lays them out like
   the phone's Photos app:

   • All: a square grid, oldest at the top, newest at the bottom,
     opened at the bottom. Pinch (or ctrl + wheel) to resize it.
   • Months / Years: rounded cards, each opening that stretch.
   • Library / Favorites: hearts live in this visitor's browser.
   • Viewer: snap-scrolling pages with a thumbnail strip kept in
     step, a title pill (place or caption, weekday and date), a
     "…" menu with Save Photo and Copy Link, Share, Favorite and
     Info (caption, day, place, file card). Swipe down to close,
     up for info, tap to hide the controls, double-tap or pinch
     to zoom. Every photo has a link: roll.html#photo-<id>.
───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var stream  = document.getElementById('br-stream');
    var topBar  = document.getElementById('br-top');
    var subEl   = document.getElementById('br-sub');
    var bar     = document.getElementById('br-bar');
    var loading = document.getElementById('br-loading');
    if (!stream || !bar) return;

    var IMG = '/.netlify/functions/get-gallery-image?id=';
    var VID = '/.netlify/functions/get-gallery-video?uid=';
    var LS  = { likes: 'broll-likes', view: 'broll-view', cols: 'broll-cols' };
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var phone   = window.matchMedia('(max-width: 768px)');

    function text(tag, className, value) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (value != null) el.textContent = value;
        return el;
    }
    function plural(n, word) { return n.toLocaleString() + ' ' + word + (n === 1 ? '' : 's'); }
    function store(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function recall(key, fallback) {
        try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
    }
    function glassRefresh() { if (window.LiquidGlass) window.LiquidGlass.refresh(); }

    /* ── Load ── */
    fetch('/.netlify/functions/get-gallery')
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (list) { roll(Array.isArray(list) ? list : []); })
        .catch(function () { roll([]); });

    // A video's trim as [start, end] seconds; the whole clip when it has none
    function trimOf(v) {
        var d = v && +v.dur > 0 ? +v.dur : Infinity;
        var t = v && Array.isArray(v.trim) ? v.trim : null;
        if (!t || !(t[1] > t[0])) return [0, d];
        return [Math.max(0, +t[0] || 0), Math.min(d, +t[1])];
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

    function roll(items) {
        if (loading) loading.remove();

        // One photo per upload; oldest first, newest at the bottom
        var photos = items.map(function (it) {
            var date = /^\d{4}-\d{2}-\d{2}$/.test(it.takenAt || '') ? it.takenAt : String(it.createdAt || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '1970-01-01';
            var parts = date.split('-');
            var day = new Date(+parts[0], +parts[1] - 1, +parts[2]);
            return {
                id: it.id,
                src: IMG + encodeURIComponent(it.id),
                // The small grid tile when one exists; the full photo otherwise
                tile: it.thumb ? IMG + encodeURIComponent(it.id) + '&size=thumb&v=' + encodeURIComponent(it.thumb) : IMG + encodeURIComponent(it.id),
                note: (it.caption || '').trim(),
                place: (it.place || '').trim(),
                link: (it.link || '').trim(),
                mime: it.mime || 'image/jpeg',
                // A video's image is its poster; the clip plays over it in the viewer
                video: it.video && it.video.uid ? VID + encodeURIComponent(it.video.uid) : '',
                // A trimmed video plays only [start, end]; its length is the trimmed one
                trim: trimOf(it.video),
                dur: it.video ? trimOf(it.video)[1] - trimOf(it.video)[0] || +it.video.dur || 0 : 0,
                w: +it.w || 0,
                h: +it.h || 0,
                date: date,
                year: parts[0],
                month: parts[0] + '-' + parts[1],
                monthName: MONTHS[+parts[1] - 1],
                short: MONTHS[+parts[1] - 1].slice(0, 3) + ' ' + (+parts[2]) + ', ' + parts[0],
                long: MONTHS[+parts[1] - 1] + ' ' + (+parts[2]) + ', ' + parts[0],
                weekday: DAYS[day.getDay()],
                time: shotTime(it)
            };
        });
        // Like the Photos app: oldest at the top, the newest shot at the bottom, where the roll opens
        photos.sort(function (a, b) { return (a.time - b.time) || ((a.id || 0) - (b.id || 0)); });
        photos.forEach(function (p, i) { p.index = i; });

        if (!photos.length) {
            stream.appendChild(text('p', 'br-empty', 'No Photos'));
            bar.classList.add('is-hidden');
            document.getElementById('br-home').classList.remove('is-hidden');
            return;
        }

        var likes = recall(LS.likes, {}) || {};
        function saveLikes() { store(LS.likes, likes); }

        // Focus only follows along for keyboard users
        var keyed = false;
        document.addEventListener('keydown', function () { keyed = true; }, true);
        document.addEventListener('pointerdown', function () { keyed = false; }, true);
        function keyFocus(el) { if (keyed && el) el.focus({ preventScroll: true }); }

        /* ── Tiles ── */
        // The roll opens at the bottom, so the newest tiles load first and at once
        var EAGER = 30;
        function makeImg(photo) {
            var img = document.createElement('img');
            var recent = photo.index >= photos.length - EAGER;
            img.alt = photo.note || photo.place || ('Photo from ' + photo.short);
            img.loading = recent ? 'eager' : 'lazy';
            if (recent && 'fetchPriority' in img) img.fetchPriority = photo.index >= photos.length - 12 ? 'high' : 'auto';
            img.decoding = 'async';
            img.src = photo.tile;
            if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
            else img.addEventListener('load', function () { img.classList.add('is-loaded'); });
            return img;
        }
        function heart(el) {
            if (el.querySelector('.br-tile__heart')) return;
            el.insertAdjacentHTML('beforeend', '<svg class="br-tile__heart" aria-hidden="true"><use href="#br-i-heart"/></svg>');
        }
        function unheart(el) {
            var h = el.querySelector('.br-tile__heart');
            if (h) h.remove();
        }
        function tile(photo) {
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'br-tile';
            el.setAttribute('aria-label', (photo.note ? photo.note + ', ' : '') + photo.short);
            el.dataset.index = photo.index;
            el.dataset.month = photo.month;
            el.appendChild(makeImg(photo));
            if (photo.video) {
                var s = Math.round(photo.dur);
                el.appendChild(text('span', 'br-tile__dur', Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60)));
            }
            if (likes[photo.id]) heart(el);
            if (favourites && !likes[photo.id]) el.hidden = true;
            return el;
        }

        /* ── Grid size ── */
        var SIZES = { phone: [1, 3, 5], wide: [4, 6, 8, 12] };
        var cols = recall(LS.cols, null);
        if (!cols || !cols.phone || !cols.wide) cols = { phone: 3, wide: 6 };
        function screenKey() { return phone.matches ? 'phone' : 'wide'; }

        var favourites = false;
        var current = null;

        var builders = {
            all: function () {
                var wrap = document.createElement('div');
                var grid = document.createElement('div');
                grid.className = 'br-grid br-all';
                grid.style.setProperty('--br-cols', cols[screenKey()]);
                var frag = document.createDocumentFragment();
                photos.forEach(function (p) { frag.appendChild(tile(p)); });
                grid.appendChild(frag);
                wrap.appendChild(grid);

                var count = text('p', 'br-count');
                count.appendChild(document.createTextNode(''));
                count.appendChild(text('span', '', 'Updated ' + photos[photos.length - 1].short));
                wrap.appendChild(count);

                var empty = text('p', 'br-empty');
                empty.appendChild(document.createTextNode('No Favorites'));
                empty.appendChild(text('span', '', 'Tap ♡ on a photo to keep it here.'));
                empty.hidden = true;
                wrap.appendChild(empty);
                return wrap;
            },
            months: function () {
                return cards('month', 'br-months', function (g) { return [g.cover.monthName, g.cover.year]; }, 'all');
            },
            years: function () {
                return cards('year', 'br-years', function (g) { return [g.key, plural(g.count, 'Photo')]; }, 'months');
            }
        };

        // Months and years: the newest photo of each as its cover
        function cards(key, className, words, next) {
            var wrap = document.createElement('div');
            var list = document.createElement('div');
            list.className = 'br-cards ' + className;
            var groups = [];
            photos.forEach(function (photo) {
                var group = groups[groups.length - 1];
                if (!group || group.key !== photo[key]) groups.push(group = { key: photo[key], count: 0 });
                group.cover = photo;
                group.count++;
            });
            groups.forEach(function (group) {
                var card = document.createElement('button');
                card.type = 'button';
                card.className = 'br-card';
                card.dataset.key = group.key;
                card.dataset.month = group.cover.month;
                var cover = text('span', 'br-tile');
                cover.appendChild(makeImg(group.cover));
                card.appendChild(cover);
                var label = words(group);
                var t = text('span', 'br-card__text');
                t.appendChild(text('span', 'br-card__title', label[0]));
                t.appendChild(text('span', 'br-card__sub', label[1]));
                card.appendChild(t);
                card.setAttribute('aria-label', label.join(', '));
                card.addEventListener('click', function () { show(next, group.key); });
                list.appendChild(card);
            });
            wrap.appendChild(list);
            return wrap;
        }

        /* ── Title follows the photos under it ── */
        var HEAD = 64;
        function updateSub() {
            var line = topBar.getBoundingClientRect().top + HEAD;
            var sel = current === 'all' ? '.br-tile:not([hidden])' : '.br-card';
            var items = stream.querySelectorAll(sel);
            var hit = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].getBoundingClientRect().bottom > line) { hit = items[i]; break; }
            }
            topBar.classList.toggle('is-over', !!hit && hit.getBoundingClientRect().top < line);
            if (favourites && current === 'all') { subEl.textContent = 'Favorites'; return; }
            if (current === 'years') { subEl.textContent = photos[0].year === photos[photos.length - 1].year ? photos[0].year : photos[0].year + ' – ' + photos[photos.length - 1].year; return; }
            if (!hit) hit = items[items.length - 1];
            if (!hit) { subEl.textContent = ''; return; }
            if (current === 'months') { subEl.textContent = hit.dataset.month.split('-')[0]; return; }
            subEl.textContent = photos[+hit.dataset.index].short;
        }
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () { ticking = false; updateSub(); });
        }, { passive: true });

        // The newest row sits just above the bottom bar
        function toBottom(smooth) {
            var top = document.documentElement.scrollHeight;
            var tiles = current === 'all' ? stream.querySelectorAll('.br-all > .br-tile:not([hidden])') : [];
            var lastTile = tiles[tiles.length - 1];
            if (lastTile) {
                top = lastTile.getBoundingClientRect().bottom + window.pageYOffset - (bar.getBoundingClientRect().top - 8);
            }
            window.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced ? 'smooth' : 'auto' });
        }

        function filter() {
            var grid = stream.querySelector('.br-all');
            if (!grid) return;
            var n = 0;
            photos.forEach(function (photo) { if (!favourites || likes[photo.id]) n++; });
            Array.prototype.forEach.call(grid.children, function (el) {
                el.hidden = favourites && !likes[photos[+el.dataset.index].id];
            });
            var count = stream.querySelector('.br-count');
            var empty = stream.querySelector('.br-empty');
            count.hidden = !n;
            count.firstChild.textContent = plural(n, 'Photo');
            count.lastChild.hidden = favourites;
            empty.hidden = !!n;
        }
        function settleIn() {
            if (!reduced && stream.animate) stream.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }

        var switches = Array.prototype.slice.call(document.querySelectorAll('.br-seg__btn'));
        function show(view, focusKey) {
            if (!builders[view]) view = 'all';
            current = view;
            stream.innerHTML = '';
            stream.appendChild(builders[view]());
            if (view === 'all') filter();
            switches.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === view ? 'true' : 'false'); });
            store(LS.view, view);
            var target = null;
            if (focusKey) {
                target = view === 'all'
                    ? stream.querySelector('.br-tile[data-month="' + focusKey + '"]')
                    : stream.querySelector('.br-card[data-key^="' + focusKey + '-"]');
            }
            if (target) {
                window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - HEAD - 20, behavior: 'auto' });
            } else {
                toBottom();
            }
            updateSub();
            glassRefresh();
        }
        switches.forEach(function (b) {
            b.addEventListener('click', function () {
                if (b.dataset.view === current) toBottom(true);
                else show(b.dataset.view);
            });
        });

        /* ── Library ↔ Favorites: the pill grows out of the Library button ── */
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.br-tab'));
        var tabPill = document.querySelector('.br-tabs');
        var segPill = document.querySelector('.br-seg');
        var libraryBtn = document.getElementById('br-library');
        var homeBtn = document.getElementById('br-home');
        var MORPH = { duration: 420, easing: 'cubic-bezier(.3, .9, .3, 1)' };

        function setTab(tab) {
            var was = favourites;
            favourites = tab === 'favorites';
            tabs.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tab === tab ? 'true' : 'false'); });
            if (current !== 'all') { show('all'); settleIn(); return; }
            if (was === favourites) return;
            filter();
            toBottom();
            updateSub();
            settleIn();
        }
        function morph(toTabs) {
            var circle = libraryBtn.getBoundingClientRect();
            var homeFrom = homeBtn.getBoundingClientRect();
            bar.classList.toggle('is-tabs', toTabs);
            glassRefresh();
            if (reduced || !tabPill.animate) return;
            var homeTo = homeBtn.getBoundingClientRect();
            homeBtn.animate([{ transform: 'translateX(' + (homeFrom.left - homeTo.left) + 'px)' }, { transform: 'none' }], MORPH);
            if (toTabs) {
                var t = tabPill.getBoundingClientRect();
                tabPill.animate([
                    { clipPath: 'inset(' + (circle.top - t.top) + 'px ' + (t.right - circle.right) + 'px ' + (t.bottom - circle.bottom) + 'px ' + (circle.left - t.left) + 'px round 999px)' },
                    { clipPath: 'inset(0 0 0 0 round 999px)' }
                ], MORPH);
                tabs.forEach(function (b, i) {
                    b.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 60 + i * 50, easing: MORPH.easing, fill: 'backwards' });
                });
            } else {
                var s = segPill.getBoundingClientRect();
                segPill.animate([
                    { clipPath: 'inset(0 ' + (s.width - s.height) + 'px 0 0 round 999px)', opacity: 0.4 },
                    { clipPath: 'inset(0 0 0 0 round 999px)', opacity: 1 }
                ], MORPH);
                libraryBtn.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: MORPH.easing });
            }
        }
        libraryBtn.addEventListener('click', function () {
            morph(true);
            setTab('library');
            keyFocus(tabs[0]);
        });
        tabs.forEach(function (b) {
            b.addEventListener('click', function () {
                if (b.dataset.tab === 'library') { morph(false); setTab('library'); keyFocus(libraryBtn); }
                else setTab('favorites');
            });
        });
        stream.addEventListener('click', function (evt) {
            var el = evt.target.closest('.br-tile[data-index]');
            if (el) open(+el.dataset.index, el);
        });

        /* ── Pinch / ctrl+wheel resizes the grid ── */
        function setCols(step) {
            var grid = stream.querySelector('.br-all');
            if (!grid) return;
            var key = screenKey();
            var list = SIZES[key];
            var at = list.indexOf(cols[key]);
            if (at < 0) at = 1;
            var next = Math.max(0, Math.min(list.length - 1, at + step));
            if (next === at) return;
            var middle = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            var anchor = middle && middle.closest && middle.closest('.br-tile');
            cols[key] = list[next];
            grid.style.setProperty('--br-cols', cols[key]);
            store(LS.cols, cols);
            if (anchor) anchor.scrollIntoView({ block: 'center' });
            updateSub();
        }
        var pinch = null;
        function spread(evt) {
            var a = evt.touches[0], b = evt.touches[1];
            return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
        stream.addEventListener('touchstart', function (evt) {
            if (evt.touches.length === 2 && current === 'all') pinch = spread(evt);
        }, { passive: true });
        stream.addEventListener('touchmove', function (evt) {
            if (pinch === null || evt.touches.length !== 2) return;
            evt.preventDefault();
            var ratio = spread(evt) / pinch;
            if (ratio > 1.3) { setCols(-1); pinch = spread(evt); }
            else if (ratio < 0.77) { setCols(1); pinch = spread(evt); }
        }, { passive: false });
        stream.addEventListener('touchend', function (evt) { if (evt.touches.length < 2) pinch = null; });
        var wheelSum = 0, wheelTimer = null;
        stream.addEventListener('wheel', function (evt) {
            if (!evt.ctrlKey || current !== 'all') return;
            evt.preventDefault();
            wheelSum += evt.deltaY;
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(function () { wheelSum = 0; }, 200);
            if (wheelSum < -40) { setCols(-1); wheelSum = 0; }
            else if (wheelSum > 40) { setCols(1); wheelSum = 0; }
        }, { passive: false });

        /* ═══════════ Viewer ═══════════ */
        var viewer  = document.getElementById('br-viewer');
        var pages   = document.getElementById('br-pages');
        var strip   = document.getElementById('br-strip');
        var prevBtn = document.getElementById('br-prev');
        var nextBtn = document.getElementById('br-next');
        var titleEl = document.getElementById('br-title');
        var whenEl  = document.getElementById('br-when');
        var likeBtn = document.getElementById('br-like');
        var infoBtn = document.getElementById('br-info-btn');
        var info    = document.getElementById('br-info');
        var moreBtn = document.getElementById('br-more');
        var menu    = document.getElementById('br-menu');
        var toast   = document.getElementById('br-toast');
        var toastText = document.getElementById('br-toast-text');
        var backBtn = document.getElementById('br-back');
        var shareBtn = document.getElementById('br-share');
        var at = -1, pushed = false, toastTimer = null;

        // One page and one thumbnail per photo; images load as they come near
        var pageImgs = [], thumbs = [];
        photos.forEach(function (photo) {
            var page = text('div', 'br-page');
            var img = document.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            img.draggable = false;
            img.style.setProperty('--r', photo.w && photo.h ? photo.w / photo.h : 1);
            img.addEventListener('load', function () {
                if (img.naturalWidth && img.naturalHeight) {
                    photo.w = photo.w || img.naturalWidth;
                    photo.h = photo.h || img.naturalHeight;
                    img.style.setProperty('--r', img.naturalWidth / img.naturalHeight);
                }
            });
            page.appendChild(img);
            pages.appendChild(page);
            pageImgs.push(img);

            var thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = 'br-strip__item';
            thumb.tabIndex = -1;
            thumb.dataset.index = photo.index;
            strip.appendChild(thumb);
            thumbs.push(thumb);
        });

        // One player for the whole viewer: it moves onto the current page when that
        // page is a video, laid exactly over the poster, looping, with sound when
        // the browser allows it (muted otherwise, until the sound button is tapped).
        // The iOS player bar sits over the bottom of the stage while a video shows.
        var player = document.createElement('video');
        player.className = 'br-page__video';
        player.loop = true;
        player.playsInline = true;
        player.setAttribute('playsinline', '');
        player.setAttribute('aria-hidden', 'true');
        player.preload = 'auto';
        var soundOn = true;
        var vbar = window.VPlayer ? VPlayer.create(player, { className: 'br-vp', onSound: function (muted) { soundOn = !muted; } }) : null;
        if (vbar) document.getElementById('br-stage').appendChild(vbar.el);
        function startPlayer() {
            player.muted = !soundOn;
            player.play().catch(function (err) {
                // Sound wasn't allowed without a tap: play muted and let the bar turn it on
                if (err && err.name === 'NotAllowedError' && !player.muted) {
                    player.muted = true;
                    player.play().catch(function () {});
                }
            });
        }
        function playFor(i) {
            var photo = photos[i];
            if (!photo || !photo.video || !viewer.classList.contains('is-open')) { stopVideo(); return; }
            var page = pageImgs[i].parentNode;
            if (player.parentNode !== page) page.appendChild(player);
            player.style.setProperty('--r', photo.w && photo.h ? photo.w / photo.h : 1);
            if (player.dataset.src !== photo.video) {
                player.dataset.src = photo.video;
                player.classList.remove('is-playing');
                player.src = photo.video;
            }
            if (vbar) vbar.setRange(photo.trim[0], photo.trim[1]);
            viewer.classList.add('is-video');
            startPlayer();
        }
        function stopVideo() {
            player.pause();
            if (player.parentNode) player.parentNode.removeChild(player);
            viewer.classList.remove('is-video');
        }
        // No sound from a tab that isn't showing; it carries on when the tab is back
        var hiddenWhilePlaying = false;
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { hiddenWhilePlaying = !player.paused; player.pause(); }
            else if (hiddenWhilePlaying && viewer.classList.contains('is-open') && player.parentNode) player.play().catch(function () {});
        });
        // Show the clip only once frames are coming, so the poster never flashes black.
        player.addEventListener('playing', function () { player.classList.add('is-playing'); });

        // The viewer runs through the set it was opened from: the roll, or just Favorites
        var order = [], posOf = {};
        function setOrder(list) {
            order = list;
            posOf = {};
            list.forEach(function (i, pos) { posOf[i] = pos; });
            photos.forEach(function (photo, i) {
                var shown = posOf[i] !== undefined;
                pageImgs[i].parentNode.style.display = shown ? '' : 'none';
                thumbs[i].style.display = shown ? '' : 'none';
            });
        }
        function near(i, radius) {
            if (radius === undefined) radius = 2;
            var p = posOf[i];
            for (var q = p - radius; q <= p + radius; q++) {
                var n = order[q];
                var img = pageImgs[n];
                if (img && !img.getAttribute('src')) {
                    var shown = stream.querySelector('.br-tile[data-index="' + n + '"] img');
                    if (shown && shown.currentSrc) {
                        img.style.backgroundImage = 'url("' + shown.currentSrc + '")';
                        img.addEventListener('load', function () { this.style.backgroundImage = ''; }, { once: true });
                    }
                    img.src = photos[n].src;
                    img.alt = photos[n].note || '';
                }
            }
            if (!radius) return;
            for (var r = p - 10; r <= p + 10; r++) {
                var t = order[r];
                if (thumbs[t] && !thumbs[t].style.backgroundImage) thumbs[t].style.backgroundImage = 'url("' + photos[t].tile + '")';
            }
        }

        // Two native scrollers kept in step
        var pageGap = parseFloat(getComputedStyle(pages).columnGap) || 0;
        function pagePitch() { return pages.clientWidth + pageGap; }
        function thumbPitch() { return order.length > 1 ? thumbs[order[1]].offsetLeft - thumbs[order[0]].offsetLeft : 26; }
        function atPos() { return posOf[at] || 0; }
        var driver = 'pages';
        ['pointerdown', 'touchstart', 'wheel'].forEach(function (type) {
            pages.addEventListener(type, function () {
                driver = 'pages';
                if (type !== 'pointerdown') pages.classList.remove('is-free');
            }, { passive: true });
            strip.addEventListener(type, function () {
                driver = 'strip';
                pages.classList.add('is-free');
            }, { passive: true });
        });
        pages.addEventListener('scroll', function () {
            var p = pages.scrollLeft / pagePitch();
            if (driver === 'pages') strip.scrollLeft = p * thumbPitch();
            setCurrent(order[Math.max(0, Math.min(order.length - 1, Math.round(p)))]);
        }, { passive: true });
        var stripSettle = null;
        function jumpTo(pos) {
            pos = Math.max(0, Math.min(order.length - 1, pos));
            near(order[pos]);
            pages.scrollLeft = pos * pagePitch();
            setCurrent(order[pos]);
        }
        function centreStrip() {
            driver = 'auto';
            strip.scrollTo({ left: atPos() * thumbPitch(), behavior: reduced ? 'auto' : 'smooth' });
        }
        strip.addEventListener('scroll', function () {
            if (driver !== 'strip') return;
            jumpTo(Math.round(strip.scrollLeft / thumbPitch()));
            clearTimeout(stripSettle);
            stripSettle = setTimeout(centreStrip, 120);
        }, { passive: true });
        function goTo(pos, smooth) {
            pos = Math.max(0, Math.min(order.length - 1, pos));
            driver = 'pages';
            pages.classList.remove('is-free');
            near(order[pos]);
            pages.scrollTo({ left: pos * pagePitch(), behavior: smooth && !reduced ? 'smooth' : 'auto' });
        }
        strip.addEventListener('click', function (evt) {
            var thumb = evt.target.closest('.br-strip__item');
            if (!thumb) return;
            clearTimeout(stripSettle);
            pages.classList.add('is-free');
            jumpTo(posOf[+thumb.dataset.index]);
            centreStrip();
        });
        prevBtn.addEventListener('click', function () { goTo(atPos() - 1, true); });
        nextBtn.addEventListener('click', function () { goTo(atPos() + 1, true); });
        window.addEventListener('resize', function () {
            if (!viewer.classList.contains('is-open')) return;
            pages.scrollLeft = atPos() * pagePitch();
            strip.scrollLeft = atPos() * thumbPitch();
        });

        // Details, like the phone's: caption, day and date, place, then a card with the file
        function fillInfo(photo) {
            info.innerHTML = '';
            if (photo.note) info.appendChild(text('p', 'br-sheet__caption', photo.note));
            var body = text('div', 'br-sheet__body');
            body.appendChild(text('p', 'br-sheet__when', photo.weekday + ' • ' + photo.short));
            if (photo.place) body.appendChild(text('p', 'br-sheet__place', photo.place));
            if (/^https?:\/\//.test(photo.link)) {
                var lp = text('p', 'br-sheet__link');
                var a = document.createElement('a');
                a.href = photo.link;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = photo.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                lp.appendChild(a);
                body.appendChild(lp);
            }
            body.appendChild(text('p', 'br-sheet__file', 'BROLL_' + String(photo.id).padStart(4, '0')));
            var card = text('div', 'br-sheet__card');
            var head = text('div', 'br-sheet__head');
            head.appendChild(text('span', '', 'Photo ' + (photo.index + 1) + ' of ' + photos.length));
            var ext = (photo.mime.split('/')[1] || 'jpeg').replace('jpeg', 'jpg').toUpperCase();
            head.appendChild(text('span', 'br-sheet__chip', ext));
            card.appendChild(head);
            if (photo.w && photo.h) {
                card.appendChild(text('p', 'br-sheet__spec', Math.max(1, Math.round(photo.w * photo.h / 1e6)) + ' MP • ' + photo.w + ' × ' + photo.h));
            }
            body.appendChild(card);
            info.appendChild(body);
        }
        function setInfo(shown) {
            viewer.classList.toggle('is-info', shown);
            if (shown) viewer.classList.remove('is-bare');
            infoBtn.setAttribute('aria-pressed', shown ? 'true' : 'false');
            infoBtn.querySelector('use').setAttribute('href', shown ? '#br-i-info-fill' : '#br-i-info');
            setTimeout(glassRefresh, 400);
        }
        function paintLike(photo) {
            var liked = !!likes[photo.id];
            likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
            likeBtn.querySelector('use').setAttribute('href', liked ? '#br-i-heart' : '#br-i-heart-line');
        }
        // A light tick as each thumbnail passes the centre of the strip
        var tickSwitch = null;
        function tick() {
            if (navigator.vibrate) { try { navigator.vibrate(5); } catch (e) {} return; }
            if (!tickSwitch) {
                tickSwitch = document.createElement('label');
                tickSwitch.setAttribute('aria-hidden', 'true');
                tickSwitch.style.cssText = 'position:fixed;top:0;left:-40px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
                var input = document.createElement('input');
                input.type = 'checkbox';
                input.setAttribute('switch', '');
                input.tabIndex = -1;
                tickSwitch.appendChild(input);
                document.body.appendChild(tickSwitch);
            }
            tickSwitch.click();
        }

        // The photo in the middle becomes the current one: title, thumbnail, link
        var prefetchTimer = null;
        function setCurrent(i) {
            if (i === undefined || i === at) return;
            if (driver === 'strip' && at !== -1 && viewer.classList.contains('is-open')) tick();
            if (viewer.classList.contains('is-zoomed')) resetZoom(false);
            if (thumbs[at]) thumbs[at].classList.remove('is-current');
            at = i;
            var photo = photos[i];
            thumbs[i].classList.add('is-current');
            if (!viewer.classList.contains('is-zooming')) near(i);
            playFor(i);
            prevBtn.disabled = posOf[i] === 0;
            nextBtn.disabled = posOf[i] === order.length - 1;
            var heading = photo.place || photo.note;
            titleEl.textContent = heading || photo.weekday;
            whenEl.textContent = heading ? photo.weekday + ' ' + photo.short : photo.long;
            paintLike(photo);
            fillInfo(photo);
            if (pushed) history.replaceState({ brPhoto: true }, '', '#photo-' + photo.id);
            clearTimeout(prefetchTimer);
            if (canShareFiles) prefetchTimer = setTimeout(function () { fileFor(at); }, 500);
            glassRefresh();
        }

        function closeMenu() {
            menu.classList.remove('is-shown');
            moreBtn.setAttribute('aria-expanded', 'false');
        }

        // The zoom between grid and viewer: a copy of the photo moves and scales
        // from its square to its place while its crop opens out
        var ZOOM = { duration: 380, easing: 'cubic-bezier(.32, .72, 0, 1)' };
        function fitted(box, ratio) {
            var w = box.width, h = w / ratio;
            if (h > box.height) { h = box.height; w = h * ratio; }
            return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
        }
        function ghost(src, full, tileBox, opening, done) {
            var el = document.createElement('img');
            el.className = 'br-ghost';
            el.alt = '';
            el.style.width = full.width + 'px';
            el.style.height = full.height + 'px';
            el.src = src;
            var k = Math.max(tileBox.width / full.width, tileBox.height / full.height);
            var cropX = Math.max(0, (full.width - tileBox.width / k) / 2);
            var cropY = Math.max(0, (full.height - tileBox.height / k) / 2);
            var small = {
                transform: 'translate3d(' + (tileBox.left + tileBox.width / 2 - full.width * k / 2) + 'px, ' + (tileBox.top + tileBox.height / 2 - full.height * k / 2) + 'px, 0) scale(' + k + ')',
                clipPath: 'inset(' + cropY + 'px ' + cropX + 'px)'
            };
            var big = {
                transform: 'translate3d(' + full.left + 'px, ' + full.top + 'px, 0) scale(1)',
                clipPath: 'inset(0px 0px)'
            };
            el.style.transform = (opening ? small : big).transform;
            el.style.clipPath = (opening ? small : big).clipPath;
            document.body.appendChild(el);
            var start = function () {
                var anim = el.animate(opening ? [small, big] : [big, small], ZOOM);
                anim.onfinish = anim.oncancel = function () {
                    el.style.transform = (opening ? big : small).transform;
                    el.style.clipPath = (opening ? big : small).clipPath;
                    done(function () { el.remove(); });
                };
            };
            if (el.decode) el.decode().then(start, start);
            else start();
        }
        function ratioOf(img, fallback) {
            return img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : fallback;
        }
        function open(i, fromEl) {
            var thumbImg = fromEl && fromEl.querySelector('img');
            var zoom = fromEl && thumbImg && thumbImg.complete && thumbImg.naturalWidth && !reduced && fromEl.animate;
            if (zoom) viewer.classList.add('is-zooming');
            viewer.classList.add('is-open');
            viewer.classList.remove('is-bare');
            viewer.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('br-locked');
            var list = [];
            photos.forEach(function (photo, n) { if (!(favourites && current === 'all') || likes[photo.id] || n === i) list.push(n); });
            setOrder(list);
            at = -1;
            near(i, zoom ? 0 : 2);
            driver = 'pages';
            pages.classList.remove('is-free');
            pages.scrollLeft = posOf[i] * pagePitch();
            strip.scrollLeft = posOf[i] * thumbPitch();
            setCurrent(i);
            if (zoom) {
                var full = fitted(pageImgs[i].getBoundingClientRect(), ratioOf(thumbImg, 1));
                fromEl.style.visibility = 'hidden';
                var target = pageImgs[i];
                ghost(thumbImg.currentSrc || thumbImg.src, full, fromEl.getBoundingClientRect(), true, function (remove) {
                    fromEl.style.visibility = '';
                    var swapped = false;
                    var swap = function () {
                        if (swapped) return;
                        swapped = true;
                        viewer.classList.remove('is-zooming');
                        requestAnimationFrame(function () { requestAnimationFrame(remove); });
                        near(i);
                        glassRefresh();
                    };
                    if (target.decode) target.decode().then(swap, swap);
                    setTimeout(swap, 600);
                });
            }
            keyFocus(backBtn);
            if (!pushed) { history.pushState({ brPhoto: true }, '', '#photo-' + photos[i].id); pushed = true; }
            playFor(at);
            glassRefresh();
        }
        function close(fromHistory) {
            if (!viewer.classList.contains('is-open')) return;
            stopVideo();
            if (viewer.classList.contains('is-zoomed')) resetZoom(false);
            var img = pageImgs[at];
            var shownAt = fitted(img.getBoundingClientRect(), ratioOf(img, 1));
            img.style.transform = '';
            viewer.style.backgroundColor = '';
            viewer.classList.remove('is-open');
            viewer.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('br-locked');
            setInfo(false);
            closeMenu();
            var el = stream.querySelector('.br-tile[data-index="' + at + '"]');
            if (el && el.hidden) el = null;
            if (el) {
                var rect = el.getBoundingClientRect();
                if (rect.top < topBar.getBoundingClientRect().top + HEAD || rect.bottom > window.innerHeight - 90) el.scrollIntoView({ block: 'center' });
                keyFocus(el);
                if (!reduced && el.animate && img.complete && img.naturalWidth) {
                    el.style.visibility = 'hidden';
                    ghost(img.currentSrc || img.src, shownAt, el.getBoundingClientRect(), false, function (remove) { el.style.visibility = ''; remove(); });
                }
            }
            if (pushed && !fromHistory) { pushed = false; history.back(); }
            pushed = false;
            if (favourites && current === 'all') filter();
            glassRefresh();
        }
        backBtn.addEventListener('click', function () { close(); });
        window.addEventListener('popstate', function () { close(true); });

        /* ── Gestures: swipe down closes, up shows details, tap hides the controls,
              double-tap or pinch zooms, drag looks around ── */
        var press = null;
        var zoom = { s: 1, x: 0, y: 0, home: 1 }, pinchZoom = null, lastTap = null, tapTimer = null;
        var wasBare = false, leaveTimer = null;
        function cur() { return pageImgs[at]; }
        function paintZoom(animate) {
            var img = cur();
            if (!img) return;
            var w = img.offsetWidth, h = img.offsetHeight;
            var still = zoom.s === 1 && !zoom.x && !zoom.y;
            img.classList.toggle('is-dragging', !animate);
            img.style.transform = still ? '' : 'translate3d(' + (zoom.x + w / 2 * (zoom.s - 1)) + 'px,' + (zoom.y + h / 2 * (zoom.s - 1)) + 'px,0) scale(' + zoom.s + ')';
            var zoomed = viewer.classList.contains('is-zoomed');
            pages.style.overflowX = zoomed ? 'hidden' : '';
            pages.style.touchAction = zoomed ? 'none' : '';
        }
        function boxOf(img) {
            var page = img.parentNode.getBoundingClientRect();
            return { left: page.left + img.offsetLeft, top: page.top + img.offsetTop, width: img.offsetWidth };
        }
        function enterZoom() {
            clearTimeout(leaveTimer);
            if (viewer.classList.contains('is-zoomed')) { viewer.classList.add('is-bare'); return; }
            var img = cur();
            var before = boxOf(img);
            wasBare = viewer.classList.contains('is-bare');
            viewer.classList.add('is-zoomed', 'is-bare');
            closeMenu();
            var after = boxOf(img);
            zoom = { s: before.width / after.width, x: before.left - after.left, y: before.top - after.top };
            zoom.home = zoom.s;
            paintZoom(false);
            void img.offsetWidth;
        }
        function resetZoom(animate) {
            var img = cur();
            var leave = function () {
                clearTimeout(leaveTimer);
                var zoomed = viewer.classList.contains('is-zoomed');
                viewer.classList.remove('is-zoomed');
                if (zoomed) viewer.classList.toggle('is-bare', wasBare);
                zoom = { s: 1, x: 0, y: 0, home: 1 };
                paintZoom(false);
                requestAnimationFrame(function () { if (cur()) cur().classList.remove('is-dragging'); });
            };
            if (!animate || reduced || !img || !viewer.classList.contains('is-zoomed')) return leave();
            var full = boxOf(img);
            viewer.classList.remove('is-zoomed');
            var home = boxOf(img);
            viewer.classList.add('is-zoomed');
            zoom = { s: home.width / full.width, x: home.left - full.left, y: home.top - full.top, home: zoom.home };
            viewer.classList.toggle('is-bare', wasBare);
            paintZoom(true);
            leaveTimer = setTimeout(leave, 260);
        }
        function zoomAt(s, cx, cy) {
            var img = cur();
            var page = img.parentNode.getBoundingClientRect();
            var left = page.left + img.offsetLeft, top = page.top + img.offsetTop;
            s = Math.max(zoom.home * 0.6, Math.min(5, s));
            var px = (cx - left - zoom.x) / zoom.s, py = (cy - top - zoom.y) / zoom.s;
            zoom.x = cx - left - px * s;
            zoom.y = cy - top - py * s;
            zoom.s = s;
        }
        function clampZoom() {
            var img = cur();
            var page = img.parentNode.getBoundingClientRect(), stage = pages.getBoundingClientRect();
            var left = page.left + img.offsetLeft, top = page.top + img.offsetTop;
            var w = img.offsetWidth * zoom.s, h = img.offsetHeight * zoom.s;
            zoom.x = w <= stage.width ? (img.offsetWidth - w) / 2 : Math.min(stage.left - left, Math.max(stage.right - left - w, zoom.x));
            zoom.y = h <= stage.height ? (img.offsetHeight - h) / 2 : Math.min(stage.top - top, Math.max(stage.bottom - top - h, zoom.y));
        }
        function spread2(evt) {
            var a = evt.touches[0], b = evt.touches[1];
            return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
        }
        pages.addEventListener('touchstart', function (evt) {
            if (evt.touches.length !== 2 || viewer.classList.contains('is-info')) return;
            press = null;
            if (cur()) cur().classList.remove('is-dragging');
            viewer.style.backgroundColor = '';
            enterZoom();
            var f = spread2(evt);
            pinchZoom = { d: f.d, s: zoom.s, x: f.x, y: f.y };
        }, { passive: true });
        pages.addEventListener('touchmove', function (evt) {
            if (!pinchZoom || evt.touches.length !== 2) return;
            evt.preventDefault();
            var f = spread2(evt);
            zoom.x += f.x - pinchZoom.x;
            zoom.y += f.y - pinchZoom.y;
            pinchZoom.x = f.x;
            pinchZoom.y = f.y;
            zoomAt(pinchZoom.s * f.d / pinchZoom.d, f.x, f.y);
            paintZoom(false);
        }, { passive: false });
        pages.addEventListener('touchend', function (evt) {
            if (!pinchZoom || evt.touches.length >= 2) return;
            pinchZoom = null;
            if (zoom.s < Math.max(1, zoom.home) * 1.05) resetZoom(true);
            else { clampZoom(); paintZoom(true); }
        });
        pages.addEventListener('wheel', function (evt) {
            if (!evt.ctrlKey || !viewer.classList.contains('is-open')) return;
            evt.preventDefault();
            if (viewer.classList.contains('is-info') || (evt.deltaY >= 0 && !viewer.classList.contains('is-zoomed'))) return;
            if (evt.deltaY < 0) enterZoom();
            zoomAt(zoom.s * Math.exp(-evt.deltaY / 100), evt.clientX, evt.clientY);
            if (evt.deltaY > 0 && zoom.s < Math.max(1, zoom.home) * 1.02) resetZoom(true);
            else { clampZoom(); paintZoom(false); }
        }, { passive: false });
        pages.addEventListener('pointerdown', function (evt) {
            if (evt.pointerType === 'mouse' && evt.button !== 0) return;
            press = { x: evt.clientX, y: evt.clientY, left: pages.scrollLeft, axis: null, t: Date.now(), id: evt.pointerId, mouse: evt.pointerType === 'mouse', zx: zoom.x, zy: zoom.y };
        });
        pages.addEventListener('pointermove', function (evt) {
            if (!press || evt.pointerId !== press.id) return;
            var dx = evt.clientX - press.x, dy = evt.clientY - press.y;
            if (viewer.classList.contains('is-zoomed') && !pinchZoom) {
                if (!press.axis && Math.abs(dx) + Math.abs(dy) < 6) return;
                press.axis = 'pan';
                zoom.x = press.zx + dx;
                zoom.y = press.zy + dy;
                clampZoom();
                paintZoom(false);
                return;
            }
            if (!press.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                press.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
                if (press.axis === 'y' && cur()) cur().classList.add('is-dragging');
                if (press.axis === 'x' && press.mouse) {
                    pages.classList.add('is-free');
                    try { pages.setPointerCapture(evt.pointerId); } catch (e) {}
                }
            }
            if (press.axis === 'y' && dy > 0 && !viewer.classList.contains('is-info')) {
                if (cur()) cur().style.transform = 'translate3d(' + dx * 0.3 + 'px,' + dy + 'px,0) scale(' + Math.max(0.75, 1 - dy / 1000) + ')';
                viewer.style.backgroundColor = (document.documentElement.getAttribute('data-scheme') === 'dark' ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + Math.max(0.2, 1 - dy / 400) + ')';
            } else if (press.axis === 'x' && press.mouse) {
                pages.scrollLeft = press.left - dx;
            }
        });
        function release(evt) {
            if (!press || evt.pointerId !== press.id) return;
            var p = press;
            press = null;
            var dx = evt.clientX - p.x, dy = evt.clientY - p.y;
            var quick = Date.now() - p.t < 250;
            if (p.axis === 'pan') return;
            if (!p.axis) {
                if (evt.type !== 'pointerup' || Date.now() - p.t > 500) return;
                var now = Date.now();
                if (lastTap && now - lastTap.t < 300 && Math.hypot(evt.clientX - lastTap.x, evt.clientY - lastTap.y) < 40 && !viewer.classList.contains('is-info')) {
                    clearTimeout(tapTimer);
                    lastTap = null;
                    if (viewer.classList.contains('is-zoomed')) resetZoom(true);
                    else { enterZoom(); zoomAt(2.5, evt.clientX, evt.clientY); clampZoom(); paintZoom(true); }
                    return;
                }
                lastTap = { t: now, x: evt.clientX, y: evt.clientY };
                clearTimeout(tapTimer);
                tapTimer = setTimeout(function () {
                    lastTap = null;
                    if (viewer.classList.contains('is-info')) setInfo(false);
                    else viewer.classList.toggle('is-bare');
                    closeMenu();
                }, 260);
                return;
            }
            if (p.axis === 'y') {
                var img = cur();
                if (img) img.classList.remove('is-dragging');
                viewer.style.backgroundColor = '';
                if (viewer.classList.contains('is-info')) { if (dy > 40) setInfo(false); return; }
                if (dy > 100 || (quick && dy > 40)) return close();
                if (img) img.style.transform = '';
                if (dy < -40) setInfo(true);
                return;
            }
            if (p.mouse) {
                var start = Math.round(p.left / pagePitch());
                var target = Math.round(pages.scrollLeft / pagePitch());
                if (target === start && (Math.abs(dx) > 50 || (quick && Math.abs(dx) > 15))) target = start + (dx < 0 ? 1 : -1);
                goTo(target, true);
            }
        }
        pages.addEventListener('pointerup', release);
        pages.addEventListener('pointercancel', release);

        /* ── Save, share, copy ── */
        var canShareFiles = !!(navigator.canShare && window.File && (function () {
            try { return navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }); } catch (e) { return false; }
        })());
        var files = {}, fileOrder = [];
        function fileFor(i) {
            var photo = photos[i];
            if (!files[photo.id]) {
                files[photo.id] = { ready: null, promise: null };
                files[photo.id].promise = fetch(photo.src)
                    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.blob(); })
                    .then(function (blob) {
                        var ext = (blob.type.split('/')[1] || 'jpeg').replace('jpeg', 'jpg');
                        var file = new File([blob], 'kwame-broll-' + photo.date + '-' + (photo.index + 1) + '.' + ext, { type: blob.type || 'image/jpeg' });
                        if (files[photo.id]) files[photo.id].ready = file;
                        return file;
                    });
                files[photo.id].promise.catch(function () { delete files[photo.id]; });
                fileOrder.push(photo.id);
                while (fileOrder.length > 5) delete files[fileOrder.shift()];
            }
            return files[photo.id].promise;
        }
        function download(file) {
            var url = URL.createObjectURL(file);
            var a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            say('Saved');
        }
        function sharePhoto() {
            var photo = photos[at];
            var held = files[photo.id] && files[photo.id].ready;
            if (canShareFiles && held) {
                navigator.share({ files: [held] }).catch(function () {});
                return;
            }
            if (canShareFiles) say('Getting Photo');
            fileFor(at).then(function (file) {
                if (!canShareFiles) return download(file);
                navigator.share({ files: [file] }).then(function () {}, function (err) {
                    if (err && err.name === 'NotAllowedError') say('Tap Again to Save');
                });
            }, function () { say('Photo Unavailable'); });
        }
        shareBtn.addEventListener('pointerdown', function () { if (canShareFiles) fileFor(at); });
        shareBtn.addEventListener('click', sharePhoto);
        document.getElementById('br-save').addEventListener('click', function () {
            closeMenu();
            fileFor(at).then(download, function () { say('Photo Unavailable'); });
        });

        function say(message) {
            toastText.textContent = message;
            toast.classList.add('is-shown');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 1600);
        }
        document.getElementById('br-copy').addEventListener('click', function () {
            closeMenu();
            var url = location.origin + location.pathname + '#photo-' + photos[at].id;
            var legacy = function () {
                var ta = document.createElement('textarea');
                ta.value = url;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
                document.body.appendChild(ta);
                ta.select();
                var ok = false;
                try { ok = document.execCommand('copy'); } catch (e) {}
                ta.remove();
                say(ok ? 'Link Copied' : url);
            };
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { say('Link Copied'); }, legacy);
            else legacy();
        });
        likeBtn.addEventListener('click', function () {
            var photo = photos[at];
            if (likes[photo.id]) delete likes[photo.id];
            else likes[photo.id] = 1;
            saveLikes();
            paintLike(photo);
            var el = stream.querySelector('.br-tile[data-index="' + at + '"]');
            if (el) { if (likes[photo.id]) heart(el); else unheart(el); }
        });
        infoBtn.addEventListener('click', function () { setInfo(!viewer.classList.contains('is-info')); });
        moreBtn.addEventListener('click', function (evt) {
            evt.stopPropagation();
            var shown = menu.classList.toggle('is-shown');
            moreBtn.setAttribute('aria-expanded', shown ? 'true' : 'false');
            glassRefresh();
        });
        viewer.addEventListener('click', function (evt) {
            if (!evt.target.closest('#br-menu, #br-more')) closeMenu();
        });

        document.addEventListener('keydown', function (evt) {
            if (!viewer.classList.contains('is-open')) return;
            if (evt.key === 'Escape') {
                if (menu.classList.contains('is-shown')) closeMenu();
                else if (viewer.classList.contains('is-info')) setInfo(false);
                else close();
            } else if (evt.key === 'ArrowLeft') { evt.preventDefault(); goTo(atPos() - 1, true); }
            else if (evt.key === 'ArrowRight') { evt.preventDefault(); goTo(atPos() + 1, true); }
            else if ((evt.key === 'm' || evt.key === 'M') && vbar && viewer.classList.contains('is-video')) vbar.el.querySelector('.vp__sound').click();
            else if (evt.key === ' ' && vbar && viewer.classList.contains('is-video') && !evt.target.closest('button')) { evt.preventDefault(); vbar.el.querySelector('.vp__play').click(); }
            else if (evt.key === 'Tab') {
                var focusable = Array.prototype.filter.call(viewer.querySelectorAll('.br-round, .br-pill__btn'), function (b) { return b.offsetParent && !b.disabled; });
                var first = focusable[0], last = focusable[focusable.length - 1];
                if (evt.shiftKey && document.activeElement === first) { evt.preventDefault(); last.focus(); }
                else if (!evt.shiftKey && document.activeElement === last) { evt.preventDefault(); first.focus(); }
            }
        });

        /* ── Start at the bottom, on the newest photo — or on a linked one ── */
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        var saved = recall(LS.view, 'all');
        show(saved === 'years' || saved === 'months' ? saved : 'all');
        window.addEventListener('load', function () { if (!pushed) toBottom(); updateSub(); });
        function openLinked() {
            var linked = location.hash.match(/^#photo-(.+)$/);
            if (!linked) return;
            var id = decodeURIComponent(linked[1]);
            for (var i = 0; i < photos.length; i++) {
                if (String(photos[i].id) === id) {
                    if (viewer.classList.contains('is-open')) { if (at !== i) { near(i); goTo(posOf[i], false); } return; }
                    history.replaceState(null, '', location.pathname + location.search);
                    if (current !== 'all') show('all');
                    open(i);
                    return;
                }
            }
        }
        openLinked();
        // A #photo- link followed while the roll is already open (or pasted into the bar)
        window.addEventListener('hashchange', openLinked);
    }
}());
