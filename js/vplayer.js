/* ─────────────────────────────────────────────────────────────
   VIDEO CONTROLS — the iOS player bar, used by B-Roll and the admin
   A glass bar: play/pause, elapsed time, a scrubber that thickens
   while it's dragged, time left, and sound on/off.

   VPlayer.create(video, { onSound(muted) }) → { el, setRange(a, b), paint() }
   setRange keeps playback to the trimmed part [a, b] (seconds) and
   loops it; times on the bar count from a, the way an edited clip
   on the phone does.
───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    function clock(s) {
        s = Math.max(0, Math.round(s || 0));
        return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }

    var SPEAKER = '<path fill="currentColor" d="M3.8 9.4h3.1l4.4-3.6c.5-.4 1.2 0 1.2.6v11.2c0 .6-.7 1-1.2.6l-4.4-3.6H3.8a.8.8 0 0 1-.8-.8V10.2c0-.4.4-.8.8-.8z"/>';
    var ICON = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.2 5.1v13.8c0 .9 1 1.4 1.7.9l10.6-6.9c.7-.4.7-1.4 0-1.8L8.9 4.2c-.7-.5-1.7 0-1.7.9z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.6" y="4.2" width="4.5" height="15.6" rx="1.4" fill="currentColor"/><rect x="13.9" y="4.2" width="4.5" height="15.6" rx="1.4" fill="currentColor"/></svg>',
        sound: '<svg viewBox="0 0 24 24" aria-hidden="true">' + SPEAKER + '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M15.6 9.3a3.9 3.9 0 0 1 0 5.4M18.3 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>',
        mute: '<svg viewBox="0 0 24 24" aria-hidden="true">' + SPEAKER + '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M15.8 9.6l4.8 4.8M20.6 9.6l-4.8 4.8"/></svg>'
    };

    function create(video, opts) {
        opts = opts || {};
        var el = document.createElement('div');
        el.className = 'vp lg' + (opts.className ? ' ' + opts.className : '');
        el.innerHTML =
            '<button type="button" class="vp__btn vp__play" aria-label="Play">' + ICON.play + '</button>' +
            '<span class="vp__time">0:00</span>' +
            '<div class="vp__track" role="slider" tabindex="0" aria-label="Position" aria-valuemin="0" aria-valuenow="0"><div class="vp__fill"></div></div>' +
            '<span class="vp__time vp__time--left">−0:00</span>' +
            '<button type="button" class="vp__btn vp__sound" aria-label="Mute">' + ICON.sound + '</button>';
        var playBtn = el.querySelector('.vp__play'), soundBtn = el.querySelector('.vp__sound');
        var track = el.querySelector('.vp__track'), fill = el.querySelector('.vp__fill');
        var nowEl = el.querySelectorAll('.vp__time')[0], leftEl = el.querySelectorAll('.vp__time')[1];
        var range = [0, Infinity], scrub = null, raf = 0;

        function start() { return range[0]; }
        function end() {
            var d = video.duration;
            return Math.min(range[1], isFinite(d) && d > 0 ? d : range[1]);
        }
        function span() { var e = end(); return isFinite(e) ? Math.max(0.01, e - start()) : 0; }

        function paint() {
            var t = video.currentTime, len = span();
            var pos = len ? Math.min(len, Math.max(0, t - start())) : 0;
            fill.style.width = (len ? pos / len * 100 : 0) + '%';
            nowEl.textContent = clock(pos);
            leftEl.textContent = '−' + clock(len - pos);
            track.setAttribute('aria-valuemax', String(Math.round(len)));
            track.setAttribute('aria-valuenow', String(Math.round(pos)));
            track.setAttribute('aria-valuetext', clock(pos) + ' of ' + clock(len));
            var playing = !video.paused && !video.ended;
            playBtn.innerHTML = playing ? ICON.pause : ICON.play;
            playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
            soundBtn.innerHTML = video.muted ? ICON.mute : ICON.sound;
            soundBtn.setAttribute('aria-label', video.muted ? 'Turn Sound On' : 'Mute');
        }

        // Keep to the trimmed part: back to its start at its end, or after the
        // browser's own loop jumps to 0
        function guard() {
            if (scrub) return;
            var e = end(), t = video.currentTime;
            if (isFinite(e) && (t >= e - 0.03 || t < start() - 0.25)) {
                video.currentTime = start();
                if (video.paused && !video.loop) return;
            }
        }
        function loop() {
            guard();
            paint();
            raf = !video.paused ? requestAnimationFrame(loop) : 0;
        }
        video.addEventListener('play', function () { if (!raf) raf = requestAnimationFrame(loop); paint(); });
        video.addEventListener('pause', paint);
        video.addEventListener('volumechange', paint);
        video.addEventListener('timeupdate', function () { if (!raf) { guard(); paint(); } });
        video.addEventListener('loadedmetadata', function () {
            if (video.currentTime < start() || video.currentTime > end()) video.currentTime = start();
            paint();
        });
        video.addEventListener('ended', function () { if (video.loop || opts.loop !== false) { video.currentTime = start(); video.play().catch(function () {}); } });

        playBtn.addEventListener('click', function (evt) {
            evt.stopPropagation();
            if (video.paused || video.ended) {
                if (video.currentTime >= end() - 0.05) video.currentTime = start();
                video.play().catch(function () {});
            } else video.pause();
        });
        soundBtn.addEventListener('click', function (evt) {
            evt.stopPropagation();
            video.muted = !video.muted;
            if (opts.onSound) opts.onSound(video.muted);
            if (!video.muted && video.paused) video.play().catch(function () {});
        });

        function seekTo(clientX) {
            var r = track.getBoundingClientRect();
            var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
            var t = start() + f * span();
            if (video.fastSeek && scrub && scrub.moved) video.fastSeek(t); else video.currentTime = t;
            fill.style.width = f * 100 + '%';
            nowEl.textContent = clock(f * span());
            leftEl.textContent = '−' + clock((1 - f) * span());
        }
        track.addEventListener('pointerdown', function (evt) {
            if (evt.pointerType === 'mouse' && evt.button !== 0) return;
            evt.stopPropagation();
            scrub = { playing: !video.paused, moved: false };
            el.classList.add('is-scrubbing');
            try { track.setPointerCapture(evt.pointerId); } catch (e) {}
            video.pause();
            seekTo(evt.clientX);
        });
        track.addEventListener('pointermove', function (evt) {
            if (!scrub) return;
            scrub.moved = true;
            seekTo(evt.clientX);
        });
        function release(evt) {
            if (!scrub) return;
            var s = scrub;
            scrub = null;
            el.classList.remove('is-scrubbing');
            if (s.moved && evt.type === 'pointerup') video.currentTime = video.currentTime;   // settle on an exact frame
            if (s.playing) video.play().catch(function () {});
            paint();
        }
        track.addEventListener('pointerup', release);
        track.addEventListener('pointercancel', release);
        track.addEventListener('keydown', function (evt) {
            var step = evt.key === 'ArrowLeft' ? -5 : evt.key === 'ArrowRight' ? 5 : 0;
            if (!step) return;
            evt.preventDefault();
            evt.stopPropagation();
            video.currentTime = Math.min(end(), Math.max(start(), video.currentTime + step));
        });
        // Taps and drags on the bar stay on the bar
        ['click', 'pointerdown', 'touchstart'].forEach(function (type) {
            el.addEventListener(type, function (evt) { evt.stopPropagation(); }, { passive: true });
        });

        paint();
        return {
            el: el,
            paint: paint,
            setRange: function (a, b) {
                range = [Math.max(0, +a || 0), b > 0 ? +b : Infinity];
                if (video.readyState >= 1 && (video.currentTime < start() || video.currentTime > end())) video.currentTime = start();
                paint();
            },
            start: start,
            end: end
        };
    }

    window.VPlayer = { create: create, clock: clock, ICON: ICON };
}());
