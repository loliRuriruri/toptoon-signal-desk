# TOPTOON Signal Desk

한국, 일본, 글로벌, 대만 TOPTOON 캐릭터챗 공개 스냅샷, 원본 트래커 통계, 탑코미디어 공시·주가 증거를 한 화면에서 교차검증하는 무의존성 정적 앱입니다.

- 공개 사이트: <https://toptoon-signal-desk.pages.dev/>
- 로컬 기본 주소: <http://127.0.0.1:8788/>
- 상세 설계와 데이터 흐름: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 핵심 원칙

- 공개 캐릭터 지표, 공식 공시, 증권 시세, 추정 모델을 서로 다른 증거층으로 표시합니다.
- API 키는 `.env.local`과 로컬 서버 안에서만 사용하며 브라우저 데이터나 공개 빌드에 포함하지 않습니다.
- 공개 사이트는 마지막으로 검증·배포된 정적 스냅샷을 읽으므로 로컬 PC가 꺼져도 계속 열립니다.
- 조회수·채팅수와 가정 환산액은 실제 결제액 또는 공시 매출이 아닙니다.

## 구성

- `index.html` - 사업 요약/공시·주가 검증/캐릭터/API 설정 화면, 검증 우선순위와 OpenRouter 보조검토 위치, 4개 시장 탭
- `styles.css` - 캐릭터 이미지 TOP6, 시작값→현재값 비교, 기간별 증감 행을 포함한 반응형 대시보드
- `app.js` - 통계·검증·캐릭터 화면, 검색·정렬, 공식 안전 모션 dialog, KIS 동종기업 비교
- `data/characters.json` - 4개 시장의 2026-08-24 공개 캐릭터 스냅샷
- `data/characters.js` - 동일 데이터에서 런타임 필드만 추린 브라우저 번들
- `data/stats.json`, `data/stats.js` - 원본 Worker 공개 통계 API의 로컬 스냅샷
- `data/validation.json`, `data/validation.js` - 원본 API·모델 계산·공시를 대조한 검증 스냅샷
- `data/investor-evidence.json` - 공시·시장조치·종가의 출처와 기준 시각
- `data/official-signals.json`, `data/official-signals.js` - 새 키로 갱신한 OpenDART·한국투자·FRED의 비밀정보 제거 결과
- `assets/kr`, `assets/jp`, `assets/global`, `assets/tw` - 원본 비율을 보존한 로컬 캐릭터 이미지
- `public-worker.js` - 허용된 공식 TOPTOON `video-thumbnail` MP4만 스트리밍하는 공개판 미디어 중계

## 실행

가장 쉬운 방법은 프로젝트 루트의 `TOPTOON-Tracker.cmd`를 더블클릭하는 것입니다. 로컬 서버를 숨김 창으로 시작하고 기본 브라우저를 자동으로 엽니다.

PowerShell에서는 다음처럼 실행할 수 있습니다.

```powershell
.\scripts\launch.ps1 -Port 8788
```

공개 데이터를 다시 수집·교차검증하고 설정된 공식 API까지 갱신한 뒤 열려면 `-Refresh`를 추가합니다. 기본 주소는 `http://127.0.0.1:8788/`입니다.

```powershell
.\scripts\launch.ps1 -Port 8788 -Refresh
```

### 로컬판에서만 가능한 기능

- `.env.local`의 API 설정 여부 확인 및 키 교체
- OpenDART·한국투자증권·FRED 공식 데이터 갱신
- OpenRouter를 이용한 현재 스냅샷 보조 분석
- `지금 갱신·검증·배포` 버튼을 통한 수동 운영 배포
- Windows 예약 작업을 이용한 주기적 자동 갱신

로컬 서버는 `127.0.0.1`에만 바인딩됩니다. 설정·분석·배포 API는 로컬 요청만 허용하고 `.env.local`, 실행 로그, 빌드 내부 파일은 정적 파일로 제공하지 않습니다.

## Cloudflare 공개판

