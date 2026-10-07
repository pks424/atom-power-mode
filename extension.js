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

// 주입 상태를 원하는 상태로 동기화. 변경이 있었으면 true 반환.
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
    if (!opts.silent) promptReload(enabled);
    return true;
}

function promptReload(enabled) {
    const msg = enabled
        ? t('Power Mode를 적용하려면 창을 다시 로드하세요.', 'Reload the window to apply Power Mode.')
        : t('Power Mode를 해제하려면 창을 다시 로드하세요.', 'Reload the window to remove Power Mode.');
    const reload = t('지금 리로드', 'Reload Now');
    vscode.window.showInformationMessage(msg, reload).then(function (v) {
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
    if (apply(ctx, { silent: true })) {
        promptReload(vscode.workspace.getConfiguration('atomPowerMode').get('enabled'));
    }
}

function deactivate() { }

module.exports = { activate: activate, deactivate: deactivate };
