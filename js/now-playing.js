(function () {
    var card   = document.getElementById('np-card');
    var link   = document.getElementById('np-link');
    var artist = document.getElementById('np-artist');
    var cover  = document.getElementById('np-cover');

    if (!card || !link || !artist) return;

    var currentId = null;

    function getCoverUrl(track) {
        // Plain string
        if (track.image && typeof track.image === 'string' && track.image.length) {
            return track.image;
        }
        // Last.fm-style array of { '#text': url, size: 'large' }
        if (Array.isArray(track.image) && track.image.length) {
            var preferred = ['extralarge', 'large', 'medium', 'small'];
            for (var i = 0; i < preferred.length; i++) {
                var found = track.image.find(function (img) { return img.size === preferred[i]; });
                if (found && found['#text']) return found['#text'];
            }
            var last = track.image[track.image.length - 1];
            if (last && last['#text']) return last['#text'];
        }
        // Other common field names
        return track.cover || track.artwork || track.album_art || track.coverArt || null;
    }

    function setPlaying(track) {
        var id = track.title + track.artist;
        if (id === currentId) return;
        currentId = id;

        link.textContent = track.title;
        link.href = /^https?:\/\//.test(track.track_url) ? track.track_url : '#';
        artist.textContent = track.artist;

        // Cover art
        if (cover) {
            var url = getCoverUrl(track);
            if (url && /^https?:\/\//.test(url)) {
                cover.src = url;
                cover.onload  = function () { card.classList.add('has-art'); };
                cover.onerror = function () { card.classList.remove('has-art'); };
            } else {
                card.classList.remove('has-art');
            }
        }

        card.classList.add('playing');
    }

    function setIdle() {
        if (currentId === null) return;
        currentId = null;
        card.classList.remove('playing', 'has-art');
        if (cover) cover.src = '';
    }

    async function fetchCurrent() {
        try {
            var res  = await fetch('https://npc-api.aikins.xyz/v1/users/kwameamo/now');
            var data = await res.json();
            if (data && data.status === 'playing') setPlaying(data.track);
        } catch (_) {}
    }

    function connectSocket() {
        var ws = new WebSocket('wss://npc-api.aikins.xyz/v1/users/kwameamo/ws');
        ws.addEventListener('message', function (e) {
            try {
                var msg = JSON.parse(e.data);
                if (msg.event === 'update' && msg.data && msg.data.provider !== 'system') {
                    if (msg.data.status === 'playing') setPlaying(msg.data.track);
                    else setIdle();
                }
            } catch (_) {}
        });
        ws.addEventListener('close', function () {
            setTimeout(connectSocket, 5000);
        });
    }

    fetchCurrent();
    connectSocket();
}());
