// workbench.html 주입/제거 + product.json 체크섬 동기화.
// vscode API에 의존하지 않는다 — 확장 본체(extension.js)와 uninstall 훅(uninstall.js)이 함께 쓴다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const START = '<!-- !! ATOM-POWER-MODE-START !! -->';
const END = '<!-- !! ATOM-POWER-MODE-END !! -->';
// CSP(script-src 'self', unsafe-inline 없음)가 적용된 최신 workbench에서도 동작하도록
// 인라인 스크립트가 아니라 workbench.html 옆에 놓는 외부 파일을 참조한다.
const JS_NAME = 'atom-power-mode.js';
// 블록 한 줄 전체(앞 들여쓰기·뒤 개행 포함). 1.0.3 이하의 여러 줄 블록도 함께 매칭된다.
const BLOCK_RE = /[\t ]*<!-- !! ATOM-POWER-MODE-START !! -->[\s\S]*?<!-- !! ATOM-POWER-MODE-END !! -->[\t ]*\r?\n?/;

function workbenchPath(appRoot) {
    const base = path.join(appRoot, 'out', 'vs', 'code');
    const candidates = [
        'electron-browser/workbench/workbench.html',
        'electron-sandbox/workbench/workbench.html',
        'electron-browser/workbench/workbench.esm.html',
        'electron-sandbox/workbench/workbench.esm.html'
    ].map(function (p) { return path.join(base, p.replace(/\//g, path.sep)); });
    return candidates.find(fs.existsSync);
}

function stripBlock(html) {
    return html.replace(BLOCK_RE, '');
}

// </head> 줄 앞에 같은 들여쓰기·같은 개행 문자로 한 줄을 끼워 넣는다.
// 기존 내용은 한 바이트도 건드리지 않으므로 stripBlock 하면 원본과 바이트 단위로 같아진다.
function injectBlock(html) {
    const at = html.indexOf('</head>');
    if (at < 0) return html;
    const eol = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const lineStart = html.lastIndexOf('\n', at) + 1;
    const before = html.slice(lineStart, at);
    const ownLine = /^[\t ]*$/.test(before);
    const insertAt = ownLine ? lineStart : at;
    const line = (ownLine ? before : '') + START + '<script src="./' + JS_NAME + '"></script>' + END + eol;
    return html.slice(0, insertAt) + line + html.slice(insertAt);
}

// VSCode는 시작 시 product.json의 checksums와 핵심 파일 해시를 비교해 "설치가 손상된 것 같습니다" 경고를 띄운다.
// workbench.html의 현재 해시(sha256 base64, '=' 제거)로 해당 값만 문자열 치환해 경고를 없앤다.
// 주입 해제 시 html이 원본으로 돌아가므로 같은 계산으로 원래 해시가 복원된다.
function syncChecksum(appRoot, file) {
    const productFile = path.join(appRoot, 'product.json');
    const key = path.relative(path.join(appRoot, 'out'), file).replace(/\\/g, '/');
    const text = fs.readFileSync(productFile, 'utf8');
    const current = (JSON.parse(text).checksums || {})[key];
    if (!current) return;
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('base64').replace(/=+$/, '');
    if (current === actual) return;
    fs.writeFileSync(productFile, text.replace('"' + current + '"', '"' + actual + '"'), 'utf8');
}

// 주입 상태를 원하는 상태로 동기화. 쓰기 실패 시 예외를 그대로 던진다.
// js: 주입할 스크립트 내용, null이면 제거.
// 반환: 'html'(workbench.html이 바뀜 → 체크섬도 바뀜) / 'js'(스크립트만 바뀜) / false(변경 없음)
function sync(appRoot, js) {
    const file = workbenchPath(appRoot);
    if (!file) throw Object.assign(new Error('workbench.html not found'), { code: 'NOWORKBENCH' });
    const jsFile = path.join(path.dirname(file), JS_NAME);
    const original = fs.readFileSync(file, 'utf8');
    let html = stripBlock(original);
    if (js !== null) html = injectBlock(html);

    let changed = false;
    if (js !== null) {
        const currentJs = fs.existsSync(jsFile) ? fs.readFileSync(jsFile, 'utf8') : null;
        if (currentJs !== js) {
            fs.writeFileSync(jsFile, js, 'utf8');
            changed = 'js';
        }
    } else if (fs.existsSync(jsFile)) {
        fs.unlinkSync(jsFile);
        changed = 'js';
    }
    if (html !== original) {
        fs.writeFileSync(file, html, 'utf8');
        changed = 'html';
    }
    syncChecksum(appRoot, file);
    return changed;
}

// uninstall 훅에는 vscode API가 없어 appRoot를 알 수 없으므로, 주입 시 확장 폴더 밖(~/.vscode)에 기록해 둔다.
function statePath(extensionPath) {
    return path.join(extensionPath, '..', '..', 'atom-power-mode.json');
}

module.exports = {
    START: START, END: END, JS_NAME: JS_NAME,
    workbenchPath: workbenchPath, stripBlock: stripBlock, injectBlock: injectBlock,
    syncChecksum: syncChecksum, sync: sync, statePath: statePath
};
