# Santiago — Threads 아웃라이어 분석기

> Threads 계정의 게시물 중 비정상적으로 잘 된 것을 찾고, AI로 왜 그런지 분석해주는 개인 대시보드

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Google Vertex AI](https://img.shields.io/badge/Vertex_AI_(Gemini)-4285F4?style=flat-square&logo=google-cloud&logoColor=white)

---

## 어떤 문제를 풀었나

Threads에서 특정 계정의 콘텐츠가 왜 잘 되는지 알고 싶어도, 단순히 좋아요 수를 보는 것만으로는 부족하다. 팔로워가 많으면 당연히 좋아요도 많기 때문이다.

이 툴은 **아웃라이어 배수**(좋아요 수 ÷ 계정 평균)를 기준으로 "비정상적으로 잘 된 게시물"을 찾아낸다. 그 다음 Gemini로 게시물을 6가지 차원에서 분석해서, 잘 된 이유를 구조화된 텍스트로 보여준다.

---

## 주요 기능

- **아웃라이어 감지** — 좋아요 수를 계정 평균과 비교해 배수로 표현. 상위 이상치를 한눈에 파악
- **AI 6차원 분석** — Vertex AI Gemini가 후킹, 전달력, 감성 구조, 실용성, 포맷, 타이밍을 분석. Server-Sent Events로 스트리밍
- **패턴 분석** — 여러 계정을 컬렉션으로 묶어 공통 패턴 추출
- **실시간 스크래핑** — Apify 웹훅으로 스크래핑 완료 시 자동 처리
- **Outlier Slider** — 배수 기준점을 실시간으로 조정하며 필터링

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 15 App Router, React, Tailwind CSS |
| Backend | Next.js Server Actions, Route Handlers (webhook) |
| Database | Supabase (PostgreSQL + RLS) |
| AI/LLM | Google Vertex AI — Gemini 1.5 Pro (streaming) |
| Scraping | Apify — `thenetaji/threads-scraper` |
| Validation | Zod |
| Testing | Vitest |

---

## 아키텍처 플로우

```
사용자 입력 (Threads URL)
        │
        ▼
Apify Actor 실행 (thenetaji/threads-scraper)
        │ webhook
        ▼
POST /api/webhooks/apify
        │
        ▼
Supabase — accounts / posts 테이블 upsert
        │
        ▼
아웃라이어 배수 계산 (좋아요 ÷ 계정 평균)
        │
        ▼
결과 페이지 — 배수 기준 정렬, Outlier Slider 필터
        │
  개별 게시물 클릭
        ▼
POST /api/analyze → Vertex AI Gemini (streaming)
        │
        ▼
6차원 분석 결과 스트리밍 표시 + DB 캐시
```

---

## 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
# 아래 환경변수 항목 참고

# 3. 개발 서버 실행
npm run dev
```

### 필요한 환경변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Apify
APIFY_TOKEN=
APIFY_WEBHOOK_SECRET=

# Google Vertex AI
GOOGLE_APPLICATION_CREDENTIALS=  # 서비스 계정 JSON 경로
VERTEX_PROJECT_ID=
VERTEX_LOCATION=asia-northeast3

# Auth (내부 토큰)
AUTH_SECRET=
```

### Supabase 마이그레이션

```bash
# supabase/migrations/ 아래 파일을 순서대로 실행
supabase db push
```

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                   # 홈 (계정 URL 입력)
│   ├── results/[username]/        # 아웃라이어 결과 페이지
│   ├── analysis/[postId]/         # 개별 게시물 AI 분석
│   ├── collection/                # 멀티 계정 패턴 분석
│   └── api/
│       ├── analyze/               # Vertex AI 스트리밍 분석
│       ├── pattern-analyze/       # 컬렉션 패턴 분석
│       └── webhooks/apify/        # Apify 완료 웹훅
├── components/                    # UI 컴포넌트
└── lib/
    ├── apify/                     # Apify 클라이언트 + 스키마
    ├── vertex-ai/                 # Gemini 스트리밍 클라이언트
    ├── prompts/                   # LLM 프롬프트 빌더
    ├── actions/                   # Server Actions
    └── outlier.ts                 # 아웃라이어 배수 계산 로직
```

---

## 설계 결정

- **Server Components 우선** — 데이터 fetch는 서버에서. `'use client'`는 스트리밍·인터랙션 컴포넌트에만 사용
- **Webhook 기반 스크래핑** — 폴링 대신 Apify 웹훅으로 완료 감지. 타임아웃 없음
- **LLM 결과 캐시** — 같은 게시물 재분석 방지. DB에 분석 결과 저장 후 재사용
- **Zod 경계 검증** — Apify 응답, LLM 출력, URL 파라미터 모두 Zod로 검증
