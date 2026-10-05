// Gold dust: small drifting gold particles on a deep-green background.
// The pointer pushes and swirls nearby particles, so their trajectory
// changes as the mouse moves; close particles are joined by faint lines.
(function () {
    var cv = document.getElementById('bgDots');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var W = 0, H = 0, dpr = 1, parts = [];
    var mouse = { x: -9999, y: -9999, active: false };
    var lastScroll = window.pageYOffset || 0, scrollKick = 0;
    var RADIUS = 150, LINK = 100;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function make() {
        return {
            x: rnd(0, W), y: rnd(0, H),
            vx: rnd(-0.12, 0.12), vy: rnd(-0.22, -0.04),
            r: rnd(0.8, 2.2), a: rnd(0.35, 0.95), ph: rnd(0, 6.28), tw: rnd(0.6, 1.6),
            warm: Math.random() < 0.35
        };
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.round(Math.min(W * H / 10500, W < 700 ? 45 : 110));
        while (parts.length < n) parts.push(make());
        parts.length = n;
        if (reduce) draw(0);
    }

    function step(t) {
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            // gentle wandering
            p.vx += Math.sin(t * 0.0003 * p.tw + p.ph) * 0.0016;
            p.vy += Math.cos(t * 0.00026 * p.tw + p.ph) * 0.0012;
            if (mouse.active) {
                var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
                if (d2 < RADIUS * RADIUS && d2 > 1) {
                    var d = Math.sqrt(d2), f = (1 - d / RADIUS);
                    // push away + a tangential swirl -> curved, "alive" paths
                    p.vx += (dx / d) * f * 0.55 + (-dy / d) * f * 0.22;
                    p.vy += (dy / d) * f * 0.55 + (dx / d) * f * 0.22;
                }
            }
            p.vy += scrollKick * 0.02;
            p.vx *= 0.965; p.vy *= 0.965;           // friction: they settle back to a slow drift
            // keep a minimal upward drift
            p.y += p.vy - 0.10; p.x += p.vx;
            if (p.y < -10) { p.y = H + 10; p.x = rnd(0, W); }
            if (p.y > H + 10) p.y = -10;
            if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        }
        scrollKick *= 0.9;
    }

    function draw(t) {
        ctx.clearRect(0, 0, W, H);
        var i, j, p, q;
        // links between close particles (stronger near the pointer)
        ctx.lineWidth = 0.6;
        for (i = 0; i < parts.length; i++) {
            p = parts[i];
            for (j = i + 1; j < parts.length; j++) {
                q = parts[j];
                var dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
                if (d2 < LINK * LINK) {
                    var al = (1 - Math.sqrt(d2) / LINK) * 0.16;
                    if (mouse.active) {
                        var mx = (p.x + q.x) / 2 - mouse.x, my = (p.y + q.y) / 2 - mouse.y;
                        if (mx * mx + my * my < RADIUS * RADIUS * 2.2) al *= 2.4;
                    }
                    ctx.strokeStyle = 'rgba(212,184,122,' + al.toFixed(3) + ')';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                }
            }
        }
        // dots
        for (i = 0; i < parts.length; i++) {
            p = parts[i];
            var tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 0.0012 * p.tw + p.ph);
            var al2 = p.a * tw;
            var col = p.warm ? '241,227,189' : '212,184,122';
            var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
            g.addColorStop(0, 'rgba(' + col + ',' + al2.toFixed(3) + ')');
            g.addColorStop(0.35, 'rgba(' + col + ',' + (al2 * 0.35).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(' + col + ',0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
        }
    }

    var running = true;
    function loop(t) {
        if (running) { step(t); draw(t); }
        requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
    window.addEventListener('pointerdown', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') mouse.active = false; }, { passive: true });
    document.addEventListener('mouseleave', function () { mouse.active = false; });
    window.addEventListener('scroll', function () {
        var y = window.pageYOffset || 0;
        scrollKick = Math.max(-6, Math.min(6, (lastScroll - y) * 0.25));
        lastScroll = y;
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { running = !document.hidden; });

    resize();
    if (!reduce) requestAnimationFrame(loop);
})();
