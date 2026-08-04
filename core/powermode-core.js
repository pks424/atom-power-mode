// Atom "activate-power-mode" port for VSCode workbench.
// Injected by the atom-power-mode extension. Config comes from window.__APM_CONFIG.
(function () {
    'use strict';
    if (window.__atomPowerMode) return;
    window.__atomPowerMode = true;

    var userCfg = window.__APM_CONFIG || {};
    var cfg = {
        particleCount: num(userCfg.particleCount, 12),
        particleSize: num(userCfg.particleSize, 3.5),
        gravity: num(userCfg.gravity, 0.12),
        maxParticles: num(userCfg.maxParticles, 500),
        shake: {
            enabled: bool(userCfg.shake && userCfg.shake.enabled, true),
            intensity: num(userCfg.shake && userCfg.shake.intensity, 3),
            duration: num(userCfg.shake && userCfg.shake.duration, 90)
        },
        combo: {
            enabled: bool(userCfg.combo && userCfg.combo.enabled, true),
            timeout: num(userCfg.combo && userCfg.combo.timeout, 10),
            activationThreshold: num(userCfg.combo && userCfg.combo.activationThreshold, 0),
            exclamations: bool(userCfg.combo && userCfg.combo.exclamations, true)
        }
    };
    function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
    function bool(v, d) { return typeof v === 'boolean' ? v : d; }

    var ALPHA_DECAY = 0.94;

    // ---------- particles ----------
    var canvas = null, ctx = null, rafId = null;
    var particles = [];

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.id = 'atom-power-mode-canvas';
        canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
            'pointer-events:none;z-index:2147483646;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function spawn(x, y, color) {
        var base = cfg.particleCount;
        var count = Math.max(1, Math.round(base * (0.5 + Math.random())));
        for (var i = 0; i < count; i++) {
            if (particles.length >= cfg.maxParticles) particles.shift();
            particles.push({
                x: x, y: y,
                vx: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 2.2),
                vy: -(1.2 + Math.random() * 2.6),
                size: cfg.particleSize * (0.6 + Math.random() * 0.8),
                alpha: 1,
                color: color
            });
        }
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.vy += cfg.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.alpha *= ALPHA_DECAY;
            if (p.alpha < 0.04 || p.y > canvas.height) {
                particles.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
        }
        ctx.globalAlpha = 1;
        rafId = particles.length ? requestAnimationFrame(tick) : null;
    }

    // ---------- screen shake ----------
    var shakeTimer = null;
    function shake(editorNode) {
        if (!cfg.shake.enabled || cfg.shake.intensity <= 0) return;
        var target = editorNode.closest('.editor-group-container') || editorNode;
        var start = performance.now();
        if (shakeTimer) cancelAnimationFrame(shakeTimer);
        (function step(now) {
            if (now - start >= cfg.shake.duration) {
                target.style.transform = '';
                shakeTimer = null;
                return;
            }
            var dx = (Math.random() - 0.5) * 2 * cfg.shake.intensity;
            var dy = (Math.random() - 0.5) * 2 * cfg.shake.intensity;
            target.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
            shakeTimer = requestAnimationFrame(step);
        })(start);
    }

    // ---------- combo (Atom combo mode 스타일) ----------
    var combo = 0;
    var comboResetTimer = null;
    var comboWrap = null, comboNumEl = null, comboBarEl = null;
    var EXCLAMATIONS = ['Super!', 'Radical!', 'Fantastic!', 'Great!', 'OMG!', 'Whoa!', 'Amazing!', 'Excellent!', 'Unreal!', 'Outstanding!'];

    function comboColor() {
        // 콤보가 쌓일수록 파랑(200) → 빨강(0)으로 달아오름
        var hue = Math.max(0, 200 - combo * 2);
        return 'hsl(' + hue + ',85%,60%)';
    }

    function ensureComboEl(editorNode) {
        var group = editorNode.closest('.editor-group-container') || document.body;
        if (!comboWrap) {
            comboWrap = document.createElement('div');
            comboWrap.id = 'atom-power-mode-combo';
            comboWrap.style.cssText =
                'position:absolute;top:44px;right:24px;z-index:2147483647;' +
                'pointer-events:none;text-align:right;user-select:none;' +
                'font-family:Consolas,\'Segoe UI\',monospace;';
            var label = document.createElement('div');
            label.textContent = 'COMBO';
            label.style.cssText = 'font-size:11px;letter-spacing:4px;opacity:.65;color:#fff;';
            comboNumEl = document.createElement('div');
            comboNumEl.style.cssText = 'font-size:52px;font-weight:900;line-height:1;';
            var barWrap = document.createElement('div');
            barWrap.style.cssText = 'width:110px;height:3px;margin-top:6px;margin-left:auto;' +
                'background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden;';
            comboBarEl = document.createElement('div');
            comboBarEl.style.cssText = 'height:100%;width:100%;';
            barWrap.appendChild(comboBarEl);
            comboWrap.appendChild(label);
            comboWrap.appendChild(comboNumEl);
            comboWrap.appendChild(barWrap);
        }
        if (comboWrap.parentNode !== group) group.appendChild(comboWrap);
    }

    function bumpCombo(editorNode, rect) {
        combo++;
        if (cfg.combo.timeout > 0) {
            clearTimeout(comboResetTimer);
            comboResetTimer = setTimeout(resetCombo, cfg.combo.timeout * 1000);
        }
        if (!cfg.combo.enabled) return;
        ensureComboEl(editorNode);
        var color = comboColor();
        comboWrap.style.display = '';
        comboNumEl.textContent = combo;
        comboNumEl.style.color = color;
        comboNumEl.style.textShadow = '0 0 12px ' + color;
        comboNumEl.animate(
            [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
            { duration: 110, easing: 'ease-out' });
        if (comboBarEl) {
            comboBarEl.style.background = color;
            if (cfg.combo.timeout > 0) {
                comboBarEl.animate(
                    [{ width: '100%' }, { width: '0%' }],
                    { duration: cfg.combo.timeout * 1000, fill: 'forwards' });
            }
        }
        if (cfg.combo.exclamations && combo % 10 === 0 && rect) {
            exclaim(rect, color);
        }
    }

    function resetCombo() {
        combo = 0;
        if (comboWrap) comboWrap.style.display = 'none';
    }

    function exclaim(rect, color) {
        var word = EXCLAMATIONS[Math.floor(Math.random() * EXCLAMATIONS.length)];
        var el = document.createElement('div');
        el.textContent = word;
        el.style.cssText =
            'position:fixed;left:' + (rect.left + 12) + 'px;top:' + (rect.top - 8) + 'px;' +
            'z-index:2147483647;pointer-events:none;font-weight:900;font-size:20px;' +
            'font-family:Consolas,\'Segoe UI\',monospace;font-style:italic;' +
            'color:' + color + ';text-shadow:0 0 8px ' + color + ';';
        document.body.appendChild(el);
        el.animate(
            [
                { transform: 'translateY(0) rotate(-4deg)', opacity: 1 },
                { transform: 'translateY(-70px) rotate(4deg)', opacity: 0 }
            ],
            { duration: 900, easing: 'ease-out' }
        ).onfinish = function () { el.remove(); };
    }

    // ---------- input hook ----------
    function colorAt(rect) {
        var el = document.elementFromPoint(
            Math.max(rect.left - 4, 0),
            rect.top + rect.height / 2
        );
        if (el && el.closest('.view-line')) {
            var c = getComputedStyle(el).color;
            if (c && c !== 'rgba(0, 0, 0, 0)') return c;
        }
        return 'hsl(' + Math.floor(Math.random() * 360) + ',80%,65%)';
    }

    function cursorRect(editorNode) {
        var cur = editorNode.querySelector('.cursors-layer .cursor');
        if (!cur) return null;
        var rect = cur.getBoundingClientRect();
        if (!rect.width && !rect.height) return null;
        return rect;
    }

    function burst(editorNode) {
        var rect = cursorRect(editorNode);
        if (!rect) return;
        ensureCanvas();
        spawn(rect.left + rect.width / 2, rect.top + rect.height * 0.7, colorAt(rect));
    }

    document.addEventListener('keydown', function (e) {
        var t = e.target;
        // monaco 입력 요소만: 구버전 textarea.inputarea 또는 EditContext div.native-edit-context
        if (!t || !t.classList ||
            !(t.classList.contains('inputarea') || t.classList.contains('native-edit-context'))) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return; // 단축키 제외
        if (e.key.length !== 1 && e.key !== 'Enter' && e.key !== 'Backspace'
            && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'Process') return; // Process = IME(한글)
        var editorNode = t.closest('.monaco-editor');
        if (!editorNode) return;
        // 커서가 이동한 뒤 좌표를 잡도록 다음 프레임에 처리
        requestAnimationFrame(function () {
            try {
                var rect = cursorRect(editorNode);
                bumpCombo(editorNode, rect);
                if (combo >= cfg.combo.activationThreshold) {
                    burst(editorNode);
                    shake(editorNode);
                }
            } catch (err) { /* ignore */ }
        });
    }, true);
})();
