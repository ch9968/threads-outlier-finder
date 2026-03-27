# 001. Use Vertex AI Gemini 3.1 Pro for LLM Analysis

Date: 2026-03-27
Status: Accepted

## Context
Threads 게시물의 6차원 정성 분석과 교차 패턴 분석을 위해 LLM이 필요하다.
디자인 문서에서는 Claude를 언급했지만, 사용자가 Gemini 3.1 Pro를 Vertex AI Platform을 통해 사용하길 원했다.

## Options Considered
- Option A: Claude API (Anthropic) — 분석 품질 높음, 직접 API
- Option B: Gemini AI API (Google) — 간단한 API key 인증
- Option C: Vertex AI Gemini 3.1 Pro (Google Cloud) — GCP 서비스 계정 인증, 엔터프라이즈급

## Decision
Vertex AI Gemini 3.1 Pro를 선택. `@google-cloud/vertexai` SDK를 사용한다.
GCP 서비스 계정 키를 환경변수로 주입하여 인증한다.

## Consequences
- GCP 프로젝트와 Vertex AI API 활성화가 필요하다.
- 서비스 계정 JSON 키를 Vercel 환경변수로 관리해야 한다.
- Gemini AI API 대비 설정이 복잡하지만, 사용자의 기존 GCP 인프라를 활용할 수 있다.
- 스트리밍 응답을 지원하므로 Vercel Free tier 타임아웃을 우회할 수 있다.
