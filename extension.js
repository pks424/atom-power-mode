// Atom Power Mode — workbench.html에 캔버스 파티클 엔진을 주입/관리하는 확장
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const START = '<!-- !! ATOM-POWER-MODE-START !! -->';
const END = '<!-- !! ATOM-POWER-MODE-END !! -->';
const LEGACY_START = '<!-- !! VSCODE-CUSTOM-CSS-START !! -->';
const LEGACY_END = '<!-- !! VSCODE-CUSTOM-CSS-END !! -->';

function workbenchPath() {
    const base = path.join(vscode.env.appRoot, 'out', 'vs', 'code');
    const candidates = [
        'electron-browser/workbench/workbench.html',
        'electron-sandbox/workbench/workbench.html',
        'electron-browser/workbench/workbench.esm.html',
        'electron-sandbox/workbench/workbench.esm.html'
    ].map(function (p) { return path.join(base, p.replace(/\//g, path.sep)); });
    return candidates.find(fs.existsSync);
}

function buildConfig() {
    const c = vscode.workspace.getConfiguration('atomPowerMode');
    return {
        particleCount: c.get('particleCount'),
        particleSize: c.get('particleSize'),
        gravity: c.get('gravity'),
        maxParticles: c.get('maxParticles'),
        shake: {
            enabled: c.get('shake.enabled'),
            intensity: c.get('shake.intensity'),
            duration: c.get('shake.duration')
        },
        combo: {
            enabled: c.get('combo.enabled'),
            timeout: c.get('combo.timeout'),
            activationThreshold: c.get('combo.activationThreshold'),
            exclamations: c.get('combo.exclamations')
        }
    };
}

// CSP(script-src 'self', unsafe-inline 없음)가 적용된 최신 workbench에서도 동작하도록
// 인라인 스크립트가 아니라 workbench.html 옆에 놓는 외부 파일을 참조한다.
const JS_NAME = 'atom-power-mode.js';

function buildBlock() {
    return START + '\n<script src="./' + JS_NAME + '"></script>\n' + END;
}

function buildJs(ctx) {
    const core = fs.readFileSync(path.join(ctx.extensionPath, 'core', 'powermode-core.js'), 'utf8');
    return 'window.__APM_CONFIG = ' + JSON.stringify(buildConfig()) + ';\n' + core;
}

function stripBlock(html, startMarker, endMarker) {
    const s = html.indexOf(startMarker);
    if (s < 0) return html;
    const e = html.indexOf(endMarker, s);
    if (e < 0) return html;
    // 주입 시 붙인 앞 들여쓰기/뒤 개행까지 함께 제거해야 strip→inject가 멱등이 된다.
    // (안 그러면 실행마다 공백이 누적돼 파일이 매번 달라지고 리로드 안내가 무한 반복됨)
    let head = html.slice(0, s).replace(/(?:[\t ]*\r?\n)*[\t ]*$/, '\n');
    let tail = html.slice(e + endMarker.length).replace(/^(?:[\t ]*\r?\n)+/, '');
    return head + tail;
}

// 주입 상태를 원하는 상태로 동기화. 변경이 있었으면 true 반환.
function apply(ctx, opts) {
    opts = opts || {};
    const file = workbenchPath();
    if (!file) {
        vscode.window.showErrorMessage('Atom Power Mode: workbench.html을 찾지 못했습니다 (VSCode 구조 변경?).');
        return false;
    }
    const enabled = vscode.workspace.getConfiguration('atomPowerMode').get('enabled');
    const jsFile = path.join(path.dirname(file), JS_NAME);
    let html = fs.readFileSync(file, 'utf8');
    const original = html;

    html = stripBlock(html, START, END);
    if (enabled) {
        const block = buildBlock();
        // </head> 앞 들여쓰기를 흡수해 주입 결과가 고정점이 되게 한다 (함수 치환 = 블록 내 '$' 이스케이프 이슈 방지)
        html = html.replace(/[\t ]*<\/head>/, function () { return '\t' + block + '\n</head>'; });
    }

    let changed = false;
    try {
        if (enabled) {
            const desiredJs = buildJs(ctx);
            const currentJs = fs.existsSync(jsFile) ? fs.readFileSync(jsFile, 'utf8') : null;
            if (currentJs !== desiredJs) {
                fs.writeFileSync(jsFile, desiredJs, 'utf8');
                changed = true;
            }
        } else if (fs.existsSync(jsFile)) {
            fs.unlinkSync(jsFile);
            changed = true;
        }
        if (html !== original) {
            fs.writeFileSync(file, html, 'utf8');
            changed = true;
        }
    } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
            vscode.window.showErrorMessage(
                'Atom Power Mode: workbench.html 쓰기 권한이 없습니다. VSCode를 관리자 권한으로 한 번 실행한 뒤 "Atom Power Mode: Re-apply Injection"을 실행하세요.');
        } else {
            vscode.window.showErrorMessage('Atom Power Mode 주입 실패: ' + err.message);
        }
        return false;
    }
    if (!changed) return false;
    if (!opts.silent) promptReload(enabled ? 'Power Mode 적용' : 'Power Mode 해제');
    return true;
}

function promptReload(what) {
    vscode.window.showInformationMessage(what + '을 완료하려면 창을 다시 로드하세요.', '지금 리로드')
        .then(function (v) {
            if (v) vscode.commands.executeCommand('workbench.action.reloadWindow');
        });
}

function setEnabled(value) {
    return vscode.workspace.getConfiguration('atomPowerMode')
        .update('enabled', value, vscode.ConfigurationTarget.Global);
}

function activate(ctx) {
    ctx.subscriptions.push(
        vscode.commands.registerCommand('atomPowerMode.enable', function () {
            setEnabled(true).then(function () { apply(ctx); });
        }),
        vscode.commands.registerCommand('atomPowerMode.disable', function () {
            setEnabled(false).then(function () { apply(ctx); });
        }),
        vscode.commands.registerCommand('atomPowerMode.reapply', function () {
            if (!apply(ctx)) vscode.window.showInformationMessage('Atom Power Mode: 이미 최신 상태입니다.');
        }),
        vscode.workspace.onDidChangeConfiguration(function (e) {
            if (e.affectsConfiguration('atomPowerMode')) apply(ctx);
        })
    );
    // 시작 시 동기화: VSCode 업데이트로 주입이 날아갔거나 설정과 어긋나면 복구
    if (apply(ctx, { silent: true })) {
        promptReload('Power Mode 재주입(업데이트 감지)');
    }
}

function deactivate() { }

module.exports = { activate: activate, deactivate: deactivate };
