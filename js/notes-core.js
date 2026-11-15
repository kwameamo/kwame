/* ─────────────────────────────────────────
   NOTES — shared by the blog and the admin
   Groups notes the way Apple Notes does:
   Pinned, Today, Yesterday, Previous 7 Days,
   Previous 30 Days, then months of this year,
   then whole years. Dates read like Notes:
   "Yesterday", a weekday within the week,
   otherwise dd/mm/yyyy.
───────────────────────────────────────── */
(function () {
    'use strict';

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var DAY_MS = 86400000;

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    // "2026-02-12" → local midnight, never shifted by time zones
    function parseDay(s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
        if (!m) {
            var d = new Date(s);
            return isNaN(d) ? new Date(1970, 0, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        return new Date(+m[1], +m[2] - 1, +m[3]);
    }

    function today() {
        var n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate());
    }

    function daysAgo(day, now) {
        return Math.round((now - day) / DAY_MS);
    }

    function iso(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    // The date as it shows in a list row
    function rowDate(s, now) {
        now = now || today();
        var day = parseDay(s);
        var ago = daysAgo(day, now);
        if (ago === 0) return 'Today';
        if (ago === 1) return 'Yesterday';
        if (ago > 1 && ago < 7) return DAYS[day.getDay()];
        return pad(day.getDate()) + '/' + pad(day.getMonth() + 1) + '/' + day.getFullYear();
    }

    // The date stamped at the top of an open note
    function longDate(s) {
        var day = parseDay(s);
        return day.getDate() + ' ' + MONTHS[day.getMonth()] + ' ' + day.getFullYear();
    }

    function sectionOf(note, now) {
        if (note.pinned) return { key: 'pinned', label: 'Pinned', order: 0 };
        var day = parseDay(note.date);
        var ago = daysAgo(day, now);
        if (ago <= 0) return { key: 'today', label: 'Today', order: 1 };
        if (ago === 1) return { key: 'yesterday', label: 'Yesterday', order: 2 };
        if (ago < 8) return { key: 'week', label: 'Previous 7 Days', order: 3 };
        if (ago < 31) return { key: 'month', label: 'Previous 30 Days', order: 4 };
        if (day.getFullYear() === now.getFullYear()) {
            return { key: 'm' + day.getMonth(), label: MONTHS[day.getMonth()], order: 100 - day.getMonth() };
        }
        return { key: 'y' + day.getFullYear(), label: String(day.getFullYear()), order: 10000 - day.getFullYear() };
    }

    // Newest first, then by id so same-day notes keep the order they were written
    function sort(notes) {
        return notes.slice().sort(function (a, b) {
            var da = parseDay(a.date), db = parseDay(b.date);
            if (db - da) return db - da;
            return (b.id || 0) - (a.id || 0);
        });
    }

    function group(notes, now) {
        now = now || today();
        var map = {}, list = [];
        sort(notes).forEach(function (n) {
            var s = sectionOf(n, now);
            if (!map[s.key]) { map[s.key] = { key: s.key, label: s.label, order: s.order, notes: [] }; list.push(map[s.key]); }
            map[s.key].notes.push(n);
        });
        return list.sort(function (a, b) { return a.order - b.order; });
    }

    // Plain text of a note's HTML, for previews and search
    function plain(html) {
        var d = new DOMParser().parseFromString('<body>' + String(html || '').replace(/<\/(p|h2|h3|li)>/gi, '$& ').replace(/<br\s*\/?>/gi, ' ') + '</body>', 'text/html');
        return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function preview(note) {
        return (note.excerpt && String(note.excerpt).trim()) || plain(note.content).slice(0, 160);
    }

    window.NotesCore = {
        MONTHS: MONTHS,
        DAYS: DAYS,
        parseDay: parseDay,
        today: today,
        iso: iso,
        rowDate: rowDate,
        longDate: longDate,
        group: group,
        sort: sort,
        plain: plain,
        preview: preview
    };
}());
