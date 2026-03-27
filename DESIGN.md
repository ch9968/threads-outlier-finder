# Design System — Santiago

## Product Context
- **What this is:** Threads 아웃라이어 분석기. 특정 계정의 게시물 중 비정상적으로 잘 된 것을 찾고, LLM으로 6차원 분석을 제공하는 개인 대시보드.
- **Who it's for:** Threads 콘텐츠 크리에이터 (본인 1명, 배포 URL로 공유 가능)
- **Space/industry:** 소셜 미디어 분석 도구 (ViewStats, Hypefury, OutlierKit과 같은 카테고리)
- **Project type:** Data analytics dashboard (web app)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — 기능 우선, 데이터가 주인공인 디자인
- **Decoration level:** Minimal — 타이포그래피와 컬러만으로 위계를 잡음
- **Mood:** 따뜻하지만 기능적인 도구. 차갑고 기업적인 SaaS가 아니라, 개인이 매일 쓰는 잘 만든 도구의 느낌.
- **Default theme:** Dark mode (Threads 생태계에 속한 도구로서의 네이티브 느낌)
- **Reference sites:** viewstats.com, hypefury.com, outlierkit.com — 컨벤션 참고, 차별화 근거

## Typography
- **Display/Hero (Brand):** Satoshi (weight 900) — "Santiago" 로고 전용. 기하학적이면서 개성 있음. 라틴 단어 브랜드에 최적.
- **Body:** Pretendard Variable — 한국어 UI 표준. 한글+라틴 모두 깔끔. 가변 폰트로 전 구간(400~700) 커버.
- **UI/Labels:** Pretendard Variable (same as body)
- **Data/Tables:** JetBrains Mono (font-variant-numeric: tabular-nums) — 아웃라이어 배수, 인게이지먼트 숫자에 모노스페이스. 데이터를 시각적 앵커로.
- **Code:** JetBrains Mono
- **Loading:**
  - Pretendard: `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
  - Satoshi: `api.fontshare.com/v2/css?f[]=satoshi@700,900&display=swap`
  - JetBrains Mono: Google Fonts `family=JetBrains+Mono:wght@400;500;600;700`
- **Scale:**
  - Hero: 48px / 3rem / Satoshi 900
  - H1: 30px / 1.875rem / Pretendard 700
  - H2: 24px / 1.5rem / Pretendard 600
  - H3: 20px / 1.25rem / Pretendard 600
  - Body: 16px / 1rem / Pretendard 400
  - Small: 14px / 0.875rem / Pretendard 400
  - Caption: 12px / 0.75rem / Pretendard 500
  - Data large: 32px / 2rem / JetBrains Mono 700
  - Data inline: 14px / 0.875rem / JetBrains Mono 600

## Color
- **Approach:** Restrained (1 accent + neutrals, color is rare and meaningful)
- **Primary:** `#F59E0B` (amber-500) — CTA, 아웃라이어 배수 강조, 활성 상태. 파란색/보라색 일색인 분석 도구 카테고리에서 "노이즈 속 금 찾기"의 은유.
- **Primary hover:** `#FBBF24` (amber-400, dark mode) / `#D97706` (amber-600, light mode)
- **Primary subtle:** `rgba(245, 158, 11, 0.12)` — 배지 배경, 하이라이트, 호버
- **Neutrals:** Warm Stone (Tailwind stone palette)
  - 50: `#FAFAF9` (light mode card)
  - 100: `#F5F5F4` (light mode background)
  - 200: `#E7E5E4` (light mode border)
  - 300: `#D6D3D1`
  - 400: `#A8A29E` (dark mode secondary text, dark mode tertiary text — AA compliant 7.83:1)
  - 500: `#78716C` (light mode secondary text only — dark mode에서 WCAG AA 미달 4.12:1)
  - 600: `#57534E`
  - 700: `#44403C` (dark mode border)
  - 800: `#292524` (dark mode card/elevated)
  - 900: `#1C1917` (dark mode background)
  - 950: `#0C0A09` (dark mode page background)
- **Semantic:**
  - Success: `#22C55E` (green-500) — 높은 배수, 긍정 지표
  - Warning: `#EAB308` (yellow-500) — 중간 수준 알림
  - Error: `#EF4444` (red-500) — 에러, 삭제
  - Info: `#78716C` (stone-500) — 보조 정보
