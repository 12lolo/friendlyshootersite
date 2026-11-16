/* FriendlyShooter site — Aero ambience + FriendlyOS boot (mirrors the in-game Aero theme). */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- ambience: ribbons, glass pixels, glints ---------- */
    function ribbonSvg(cls) {
        return '<svg class="aero-ribbons ' + cls + '" viewBox="0 0 1200 500" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs><linearGradient id="rg' + cls + '" x1="0" x2="1">' +
            '<stop offset="0" stop-color="#02ff77" stop-opacity="0"/>' +
            '<stop offset=".45" stop-color="#9dffc8" stop-opacity=".55"/>' +
            '<stop offset=".7" stop-color="#c6ff6b" stop-opacity=".35"/>' +
            '<stop offset="1" stop-color="#02ff77" stop-opacity="0"/></linearGradient></defs>' +
            '<path d="M-20 330 C 260 150, 520 420, 820 230 S 1150 120, 1230 180" fill="none" stroke="url(#rg' + cls + ')" stroke-width="3"/>' +
            '<path d="M-20 360 C 280 190, 540 440, 840 260 S 1160 160, 1230 210" fill="none" stroke="url(#rg' + cls + ')" stroke-width="22" stroke-opacity=".18"/>' +
            '<path d="M-20 300 C 240 130, 560 380, 800 200 S 1140 90, 1230 150" fill="none" stroke="url(#rg' + cls + ')" stroke-width="1.5" stroke-opacity=".8"/>' +
            '</svg>';
    }

    function buildAmbience() {
        if (document.querySelector('.aero-ambience')) return;
        var layer = document.createElement('div');
        layer.className = 'aero-ambience';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = ribbonSvg('high') + ribbonSvg('low');

        if (!reduceMotion) {
            var grid = 24; // glass pixels snap to a grid, like in the game
            var cols = Math.max(8, Math.floor(window.innerWidth / grid));
            var count = window.innerWidth < 700 ? 12 : 26;
            for (var i = 0; i < count; i++) {
                var p = document.createElement('span');
                p.className = 'glass-pixel';
                var size = [10, 12, 14, 18, 22][Math.floor(Math.random() * 5)];
                p.style.left = (Math.floor(Math.random() * cols) * grid) + 'px';
                p.style.setProperty('--s', size + 'px');
                p.style.setProperty('--d', (14 + Math.random() * 16).toFixed(1) + 's');
                p.style.setProperty('--delay', (-Math.random() * 30).toFixed(1) + 's');
                p.style.setProperty('--a', (0.18 + Math.random() * 0.27).toFixed(2));
                p.style.setProperty('--r', (Math.random() > 0.5 ? '' : '-') + Math.floor(Math.random() * 40) + 'deg');
                layer.appendChild(p);
            }
            for (var g = 0; g < 7; g++) {
                var s = document.createElement('span');
                s.className = 'aero-glint';
                s.style.left = (Math.random() * 96) + '%';
                s.style.top = (Math.random() * 90) + '%';
                s.style.setProperty('--d', (5 + Math.random() * 6).toFixed(1) + 's');
                s.style.setProperty('--delay', (-Math.random() * 10).toFixed(1) + 's');
                layer.appendChild(s);
            }
        }

        var wrapper = document.getElementById('wrapper') || document.querySelector('.wrapper') || document.body;
        wrapper.insertBefore(layer, wrapper.firstChild);
    }

    /* ---------- FriendlyOS boot: once per session, any key skips ---------- */
    function seenBoot() {
        try { return sessionStorage.getItem('fsBootSeen') === '1'; } catch (e) { return true; }
    }
    function markBoot() {
        try { sessionStorage.setItem('fsBootSeen', '1'); } catch (e) { /* ignore */ }
    }

    function runBoot() {
        if (reduceMotion || seenBoot()) return;
        markBoot();

        var boot = document.createElement('div');
        boot.className = 'fos-boot';
        boot.setAttribute('role', 'presentation');
        boot.innerHTML =
            '<pre class="fos-bios"></pre>' +
            '<div class="fos-splash"><div class="fos-logo">FriendlyOS<small>0.945</small></div>' +
            '<div class="fos-spinner">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<i style="--i:' + i + '"></i>'; }).join('') + '</div>' +
            '<div class="fos-hint">PRESS ANY KEY TO SKIP</div></div>';
        document.body.appendChild(boot);

        var lines = [
            '<b>TJW BIOS v0.945</b>  (C) TJWGames',
            '',
            'CPU : Friendly Core @ 4.20 GHz ........ <em>OK</em>',
            'RAM : 640K should be enough ........... <em>OK</em>',
            'GPU : GlassPixel 3D Accelerator ....... <em>OK</em>',
            'Flags found: 0 / ???',
            '',
            'Booting FriendlyOS...'
        ];
        var pre = boot.querySelector('.fos-bios');
        var timers = [];
        var done = false;

        function finish() {
            if (done) return;
            done = true;
            timers.forEach(clearTimeout);
            boot.classList.add('fade');
            document.removeEventListener('keydown', finish, true);
            setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 500);
        }

        lines.forEach(function (line, i) {
            timers.push(setTimeout(function () { pre.innerHTML += line + '\n'; }, 90 * i));
        });
        timers.push(setTimeout(function () { boot.classList.add('splash'); }, 90 * lines.length + 250));
        timers.push(setTimeout(finish, 90 * lines.length + 1700));

        boot.addEventListener('click', finish);
        document.addEventListener('keydown', finish, true);
    }

    /* ---------- patch-note tabs ---------- */
    function setupTabs() {
        document.querySelectorAll('[data-tabs]').forEach(function (root) {
            var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
            function select(tab, focus) {
                tabs.forEach(function (t) {
                    var on = t === tab;
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                    t.tabIndex = on ? 0 : -1;
                    var panel = document.getElementById(t.getAttribute('aria-controls'));
                    if (panel) panel.hidden = !on;
                });
                if (focus) tab.focus();
            }
            tabs.forEach(function (tab, i) {
                tab.addEventListener('click', function () { select(tab, false); });
                tab.addEventListener('keydown', function (e) {
                    var next = null;
                    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
                    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
                    else if (e.key === 'Home') next = tabs[0];
                    else if (e.key === 'End') next = tabs[tabs.length - 1];
                    if (next) { e.preventDefault(); select(next, true); }
                });
            });
        });
    }

    function init() {
        buildAmbience();
        setupTabs();
        runBoot();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
