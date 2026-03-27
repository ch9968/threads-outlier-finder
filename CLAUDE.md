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

### 세션 운용 원칙

**같은 세션 안에서 역할을 체이닝한다.** 각 역할의 출력이 다음 역할의 컨텍스트가 되므로,
build → review → qa → ship은 하나의 세션에서 순차적으로 돌린다.
build한 맥락(왜 이렇게 구현했는지, 트레이드오프)을 review가 알고 있어야
수정 반영의 디테일이 올라간다.

**세션을 분리하는 경우:**
- Plan(설계) → Build(구현) 사이: 역할이 근본적으로 다르고, Plan 결과는 파일로 저장됨
- 컨텍스트가 너무 길어져서 품질이 떨어질 때
- 서로 다른 feature/브랜치를 병렬로 돌릴 때

### 문서 저장 규칙

gstack 스킬이 문서를 생성할 때, `~/.gstack/projects/`에 저장하는 것에 **추가로**
아래 경로에 사본을 저장한다. 디렉토리가 없으면 자동 생성한다 (`mkdir -p`).

**Source of Truth:** `docs/` 디렉토리가 정본이다. `~/.gstack/projects/`는 스킬 간
데이터 전달용 캐시로 취급한다. 충돌 시 `docs/` 쪽이 우선한다.

| 스킬 | 저장 경로 | 파일명 형식 |
|------|----------|------------|
| /office-hours | `docs/plan/` | `{YYYY-MM-DD}-{feature}-design.md` |
| /plan-ceo-review | `docs/plan/` | `{YYYY-MM-DD}-{feature}-ceo-review.md` |
| /plan-eng-review | `docs/plan/` | `{YYYY-MM-DD}-{feature}-eng-plan.md` |
| /plan-design-review | `docs/design/` | `{YYYY-MM-DD}-{feature}-design-review.md` |
| /design-consultation | `docs/design/` + 루트 `DESIGN.md` | `{YYYY-MM-DD}-design-system.md` |
| /autoplan | 위 스킬들의 규칙을 각각 적용 | |

### /plan-eng-review 2단계 운용

/plan-eng-review는 한 프로젝트에서 **2번** 실행된다. 역할이 다르다.

**1차: 설계 게이트 (Plan 세션, main branch)**
- 전체 아키텍처, 데이터 흐름, 상태 모델, 다이어그램 확정
- Phase 분할 — 각 Phase의 범위, 의존 관계, 예상 LOC
- 테스트 전략 및 매트릭스 수립
- 결과물: eng-plan 파일 (`docs/plan/`에 저장)

**2차: 구현 게이트 (Build 세션, feature branch)**
- eng-plan에서 **지금 빌드할 Phase만** 상세 검증
- 앞선 Phase에서 변경된 인터페이스/스키마와의 정합성 확인
- 검증 통과 후 같은 세션에서 Build → Review → QA → Ship 순차 진행

### 자동 스프린트 규칙

"Phase N build해줘"라고 요청받으면, 아래 순서를 **같은 세션 내에서** 자동 실행한다.

```
1. eng-plan 읽기 → Phase N 범위 확인
2. /plan-eng-review (2차 구현 게이트) → Phase N 상세 검증
3. Build → Phase N 범위만 구현
4. /review → 코드 리뷰 + 자동 수정
5. /qa → QA 테스트 (staging URL이 있으면 브라우저 테스트 포함)
6. /ship → PR 생성
7. eng-plan 해당 Phase를 [DONE]으로 업데이트
```

중간에 사용자 판단이 필요한 질문(AskUserQuestion)이 나오면 정상적으로 묻고 진행한다.
컨텍스트가 과도하게 길어지면 사용자에게 알리고 세션 분리를 제안한다.

### 코드 컨벤션

`docs/code-convention.md`가 존재하면 코드 작성 전에 반드시 읽고 해당 규칙에 맞춰 작성할 것.

**자동 생성 규칙:**
- /plan-eng-review **시작 시** `docs/code-convention.md`가 없으면 기본 스캐폴딩을 생성한다.
- eng-review 과정에서 기술 스택과 아키텍처가 결정될 때마다 컨벤션 파일을 업데이트한다.
- eng-review 완료 시점에 최종 버전이 확정된다.

컨벤션에 포함할 항목:
- 네이밍 규칙 (파일, 변수, 함수, 컴포넌트)
- 디렉토리 구조
- import 순서
- 에러 핸들링 패턴
- 테스트 작성 규칙
- 커밋 메시지 형식

이미 존재하면 eng-plan 내용과 충돌이 없는지 확인하고, 필요시 업데이트를 제안한다.

### ADR (Architecture Decision Records)

/plan-eng-review 과정에서 **핵심** 아키텍처 결정이 내려질 때 `docs/adr/` 에 ADR을 생성한다.

**컨텍스트 절약 규칙:** 한 eng-review 세션에서 ADR은 **최대 3개**까지만 생성한다.
4개 이상의 결정이 있으면, 영향 범위가 큰 순서로 3개를 ADR로 쓰고
나머지는 eng-plan 본문에 인라인으로 "Minor Decision:" 접두사와 함께 기록한다.

**ADR 생성 기준 (아래 중 하나 이상 해당):**
- 기술 스택 선택 (DB, 프레임워크, 인프라)
- 아키텍처 패턴 선택 (모노리스 vs 마이크로서비스 등)
- 기존 결정을 뒤집는 변경 (Supersedes 필드로 이전 ADR 참조)

**파일명 형식:** `docs/adr/{NNN}-{결정-제목}.md` (예: `001-use-postgresql.md`)

**ADR 템플릿:**
```markdown
# {NNN}. {결정 제목}

Date: {YYYY-MM-DD}
Status: Accepted | Deprecated | Superseded by {NNN}

## Context
이 결정이 필요했던 배경과 제약 조건

## Options Considered
- Option A: ...
- Option B: ...

## Decision
최종 선택과 그 이유

## Consequences
이 결정으로 인한 긍정적/부정적 영향
```

### 리뷰 참조 규칙

/review 시 아래 파일들을 반드시 읽고 위반 여부를 체크한다:
- `docs/code-convention.md` — 코드 컨벤션 위반
- `docs/adr/*.md` — 기존 아키텍처 결정과 모순되는 패턴 사용
- `DESIGN.md` (존재 시) — 디자인 시스템 위반

### 프로젝트 문서 구조

```
프로젝트/
├── CLAUDE.md              ← 이 파일
├── DESIGN.md              ← /design-consultation 결과 (UI 프로젝트 시)
├── docs/
│   ├── plan/              ← office-hours, CEO 리뷰, eng plan
│   ├── design/            ← 디자인 리뷰, 디자인 시스템 문서
│   ├── adr/               ← 아키텍처 결정 기록 (세션당 최대 3개)
│   └── code-convention.md ← 코드 컨벤션 (필수 참조)
└── ...
```
