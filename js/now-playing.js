(function () {
    const card   = document.getElementById('np-card');
    const link   = document.getElementById('np-link');
    const artist = document.getElementById('np-artist');

    if (!card || !link || !artist) return;

    let currentId = null;

    function setPlaying(track) {
        const id = track.title + track.artist;
        if (id === currentId) return;
        currentId = id;
        link.textContent = track.title;
        link.href = /^https?:\/\//.test(track.track_url) ? track.track_url : '#';
        artist.textContent = track.artist;
        card.classList.add('playing');
    }

    function setIdle() {
        if (currentId === null) return;
        currentId = null;
        card.classList.remove('playing');
    }

    async function fetchCurrent() {
        try {
            const res  = await fetch('https://npc-api.aikins.xyz/v1/users/kwameamo/now');
            const data = await res.json();
            if (data && data.status === 'playing') setPlaying(data.track);
        } catch (_) {}
    }

    function connectSocket() {
        const ws = new WebSocket('wss://npc-api.aikins.xyz/v1/users/kwameamo/ws');
        ws.addEventListener('message', (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.event === 'update' && msg.data && msg.data.provider !== 'system') {
                    if (msg.data.status === 'playing') setPlaying(msg.data.track);
                    else setIdle();
                }
            } catch (_) {}
        });
        ws.addEventListener('close', () => {
            setTimeout(connectSocket, 5000);
        });
    }

    fetchCurrent();
    connectSocket();
}());
