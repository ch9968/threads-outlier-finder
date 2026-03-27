## gstack

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse,
/qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro,
/investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard,
/unfreeze, /gstack-upgrade.

### 핵심 원칙

**Boil the Lake:** AI 코딩에서 완전한 구현의 비용은 거의 0이다. 90% 구현과 100%
구현의 차이가 수십 줄이면, 항상 100%를 선택한다. 테스트, 에지 케이스, 에러 핸들링을
"follow-up PR"로 미루지 않는다.

**Search Before Building:** 새로운 패턴이나 인프라를 만들기 전에 반드시 기존 해법을
먼저 검색한다. 검색 비용은 0에 가깝고, 검색하지 않는 비용은 더 나쁜 것을 재발명하는 것이다.

**외부 API/서비스 선택은 반드시 사용자에게 확인받는다.** 후보 2-3개를 비교표(비용, 품질, 제한사항)로 정리한 뒤 사용자에게 선택을 맡긴다. Plan/Build 단계 동일.

### 세션 운용

**같은 세션 안에서 체이닝:** build → review → qa → ship → document-release.
**세션 분리:** Plan→Build 전환 시, 컨텍스트 초과 시, 다른 feature branch 시.

### 문서 저장 규칙

gstack 스킬 문서 생성 시 `~/.gstack/projects/`에 추가로 아래 경로에 저장. 디렉토리 없으면 `mkdir -p`.

**Source of Truth:** `docs/`가 정본. `~/.gstack/projects/`는 캐시. 충돌 시 `docs/` 우선.

| 스킬 | 저장 경로 | 파일명 형식 |
|------|----------|------------|
| /office-hours | `docs/plan/` | `{YYYY-MM-DD}-{feature}-design.md` |
| /plan-ceo-review | `docs/plan/` | `{YYYY-MM-DD}-{feature}-ceo-review.md` |
| /plan-eng-review | `docs/plan/` | `{YYYY-MM-DD}-{feature}-eng-plan.md` |
| /plan-design-review | `docs/design/` | `{YYYY-MM-DD}-{feature}-design-review.md` |
| /design-consultation | `docs/design/` + 루트 `DESIGN.md` | `{YYYY-MM-DD}-design-system.md` |
| /autoplan | 위 스킬들의 규칙을 각각 적용 | |

### /plan-eng-review 2단계

**1차 (설계 게이트, Plan 세션):** 전체 아키텍처, Phase 분할, 테스트 전략 확정.
`docs/code-convention.md` 없으면 생성. ADR은 핵심 결정만 `docs/adr/`에 기록 (세션당 최대 3개, 템플릿: `docs/adr/TEMPLATE.md`). 나머지는 eng-plan에 "Minor Decision:"으로 인라인.

**Phase 설계 원칙 — 병렬 우선:**
- **기능(vertical slice) 단위로 쪼갠다.** 레이어 단위(DB→API→UI) 금지. 하나의 Phase가 DB+API+UI를 포함해도 된다.
- **의존 관계를 명시한다.** 각 Phase에 `depends_on: [Phase X]`를 표기.
- **Phase 0 (Foundation):** 공유 인프라(DB 스키마, 인증, 공통 타입)는 Phase 0으로 분리. 다른 모든 Phase가 이것만 의존하게 설계.
- **병렬 가능한 Phase는 같은 번호를 쓴다.** 예: Phase 2A, 2B, 2C는 동시 빌드 가능.
- **공유 상태를 최소화한다.** Phase 간 DB 테이블이 겹치면 의존성 발생. 테이블 소유권을 Phase별로 할당.

```
예시:
Phase 0: Foundation (DB schema, auth, shared types) — no deps
Phase 1A: Feed scraping pipeline — depends on 0
Phase 1B: Dashboard UI — depends on 0
Phase 1C: Analytics engine — depends on 0
Phase 2: Integration (cross-feature flows) — depends on 1A, 1B, 1C
```

병렬 Phase는 각각 별도 branch에서 빌드하고 별도 PR로 머지한다. Conductor 워크스페이스를 병렬로 띄워서 동시 진행 가능.

**2차 (구현 게이트, Build 세션):** 해당 Phase만 검증.
PASS → Build, PASS WITH CHANGES → eng-plan 수정 후 Build, FAIL → 사용자에게 보고.

### 자동 스프린트

"Phase N build해줘" 요청 시 같은 세션에서 순차 실행:
1. 필수 문서 읽기 (eng-plan, code-convention, ADR, DESIGN.md)
2. /plan-eng-review 2차 → Phase 검증
3. Build + checkpoint commit
4. Agent: /review → 자동수정 처리, 판단 필요한 건 사용자에게
5. Agent: /qa → 동일
6. eng-plan Phase [DONE] 표기
7. Agent: /ship → PR 생성
8. Agent: /document-release → 문서 동기화

**병렬 Phase:** "Phase 1A, 1B 병렬 build해줘" 시 각 Phase를 별도 워크스페이스에서 실행. 사용자가 Conductor에서 워크스페이스를 나눠 요청한다.
**선택적 강화:** Phase가 고위험(인증, 결제, 데이터 삭제)이면 Step 4 이후 /codex review 추가.

### 리뷰 참조

/review 시 반드시 읽고 위반 체크: `docs/code-convention.md`, `docs/adr/*.md`, `DESIGN.md` (존재 시).

### Design System

UI 작업 전 DESIGN.md 필수 참조. 명시 규칙과 충돌하는 변경은 사용자 승인 필요.
QA에서는 렌더링된 UI가 DESIGN.md와 다른지 확인 (시각적 결과 기준).

### 프로젝트 문서 구조

```
프로젝트/
├── CLAUDE.md              ← 이 파일
├── DESIGN.md              ← /design-consultation 결과
├── docs/
│   ├── plan/              ← office-hours, CEO 리뷰, eng plan
│   ├── design/            ← 디자인 리뷰, 디자인 시스템 문서
│   ├── adr/               ← 아키텍처 결정 기록 (TEMPLATE.md 참조)
│   └── code-convention.md ← 코드 컨벤션 (필수 참조)
└── ...
```
