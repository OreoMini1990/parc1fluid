# parc1fluid — 병원 오더 파싱 · 인센티브 · 재고

## 배포 구조

| 환경 | 저장소 |
|------|--------|
| **`web/` (Next.js → Vercel)** | **Google Sheets** |
| **루트 Streamlit (로컬)** | SQLite (`data/orders.db`) — Sheets 연동은 웹(Vercel) 기준 |

별도 DB(Supabase 등) 없이 **구글 스프레드시트**가 원장·정산·재고의 단일 저장소입니다. 시트를 열면 언제든 엑셀처럼 확인·수정할 수 있습니다.

## 1. Google Sheets 준비

1. Google Drive에서 **새 스프레드시트** 생성 (이름 예: `병원오더`)
2. URL에서 ID 복사: `https://docs.google.com/spreadsheets/d/` **`여기가_GOOGLE_SHEETS_ID`** `/edit`
3. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
4. **API 및 서비스 → 라이브러리** → **Google Sheets API** 사용 설정
5. **API 및 서비스 → 사용자 인증 정보** → **서비스 계정** 생성 → JSON 키 다운로드
6. JSON에서 `client_email`, `private_key` 확인
7. 스프레드시트 **공유** → 서비스 계정 이메일(`...@....iam.gserviceaccount.com`)을 **편집자**로 추가

앱이 처음 저장할 때 아래 탭이 **자동 생성**됩니다.

| 탭 이름 | 용도 |
|---------|------|
| `batches` | 저장 배치 메타 |
| `fluid_usage` | 수액·앰플 사용 |
| `injection_records` | 주사·인센티브 |
| `safety_stock` | 안전 재고 기준 |

## 2. Vercel 환경 변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_SHEETS_ID` | 스프레드시트 ID |
| `GOOGLE_CLIENT_EMAIL` | 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | JSON의 `private_key` (줄바꿈은 `\n`으로 한 줄에 넣어도 됨) |
| `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` | LLM 파싱 |

Vercel 프로젝트 **Root Directory: `web`**

## 3. GitHub

```powershell
cd d:\parc1fluid
gh auth login
gh repo create parc1fluid --public --source=. --remote=origin --push
```

## 4. 로컬 (Next.js)

```powershell
cd d:\parc1fluid\web
copy .env.example .env.local
npm install
npm run dev
```

## 5. 로컬 (Streamlit, 선택)

```powershell
cd d:\parc1fluid
copy .env.example .env
pip install -r requirements.txt
streamlit run app.py
```

Streamlit은 로컬 SQLite용입니다. **Sheets와 동기화하려면 Vercel 웹앱을 사용**하세요.
