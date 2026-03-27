# 003. Use Password Middleware Instead of Supabase Auth

Date: 2026-03-27
Status: Accepted

## Context
Santiago는 1인 사용 도구지만, Vercel에 배포하면 URL이 공개된다.
누구나 접속해서 Apify 크레딧이나 Vertex AI API 비용을 소모할 수 있다.
인증이 필요하지만, Supabase Auth(이메일/비밀번호 가입, 세션 관리, RLS)는 과도하다.

## Options Considered
- Option A: 환경변수 비밀번호 미들웨어 — SITE_PASSWORD 쿠키로 전체 사이트 보호
- Option B: Supabase Auth — 이메일/비밀번호 로그인 + RLS 정책
- Option C: 인증 없이 배포 — URL 비공개로 보안

## Decision
Option A: 환경변수 비밀번호 미들웨어를 선택한다.

- Next.js middleware.ts에서 모든 요청에 SITE_PASSWORD 쿠키 확인
- 없으면 /login으로 리다이렉트
- /login에서 비밀번호 입력 → 맞으면 httpOnly 쿠키 설정
- /api/webhooks/apify는 미들웨어에서 제외 (webhook secret으로 별도 검증)

## Consequences
- RLS 불필요. DB 접근은 서버 사이드에서만 발생하므로 anon key로 충분.
- 구현 매우 단순 (~30 LOC).
- 비밀번호 변경 시 Vercel 환경변수만 수정.
- 보안 수준: URL 추측 공격에 대한 보호. 브루트포스는 rate limiting으로 대응 가능하나 V1에서는 생략.
