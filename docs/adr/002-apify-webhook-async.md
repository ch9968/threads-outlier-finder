# 002. Use Apify Webhook for Async Scraping

Date: 2026-03-27
Status: Accepted

## Context
Apify 스크래핑은 수십 초~수 분이 걸린다. Vercel Free tier의 Serverless Function 타임아웃은 10초다.
동기 처리가 불가능하므로 비동기 패턴이 필요하다.

## Options Considered
- Option A: Apify Webhook + Supabase Realtime — Apify 완료 시 Next.js API Route 호출, 클라이언트는 Realtime 구독
- Option B: 별도 백엔드 서버 (FastAPI on Heroku/Railway) — 장시간 작업을 서버에서 직접 처리
- Option C: Vercel Pro 300초 타임아웃 — 동기 처리로 단순화

## Decision
Option A: Apify Webhook + Supabase Realtime을 선택한다.

흐름:
1. Server Action → Apify "run 시작" (< 1초) → DB에 job 저장
2. Apify 완료 → webhook POST → /api/webhooks/apify → 결과 DB 저장
3. Client → Supabase Realtime 구독 → status 변경 즉시 감지

## Consequences
- 추가 인프라 0개. Next.js + Supabase만으로 해결.
- 비용 $0 (Vercel Free + Supabase Free).
- Webhook secret 검증이 필수 (보안).
- Apify가 webhook 전달에 실패할 수 있으므로, 폴백으로 수동 상태 확인 버튼도 필요.
- Supabase Realtime은 폴링 대비 UX 향상 (즉시 반영).