공개 주소는 <https://toptoon-signal-desk.pages.dev/>입니다. 공개판은 읽기 전용으로 동작하며 `API 설정`, OpenRouter 실행 기능, 로컬 서버 API 호출을 노출하지 않습니다. `.env.local`과 API 키는 공개 빌드에 포함되지 않습니다.

공개 빌드를 다시 만들고 운영 브랜치에 배포하려면 다음 명령을 실행합니다.

```powershell
node scripts\build-public.mjs
npx.cmd wrangler pages deploy dist-public --project-name toptoon-signal-desk --branch main
```

배포 대상은 `dist-public`의 허용 목록 파일과 중복 제거된 캐릭터 이미지만으로 구성됩니다. Cloudflare Pages 보안 헤더와 공식 모션 미리보기용 제한형 미디어 중계 Worker도 빌드 과정에서 함께 생성됩니다.

### 공개판 동작 방식

1. 로컬 수집기가 4개 TOPTOON 공개 API와 공식 금융 API를 조회합니다.
2. 수집 결과를 브라우저용 `data/*.js`와 감사용 `data/*.json`으로 저장합니다.
3. 교차검증이 캐릭터 수·ID·이미지·계산식·공시 증거를 검사합니다.
4. `build-public.mjs`가 공개 허용 파일만 `dist-public`에 복사하고 비밀정보 패턴을 검사합니다.
5. Wrangler가 결과를 Cloudflare Pages에 배포합니다.
6. 방문자는 Cloudflare에 저장된 마지막 정상 스냅샷을 읽습니다. 방문 시 사용자의 브라우저가 증권사 API나 로컬 PC에 접속하지 않습니다.

Cloudflare의 `public-worker.js`는 캐릭터 상세 화면에서 사용하는 공식 TOPTOON 영상 URL만 허용 목록 규칙으로 중계합니다. 임의 URL, API 키 저장, 금융 API 호출은 수행하지 않습니다.

### 로컬 API 기반 자동 갱신

프로젝트 루트의 `자동업데이트-설치.cmd`를 실행하면 현재 Windows 사용자 작업으로 등록됩니다. 로그인 직후와 1시간마다 로컬 API 키로 수집·교차검증하고, 검증과 비밀정보 검사를 모두 통과한 경우에만 Cloudflare Pages 운영판을 갱신합니다. PC가 꺼져 있는 동안에는 수집하지 않지만 공개 사이트는 계속 작동하며, 다음 로그인 또는 예약 시각에 갱신을 재개합니다.

예약 시각을 기다리지 않고 바로 반영하려면 로컬 실행기의 `API 설정` 화면에서 `지금 갱신·검증·배포`를 누릅니다. 데이터 수집 → 교차검증 → 공개 빌드 및 비밀정보 검사 → Cloudflare 배포를 한 번에 실행하며, 진행 중에는 중복 실행을 막고 완료·실패 상태를 화면에 표시합니다. 이 버튼과 실행 API는 `127.0.0.1` 로컬 서버에서만 제공되며 공개판에는 나타나지 않습니다.

직접 실행하거나 주기를 변경하려면 다음 명령을 사용합니다.

```powershell
.\scripts\update-and-deploy.ps1
.\scripts\install-auto-update-task.ps1 -IntervalHours 12 -RunNow
```

실행 로그는 `.runtime\auto-update`에 저장됩니다. 자동화를 제거하려면 `.\scripts\uninstall-auto-update-task.ps1`을 실행합니다.

### GitHub Actions 기반 무인 갱신·Nemotron 진단

`.github/workflows/scheduled-refresh.yml`은 GitHub의 Ubuntu 실행기에서 매시 7분·37분에 동작하므로 로컬 PC가 꺼져 있어도 실행됩니다. 정각 혼잡을 피하기 위해 `0분·30분` 대신 이 시간대를 사용합니다. 데이터 수집과 검증은 매 실행마다 수행하고, LLM 진단은 기본 2시간 간격으로 제한합니다. OpenRouter가 실패하거나 무료 호출 한도에 걸려도 기존 데이터 수집·검증·커밋은 계속됩니다.

GitHub 저장소에서 `Settings` → `Secrets and variables` → `Actions`로 이동합니다.

