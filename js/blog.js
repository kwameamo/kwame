(function () {
    var posts = [];
    var currentPostIndex = 0;
    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtDate(d) {
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function setPostContent(html, container) {
        container.replaceChildren();
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        Array.from(parsed.body.childNodes).forEach(function (node) {
            container.appendChild(document.importNode(node, true));
        });
    }

    async function loadPosts() {
        try {
            var res = await fetch('blog-posts.json');
            if (!res.ok) throw new Error();
            var data = await res.json();
            posts = data.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
            posts.forEach(function (p) { p.displayDate = fmtDate(new Date(p.date)); });
        } catch (_) {
            posts = [{
                id: 1,
                date: new Date().toISOString(),
                displayDate: fmtDate(new Date()),
                title: 'Welcome to the Blog',
                excerpt: 'Blog posts will appear here once blog-posts.json is configured.',
                content: '<p>Add your blog posts to blog-posts.json to see them here.</p>'
            }];
        }
        renderCards();

        var saved = sessionStorage.getItem('blog_openPost');
        if (saved !== null) {
            openPost(parseInt(saved, 10), true);
        } else {
            var y = sessionStorage.getItem('blog_scrollY');
            if (y) requestAnimationFrame(function () { window.scrollTo(0, parseInt(y, 10)); });
        }
    }

    function renderCards() {
        var grid = document.getElementById('blog-grid');
        var frag = document.createDocumentFragment();

        posts.forEach(function (post, i) {
            var card = document.createElement('div');
            card.className = 'blog-card';
            card.addEventListener('click', function () { openPost(i); });

            var date = document.createElement('div');
            date.className = 'blog-date';
            date.textContent = post.displayDate;

            var title = document.createElement('h3');
            title.className = 'blog-title';
            title.textContent = post.title;

            var excerpt = document.createElement('p');
            excerpt.className = 'blog-excerpt';
            excerpt.textContent = post.excerpt;

            var arrow = document.createElement('span');
            arrow.className = 'blog-arrow';
            arrow.textContent = '→';

            card.appendChild(date);
            card.appendChild(title);
            card.appendChild(excerpt);
            card.appendChild(arrow);
            frag.appendChild(card);
        });

        grid.appendChild(frag);

        var n = posts.length;
        var label = n + (n === 1 ? ' post' : ' posts');
        document.getElementById('posts-count').textContent = label;
        var navRight = document.getElementById('nav-right-count');
        if (navRight) navRight.textContent = label;
    }

    function openPost(index, skipScrollRestore) {
        currentPostIndex = index;
        var post = posts[index];

        document.getElementById('modal-title').textContent = post.title;
        document.getElementById('modal-date').textContent = post.displayDate;
        document.getElementById('modal-eyebrow').textContent = 'Post ' + (index + 1) + ' of ' + posts.length;

        setPostContent(post.content, document.getElementById('modal-body'));

        var modal = document.getElementById('blog-modal');
        modal.classList.add('active');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { modal.classList.add('visible'); });
        });
        document.body.style.overflow = 'hidden';
        updateNavBtns();

        var savedScroll = sessionStorage.getItem('blog_modalScrollY_' + index);
        if (!skipScrollRestore && savedScroll !== null) {
            requestAnimationFrame(function () { modal.scrollTop = parseInt(savedScroll, 10); });
        } else {
            modal.scrollTop = 0;
        }

        sessionStorage.setItem('blog_openPost', index);
        modal.onscroll = function () {
            sessionStorage.setItem('blog_modalScrollY_' + currentPostIndex, modal.scrollTop);
        };
    }

    function closePost() {
        var modal = document.getElementById('blog-modal');
        modal.classList.remove('visible');
        setTimeout(function () {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }, 220);
        sessionStorage.removeItem('blog_openPost');
        var y = sessionStorage.getItem('blog_scrollY');
        if (y) requestAnimationFrame(function () { window.scrollTo(0, parseInt(y, 10)); });
    }

    function navigatePost(dir) {
        var next = currentPostIndex + dir;
        if (next >= 0 && next < posts.length) openPost(next, false);
    }

    function updateNavBtns() {
        var atStart = currentPostIndex === 0;
        var atEnd   = currentPostIndex === posts.length - 1;
        var label   = (currentPostIndex + 1) + ' / ' + posts.length;
        document.getElementById('prev-btn').disabled      = atStart;
        document.getElementById('next-btn').disabled      = atEnd;
        document.getElementById('prev-btn-foot').disabled = atStart;
        document.getElementById('next-btn-foot').disabled = atEnd;
        document.getElementById('modal-counter').textContent = label;
        document.getElementById('mf-counter').textContent    = label;
    }

    document.addEventListener('keydown', function (e) {
        var modal = document.getElementById('blog-modal');
        if (!modal.classList.contains('active')) return;
        if (e.key === 'Escape')     closePost();
        if (e.key === 'ArrowLeft')  navigatePost(-1);
        if (e.key === 'ArrowRight') navigatePost(1);
    });

    window.addEventListener('scroll', function () {
        document.getElementById('site-nav').classList.toggle('dark', window.scrollY > 10);
        sessionStorage.setItem('blog_scrollY', window.scrollY);
    }, { passive: true });

    // Expose close/navigate to inline onclick handlers
    window.closePost    = closePost;
    window.navigatePost = navigatePost;

    // Register service worker and activate updates immediately
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
            reg.addEventListener('updatefound', function () {
                var next = reg.installing;
                if (!next) return;
                next.addEventListener('statechange', function () {
                    if (next.state === 'installed' && navigator.serviceWorker.controller) {
                        next.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
        });

        var reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (reloading) return;
            reloading = true;
            window.location.reload();
        });
    }

    loadPosts();
}());