- **Dark mode strategy:** Dark mode가 기본. Stone-900/950 배경, 채도 유지(따뜻한 톤이라 감소 불필요). Accent는 amber-500 유지(dark 배경에서 충분한 대비).
- **Light mode:** Stone-100 배경, white 카드. Accent는 amber-600으로 한 단계 어둡게(밝은 배경 대비 확보).

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (데이터 밀도와 여백의 균형)
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined — 대시보드는 예측 가능한 구조가 필수
- **Grid:** 단일 컬럼 중심 (개인 도구, 복잡한 멀티컬럼 불필요). 분석 상세에서만 2컬럼 (포스트 + 분석 패널).
- **Max content width:** 1120px
- **Border radius:**
  - sm: 4px (인풋, 배지)
  - md: 8px (카드, 버튼)
  - lg: 12px (모달, 큰 컨테이너, 목업 프레임)
  - full: 9999px (아바타, 필터 칩, pill 배지)

## Motion
- **Approach:** Minimal-functional — 이해를 돕는 전환만
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150ms) medium(300ms) long(500ms)
- **Usage:**
  - 테마 전환: background/color transition 300ms
  - 카드 호버: border-color transition 150ms
  - 버튼 호버: background transition 150ms
  - 분석 바 채우기: width transition 600ms ease
  - 로딩: skeleton pulse animation
  - 페이지 전환: fade 200ms

## Component Patterns

### Buttons
- **Primary:** amber background, dark text. 주요 CTA (분석하기, 저장).
- **Secondary:** transparent + border. 보조 액션 (컬렉션 보기, 필터).
- **Ghost:** transparent, no border. 취소, 더보기 등 저강조 액션.
- **Sizes:** default (14px, py-10px px-20px), sm (13px, py-6px px-14px)

### Input with Button
- 통합 인풋+버튼 패턴: border로 감싸고, 버튼은 내부 우측에 배치.
- 홈 화면 계정 입력에 사용.

### Badges
- Mono font, pill shape, subtle background.
- amber: 아웃라이어 배수 표시
- green: 높은 성과
- red: 저성과/에러
- neutral: 메타데이터 (텍스트, 단일 포스트, 글자 수)

### Filter Chips
- Pill shape, border, secondary text.
- Active: amber subtle background + amber border + amber text.
- 컬렉션 계정별 필터에 사용.

### Outlier Item
- 4컬럼 그리드: 배수(mono, large, amber) | 텍스트(2줄 클램프) | 메트릭(mono, small) | 하트 버튼
- 호버 시 border 강조.

### Dimension Card
- 6차원 분석 결과 표시 (정성 분석만, 점수 없음 — ADR: "LLM 점수 = fake rigor").
- 헤더: 차원명 (Pretendard 600, amber text)
- 본문: 분석 텍스트 (Body size, secondary color). 2~4문장의 인사이트.
- 훅 유형 태그: 해당 차원이 훅 분석일 경우, 훅 유형 배지 (neutral badge)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-27 | Initial design system created | /design-consultation: office-hours 컨텍스트 + ViewStats/Hypefury/OutlierKit 경쟁 리서치 기반 |
| 2026-03-27 | Amber accent over blue/purple | 카테고리 차별화. 파란색(SaaS 기본) 보라색(AI slop) 회피. "노이즈 속 금 찾기" 은유. |
| 2026-03-27 | Dark mode as default | Threads 생태계 네이티브 느낌. 경쟁 제품 대부분 라이트 기본 → 차별화. |
| 2026-03-27 | JetBrains Mono for data | 숫자를 디자인 요소로 승격. 배수, 인게이지먼트 수치가 시각적 앵커. |
| 2026-03-27 | Pretendard as body font | 한국어 UI 표준. 한글+라틴 커버. 가변 폰트로 번들 최적화. |
| 2026-03-27 | Satoshi for brand only | "Santiago" 라틴 로고 전용. 본문과 명확히 분리. |
| 2026-03-27 | Dimension Card: 점수/프로그레스 바 제거 | "LLM 점수 = fake rigor" 원칙. 정성 텍스트만 표시. |
| 2026-03-27 | Dark mode tertiary: stone-500→stone-400 | WCAG AA 대비율 미달 (4.12:1→7.83:1). |
