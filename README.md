# parc1fluid — 병원 오더 파싱 · 인센티브 · 재고

## 배포 구조

| 환경 | 용도 |
|------|------|
| **`web/` (Next.js)** | **GitHub → Vercel** 프로덕션 (Root Directory: `web`) |
| **루트 Streamlit** | 로컬 PC 전용 (`streamlit run app.py`) — Vercel에서는 실행 불가 |

Vercel은 SQLite/Streamlit 장기 프로세스를 지원하지 않습니다. 클라우드 DB는 **Supabase**를 사용합니다.

## 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql) 실행
3. Settings → API에서 URL과 **service_role** 키 복사 (서버 API 전용, 클라이언트에 노출 금지)

## 2. GitHub

```powershell
cd d:\parc1fluid
git init -b main
git add -A
git commit -m "Initial commit: Streamlit local + Next.js for Vercel"
gh auth login
gh repo create parc1fluid --public --source=. --remote=origin --push
```

저장소 이름은 원하는 대로 바꿔도 됩니다.

## 3. Vercel

1. [vercel.com](https://vercel.com) → Import Git Repository → 방금 푸시한 repo
2. **Root Directory:** `web`
3. Framework Preset: Next.js (자동)
4. Environment Variables:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY`
   - (선택) `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `LLM_PROVIDER`

5. Deploy

## 4. 로컬 (Next.js)

```powershell
cd d:\parc1fluid\web
copy .env.example .env.local
# .env.local 값 입력
npm install
npm run dev
```

## 5. 로컬 (Streamlit + SQLite)

```powershell
cd d:\parc1fluid
copy .env.example .env
pip install -r requirements.txt
streamlit run app.py
```
