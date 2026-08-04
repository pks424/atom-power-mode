# Atom Power Mode (Canvas)

Atom 에디터의 [activate-power-mode](https://github.com/JoelBesada/activate-power-mode)를 VSCode로 포팅한 확장.
마켓플레이스의 GIF 기반 Power Mode와 달리, 워크벤치에 캔버스 파티클 엔진을 직접 주입해 **실시간 물리 파티클 + 화면 흔들림 + 콤보 카운터**를 제공한다.

## 동작 방식

- 확장이 VSCode 설치 폴더의 `workbench.html`에 스크립트 블록(`ATOM-POWER-MODE-START/END` 마커)을 주입한다.
- 키 입력마다 커서 위치에서 **커서 앞 토큰의 신택스 색상**으로 파티클을 분사한다.
- 설정 변경 시 자동 재주입 후 리로드를 안내하고, VSCode 업데이트로 주입이 사라지면 시작 시 자동 복구한다.
- 주입 특성상 "설치가 손상된 것 같습니다" 경고가 뜨는데 정상이다 (톱니바퀴 → 다시 표시 안 함).

## 명령

| 명령 | 설명 |
|---|---|
| `Atom Power Mode: Enable` | 활성화 + 주입 |
| `Atom Power Mode: Disable` | 비활성화 + 주입 제거 |
| `Atom Power Mode: Re-apply Injection` | 강제 재주입 (업데이트 후 복구 등) |

## 설정 (`atomPowerMode.*`)

| 설정 | 기본값 | 설명 |
|---|---|---|
| `enabled` | true | 파워모드 온/오프 |
| `particleCount` | 12 | 키당 파티클 수 (±50% 랜덤) |
| `particleSize` | 3.5 | 파티클 크기(px) |
| `gravity` | 0.12 | 중력 |
| `maxParticles` | 500 | 동시 파티클 상한 |
| `shake.enabled` | true | 흔들림 온/오프 |
| `shake.intensity` | 3 | 흔들림 강도(px) |
| `shake.duration` | 90 | 흔들림 시간(ms) |
| `combo.enabled` | true | 콤보 카운터 표시 |
| `combo.timeout` | 10 | 콤보 리셋 시간(초), 0=무한 |
| `combo.activationThreshold` | 0 | 이 콤보 이상일 때만 이펙트 발동 |
| `combo.exclamations` | true | 10콤보마다 감탄사 표시 |

## 빌드

```
npx @vscode/vsce package --allow-missing-repository
code --install-extension atom-power-mode-<version>.vsix
```

주의: `workbench.html` 쓰기 권한이 필요하다 (시스템 설치본이면 관리자 권한으로 VSCode 1회 실행).
