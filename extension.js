// Atom Power Mode — workbench.html에 캔버스 파티클 엔진을 주입/관리하는 확장
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const injector = require('./injector');

// 한국어 UI면 한글, 그 외는 영어
function t(ko, en) {
    return vscode.env.language.indexOf('ko') === 0 ? ko : en;
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

function buildJs(ctx) {
    const core = fs.readFileSync(path.join(ctx.extensionPath, 'core', 'powermode-core.js'), 'utf8');
    return 'window.__APM_CONFIG = ' + JSON.stringify(buildConfig()) + ';\n' + core;
}

// uninstall 훅이 정리할 수 있도록 appRoot를 기록한다.
function saveState(ctx) {
    const file = injector.statePath(ctx.extensionPath);
    const json = JSON.stringify({ appRoot: vscode.env.appRoot });
    try {
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== json) fs.writeFileSync(file, json, 'utf8');
    } catch (err) {
        console.error('atom-power-mode: failed to save state: ' + err.message);
    }
}

// 주입 상태를 원하는 상태로 동기화. 변경 종류('html' / 'js') 또는 false 반환.
function apply(ctx, opts) {
    opts = opts || {};
    const enabled = vscode.workspace.getConfiguration('atomPowerMode').get('enabled');
    let changed;
    try {
        changed = injector.sync(vscode.env.appRoot, enabled ? buildJs(ctx) : null);
    } catch (err) {
        if (err.code === 'NOWORKBENCH') {
            vscode.window.showErrorMessage(t(
                'Atom Power Mode: workbench.html을 찾지 못했습니다 (VS Code 구조 변경?).',
                'Atom Power Mode: workbench.html not found (VS Code layout changed?).'));
        } else if (err.code === 'EPERM' || err.code === 'EACCES') {
            vscode.window.showErrorMessage(t(
                'Atom Power Mode: VS Code 설치 폴더 쓰기 권한이 없습니다. VS Code를 관리자 권한으로 한 번 실행한 뒤 "Atom Power Mode: Re-apply Injection"을 실행하세요.',
                'Atom Power Mode: no write permission to the VS Code install folder. Run VS Code as administrator once, then run "Atom Power Mode: Re-apply Injection".'));
        } else {
            vscode.window.showErrorMessage(t('Atom Power Mode 주입 실패: ', 'Atom Power Mode injection failed: ') + err.message);
        }
        return false;
    }
    if (enabled) saveState(ctx);
    if (!changed) return false;
    if (!opts.silent) promptAfterChange(enabled, changed);
    return changed;
}

// workbench.html이 바뀌면 product.json 체크섬도 바뀌는데, VS Code는 product.json을 프로세스 시작 때만 읽는다.
// 창 다시 로드로는 옛 체크섬으로 검사해 "설치 손상" 경고가 뜨므로 완전 종료 후 재실행을 안내한다.
// 스크립트만 바뀐 경우(설정 변경)는 체크섬과 무관해 창 다시 로드로 충분하다.
function promptAfterChange(enabled, changed) {
    if (changed === 'html') {
        const msg = enabled
            ? t('Power Mode를 적용하려면 VS Code를 완전히 종료한 뒤 다시 실행하세요. (창 다시 로드만 하면 "설치 손상" 경고가 한 번 뜹니다)',
                'Quit VS Code and start it again to apply Power Mode. (A window reload alone shows the "installation appears to be corrupt" warning once.)')
            : t('Power Mode를 해제하려면 VS Code를 완전히 종료한 뒤 다시 실행하세요.',
                'Quit VS Code and start it again to remove Power Mode.');
        const quit = t('VS Code 종료', 'Quit VS Code');
        vscode.window.showInformationMessage(msg, quit).then(function (v) {
            if (v === quit) vscode.commands.executeCommand('workbench.action.quit');
        });
        return;
    }
    const reload = t('지금 리로드', 'Reload Now');
    vscode.window.showInformationMessage(t('설정을 적용하려면 창을 다시 로드하세요.', 'Reload the window to apply the settings.'), reload)
        .then(function (v) {
            if (v === reload) vscode.commands.executeCommand('workbench.action.reloadWindow');
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
            if (!apply(ctx)) vscode.window.showInformationMessage(t('Atom Power Mode: 이미 최신 상태입니다.', 'Atom Power Mode: already up to date.'));
        }),
        vscode.workspace.onDidChangeConfiguration(function (e) {
            if (e.affectsConfiguration('atomPowerMode')) apply(ctx);
        })
    );
    // 시작 시 동기화: VS Code 업데이트로 주입이 날아갔거나 설정과 어긋나면 복구
    const changed = apply(ctx, { silent: true });
    if (changed) promptAfterChange(vscode.workspace.getConfiguration('atomPowerMode').get('enabled'), changed);
}

function deactivate() { }

module.exports = { activate: activate, deactivate: deactivate };