`Secrets` 탭에는 다음 민감정보를 각각 `New repository secret`으로 등록합니다.

```text
KIS_APP_KEY
KIS_APP_SECRET
OPENDART_API_KEY
OPENROUTER_API_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

`CLOUDFLARE_API_TOKEN`은 Cloudflare의 `Account API tokens`에서 Custom Token으로 만들고 `Account → Cloudflare Pages → Edit` 권한을 부여합니다. `CLOUDFLARE_ACCOUNT_ID`는 Cloudflare 대시보드 계정 개요에서 확인합니다. 두 값은 공개 가능한 `Variables`가 아니라 반드시 암호화되는 `Secrets`에 등록합니다. 둘 중 하나라도 없으면 데이터 수집·검증·GitHub 커밋은 정상 진행되고 Pages 배포 단계만 경고와 함께 건너뜁니다.

`Variables` 탭에는 공개 가능한 설정값을 등록합니다.

```text
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
AI_DIAGNOSIS_MIN_HOURS=2
KIS_REFRESH_MIN_HOURS=20
```

GitHub Actions 실행기는 매번 새 환경에서 시작하므로 로컬 `.cache`의 KIS 접근 토큰을 다음 실행에서 재사용할 수 없습니다. 대신 마지막 정상 KIS 공개 스냅샷이 `KIS_REFRESH_MIN_HOURS`보다 새로우면 시세 결과를 재사용하고 토큰 발급 API를 호출하지 않습니다. 기본값 `20`은 카탈로그 수집·Pages 배포는 15분 간격으로 유지하면서 KIS 토큰 발급 알림은 하루 한 번 수준으로 제한합니다.

선택적으로 `KIS_STOCK_CODE=134580`을 Secret으로 등록할 수 있지만 종목코드는 민감정보가 아니므로 워크플로 기본값을 그대로 사용해도 됩니다. Secret 값은 GitHub에서 다시 열람할 수 없으며, 수정하려면 같은 이름의 Secret을 `Update`하여 새 값으로 교체합니다.

등록 후 저장소의 `Actions` → `Scheduled Data Refresh & Auto Deploy` → `Run workflow`를 눌러 수동 실행합니다. 다음 단계를 확인합니다.

1. `Refresh KIS & OpenDART Official Signals`가 성공해야 합니다.
2. `Generate Scheduled Nemotron Diagnosis`가 성공하거나, 키 미등록 시 명시적으로 skip되어야 합니다.
3. `Validate Integrity & Syntaxes`가 통과해야 합니다.
4. `Commit & Push Changes to Repository`가 `chore(auto): scheduled data refresh snapshot` 커밋을 생성하거나 변경 없음으로 끝나야 합니다.
5. `Deploy Public Distribution to Cloudflare Pages`가 성공하고 `toptoon-signal-desk.pages.dev` 운영판이 같은 스냅샷 시각을 표시해야 합니다.

LLM에는 공개 공시, 공개 카탈로그, 검증 결과, 가정이 명시된 매출 시나리오만 전송합니다. API 키, `.env.local`, 캐릭터 이미지, 개인정보는 전송하지 않습니다. 결과는 `data/ai-diagnosis.json`과 브라우저용 `data/ai-diagnosis.js`에 저장되며 공개 사이트에는 보조 진단임을 명시해 표시합니다.

## 공식 API 키

대시보드는 `/api/integrations/status`에서 설정 여부만 읽습니다. 키 원문은 브라우저로 전송하지 않습니다.

1. 대화나 공개 저장소에 노출한 키는 먼저 폐기·재발급합니다.
2. `.env.example`을 `.env.local`로 복사합니다.
3. 새 키만 `.env.local`에 입력하고 실행기를 다시 시작합니다.

`.env.local`과 실행 로그 디렉터리는 Git 제외 대상이며 정적 서버에서도 403으로 차단됩니다. OpenDART와 한국투자증권 연결 변수는 공식 API 규격을 기준으로 이름을 정리했습니다.

앱의 `API 설정` 탭에서도 각 공급자 키를 입력·교체·제거할 수 있습니다. 저장된 값은 다시 읽어 브라우저에 채우지 않습니다. OpenRouter는 `현재 스냅샷 분석` 버튼을 눌렀을 때만 호출되며, 키와 캐릭터 이미지는 전송하지 않습니다.

## 캐릭터 기여도 정의

`캐릭터 기여도`는 실제 매출 기여도가 아니라 `캐릭터별 누적 공개 채팅수 ÷ 전체 누적 공개 채팅수`입니다. 차트의 원화 환산액은 `누적 chats × 세션당 2,354원`이라는 원본 Worker 가정을 적용한 모델 값입니다. 무료 이용, 반복 대화, 실제 유료 세션, 할인·환불, 국가별 단가를 확인할 수 없으므로 “해당 캐릭터가 벌어온 금액”으로 해석하면 안 됩니다.

## 검증

```powershell
node scripts/validate.mjs
```

검증은 데이터 개수, 이미지 참조, 검증 상태, 공시 증거, 필수 DOM/source marker, JavaScript 문법을 확인합니다.

브라우저 회귀 검사는 Chrome 채널을 사용하는 Playwright 설정과 `tests/ui-smoke.spec.js`에 있습니다. 사업 요약의 TOP6·관측 변화→상단 공시/주가 핵심 근거→OpenRouter→하단 자동검증→캐릭터 상세→설정 연결 상태 흐름과 모바일 가로 넘침을 확인합니다.

## 공개 데이터 갱신

4개 시장과 원본 Worker 통계를 한 번에 갱신한 뒤 라이브 원본과 다시 대조합니다.

```powershell
node scripts\refresh-public-snapshot.mjs
node scripts\crosscheck.mjs --live --write
node scripts\validate.mjs
```

공식 금융 신호만 별도로 확인하려면 다음 명령을 사용합니다.

```powershell
node scripts\refresh-official-signals.mjs
node scripts\inspect-kis-quote.mjs 134580
```

기본 추적 종목은 탑코미디어 `134580`입니다. KIS 응답의 전일종가·현재가·등락부호·시가·고가·저가를 함께 저장하며, 종목코드가 바뀐 경우 이전 종목의 캐시를 재사용하지 않습니다.

## 처음부터 복원하기

```powershell
git clone <repository-url>
cd toptoon-signal-desk
Copy-Item .env.example .env.local
notepad .env.local
.\scripts\launch.ps1 -Port 8788 -Refresh
```

API 키와 Cloudflare 인증은 GitHub에 저장되지 않으므로 새 PC에서 다시 설정해야 합니다. Cloudflare 운영 배포에는 해당 계정으로 Wrangler 로그인이 필요합니다.

## Git에 포함하지 않는 항목

- `.env.local` 및 모든 실제 API 키 파일
- `.runtime`, 실행 로그, 예약 작업 상태
- `dist-public`, Wrangler/Playwright 로컬 캐시와 테스트 산출물

캐릭터 이미지는 공개 페이지에서 수집한 연구용 스냅샷입니다. 원저작권과 서비스 이용조건은 각 권리자에게 있으며 별도의 재배포 라이선스를 부여하지 않습니다.

## 데이터 주의

조회수와 채팅 수는 실시간 값이 아니라 수집 시각 기준 공개 페이지 스냅샷입니다. 현재 329개 지역 레코드, 104개 고유 캐릭터 ID가 포함됩니다. 글로벌과 대만 데이터에는 작품명이 비어 있는 레코드가 각각 1개 있어 앱에서는 `작품 정보 없음`으로 표시합니다. 작품명은 첫 번째 정렬 해시태그에서 추론한 후보값입니다.

사업 요약 화면의 매출 추정·순이익·최대 소비 가정은 원본 Worker의 모델 기반 추정치입니다. 공시 재무 수치가 아니며, IR 벤치마크와 마진은 회사 주장 비교값이라는 원본의 주의 문구를 유지합니다. `공시·주가 검증` 화면은 공시(A), 직접 관측(B), 제3자 모델·2차 시세(C)를 분리하고 AI챗 별도 매출·유료 이용자·국가별 ASP가 확인되지 않았다는 차단 경계를 유지합니다.
