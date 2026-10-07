// vscode:uninstall 훅 — 확장을 완전히 삭제한 뒤 VS Code가 재시작될 때 node로 실행된다(vscode API 없음).
// 주입 시 기록해 둔 appRoot로 workbench.html 블록과 외부 스크립트를 지우고 체크섬을 되돌린다.
const fs = require('fs');
const injector = require('./injector');

const state = injector.statePath(__dirname);
try {
    const appRoot = JSON.parse(fs.readFileSync(state, 'utf8')).appRoot;
    injector.sync(appRoot, null);
    fs.unlinkSync(state);
} catch (err) {
    // 기록이 없거나(주입한 적 없음) 쓰기 권한이 없으면 할 수 있는 일이 없다. 훅 실패가 삭제를 막지 않도록 조용히 끝낸다.
    console.error('atom-power-mode uninstall cleanup skipped: ' + err.message);
}
