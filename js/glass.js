/* ─────────────────────────────────────────
   LIQUID GLASS — edge refraction (Chromium)
   Builds an SVG displacement map that matches the
   header pill: content under the rim is pushed
   toward the edge, like light bending through a
   thick glass lens. Other browsers keep the CSS
   frosted-glass fallback.
───────────────────────────────────────── */
(function () {
    'use strict';

    var nav = document.querySelector('.site-nav, .cs-nav');
    if (!nav) return;

    var ua = navigator.userAgent;
    var supported = /Chrome\//.test(ua) && !/CriOS|FxiOS/.test(ua) &&
        'backdropFilter' in document.documentElement.style;
    if (!supported) return;

    var NS = 'http://www.w3.org/2000/svg';
    var BEZEL = 18;      // px of glass edge that refracts
    var SCALE = 38;      // max displacement is SCALE / 2 px

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;pointer-events:none';

    var filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', 'lg-filter');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    var feImage = document.createElementNS(NS, 'feImage');
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('result', 'map');

    var disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(SCALE));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');

    filter.appendChild(feImage);
    filter.appendChild(disp);
    svg.appendChild(filter);
    document.body.appendChild(svg);

    function buildMap(w, h, r) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var img = ctx.createImageData(w, h);
        var d = img.data;
        var cx = w / 2, cy = h / 2;
        var ix = w / 2 - r, iy = h / 2 - r;
        var bezel = Math.min(BEZEL, h / 2);

        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var px = x + 0.5 - cx, py = y + 0.5 - cy;
                var qx = Math.abs(px) - ix, qy = Math.abs(py) - iy;
                var sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
                var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                var len = Math.sqrt(ox * ox + oy * oy);
                var dist = len + Math.min(Math.max(qx, qy), 0) - r; // < 0 inside
                var t = -dist;                                      // depth from edge

                var nx = 0, ny = 0, m = 0;
                if (t >= 0 && t < bezel) {
                    if (qx > 0 && qy > 0 && len > 0) { nx = sx * ox / len; ny = sy * oy / len; }
                    else if (qx > qy) { nx = sx; }
                    else { ny = sy; }
                    var k = 1 - t / bezel;
                    m = k * k;
                }

                var i = (y * w + x) * 4;
                d[i]     = Math.round(128 + nx * m * 127);
                d[i + 1] = Math.round(128 + ny * m * 127);
                d[i + 2] = 128;
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
    }

    var lastW = 0, lastH = 0, raf = 0;

    function update() {
        raf = 0;
        var w = Math.round(nav.offsetWidth);
        var h = Math.round(nav.offsetHeight);
        if (!w || !h || (w === lastW && h === lastH)) return;
        lastW = w; lastH = h;

        var radius = parseFloat(getComputedStyle(nav).borderTopLeftRadius) || h / 2;
        radius = Math.min(radius, h / 2, w / 2);
        var url = buildMap(w, h, radius);

        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        filter.setAttribute('width', String(w));
        filter.setAttribute('height', String(h));
        feImage.setAttribute('x', '0');
        feImage.setAttribute('y', '0');
        feImage.setAttribute('width', String(w));
        feImage.setAttribute('height', String(h));
        feImage.setAttribute('href', url);
        feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);

        nav.classList.add('lg-refract');
    }

    function schedule() { if (!raf) raf = requestAnimationFrame(update); }

    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(nav);
    window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    schedule();
}());
