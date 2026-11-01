# 또 보스냐! 플레이 리포트

Google Analytics 4 Data API를 브라우저에서 직접 읽는 정적 대시보드입니다. HTML·CSS·JavaScript만 사용하고 실행 서버나 별도의 분석 데이터 저장소가 없습니다.

## 현재 상태

2026-11-01 V8REDLINE 계정으로 Google OAuth 로그인과 실제 Analytics 조회를 검증했습니다. 배포 주소는 https://v8redline-studio.web.app/admin/ 이며 기본 클라이언트 ID와 속성 ID가 코드에 설정돼 있어 수동 입력 없이 Google로 연결할 수 있습니다. 전체 국가·최근 28일에서 활성/신규 사용자 각 3명을 조회했고, 재방문을 포함한 보고서 10개가 오류 없이 완료됐습니다. 테스트 이용이 포함될 수 있으며 실제 배포 게임 전체 검증을 의미하지 않습니다.

OAuth 프로젝트는 V8REDLINE 계정이 생성한 `v8redline-analytics-web`입니다. 기존 게임 프로젝트는 API/OAuth 설정 권한이 부족해 호스팅과 로그인 프로젝트를 분리했습니다. 기존 Analytics 속성 `561781670`과 게임 Firebase 연결은 유지했습니다. Data API를 활성화하고 외부 테스트 모드에 `v8redline.studio@gmail.com`만 등록했습니다. 최초 연결 시 Google의 테스트 앱 안내가 표시될 수 있습니다. 권한은 `analytics.readonly`입니다.

## 로컬 실행

```sh
cd analytics-dashboard
python3 -m http.server 8765 --bind 127.0.0.1
```

저장소에 `admin/` 경로로 배포한 뒤에는 위 `cd analytics-dashboard` 대신 `cd admin`를 사용합니다. 브라우저에서 `http://127.0.0.1:8765/`를 엽니다. 로그인 전에는 실제 값이나 예시 값을 표시하지 않습니다.

## 연결 구성

1. 로그인 프로젝트 `v8redline-analytics-web`에서 **Google Analytics Data API**가 활성화돼 있습니다.
2. Google Auth 플랫폼의 OAuth 동의 화면과 웹 애플리케이션 클라이언트가 필요합니다. 허용된 JavaScript 출처에 Firebase Hosting의 **origin** (`https://v8redline-studio.web.app`, 경로 제외)을 등록합니다. 로컬 검증에는 `http://127.0.0.1:8765`도 별도로 등록합니다.
3. 페이지의 ⚙ 버튼에서 OAuth 클라이언트 ID와 Analytics 속성 ID를 입력한 뒤 Google로 연결합니다. 계정에는 해당 Analytics 속성의 읽기 권한이 필요합니다. 테스트 상태의 OAuth 앱은 허용된 테스트 사용자만 접근할 수 있습니다.
4. 필요한 권한은 `https://www.googleapis.com/auth/analytics.readonly`뿐입니다. 권한 동의 화면에서 앱과 범위를 확인해야 합니다. 프로젝트·OAuth 화면 생성이나 권한 부여에 추가 동의 또는 서비스 약관이 나오면 사용자 승인 후 진행해야 합니다.

다른 계정이나 배포 출처를 추가하려면 OAuth 테스트 사용자와 허용 출처, Analytics 권한을 별도로 확인해야 합니다. 클라이언트 ID는 비밀키가 아니지만 **클라이언트 보안 비밀번호, 서비스 계정 키, 액세스 토큰, 게임 통계 원문은 저장소나 웹페이지에 넣지 않습니다.** 토큰은 브라우저 메모리에서만 사용하고 연결 끊기나 새로고침 후 제거합니다.

Google 권고는 서버 기반 인증 코드 방식이지만, 이 페이지는 정적 호스팅이라는 요구에 맞춰 Google Identity Services의 브라우저 토큰 방식을 사용합니다. 페이지 코드를 호스팅하는 저장소의 쓰기 권한을 신뢰할 수 있는 사람에게만 부여해야 합니다. [Google 인증 방식](https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model)

## 로그인 전 화면과 데이터 보호

로그인 전에는 분석 항목을 숨기고 로그인 안내만 보여 줍니다. Google에서 액세스 토큰을 발급하더라도 속성 요약 조회가 성공해야 화면이 열리고, 권한 오류·연결 해제·토큰 만료 시 다시 숨깁니다. 토큰은 메모리에만 보관합니다. 정적 사이트의 HTML·JavaScript 소스와 UI 이름은 누구나 볼 수 있으므로 화면 숨김은 보안 경계가 아닙니다. 실제 데이터 접근은 Google Analytics 속성의 읽기 권한으로 제한됩니다.

## 지표 해석

- 날짜 및 국가 필터는 활성 사용자, 보스 결과, 광고, 퍼널과 행동 분석에 적용합니다. **코호트 재방문은 전체 국가 기준**이며 첫 방문 시점은 35일 전부터 8일 전까지입니다.
- 퍼널은 신규 사용자의 첫 실행 → 게임 진입 → 튜토리얼 시작 → 보스 도전 → 보스 처치를 순서대로 계산합니다. 튜토리얼을 건너뛰면 뒤 단계에 포함되지 않을 수 있고 보스 종류·지역을 특정하지 않습니다. Google의 v1alpha 퍼널 API는 변경될 수 있습니다.
- 보스 승률은 저장된 `boss_result`의 승리/전체 결과이며, 미완료 전투는 포함하지 않습니다. 광고 획득 콜백과 게임 저장 성공은 다릅니다. 데이터 처리 지연, 비활성화된 분석 설정, GA 임계값, 표본 추출, 등록된 측정기준 상태에 따라 일부 항목이 지연되거나 비어 있을 수 있습니다.
- 각 섹션 실패는 따로 표시합니다. 실제 Analytics 접근 및 데이터 집계와의 비교 검증은 OAuth 설정 후 필요합니다.

## 호스팅과 소스

소스 저장소는 `rivergameforge-cell/privacy-policy`이며 배포는 `v8redline.studio@gmail.com`이 관리하는 Firebase 프로젝트 `unlimitbossrun-dist`의 `v8redline-studio` Hosting 사이트를 사용합니다. Spark 요금제이며 결제 계정 연결이나 Blaze 업그레이드 없이 정적 파일만 배포합니다. 루트의 `HOSTING.md`를 따릅니다.

## 실제 API 검사에서 수정한 오류

재방문 Cohort API에 상대 날짜 `35daysAgo`/`8daysAgo`를 전달하면 `Error, the cohort start date format is not correct!`로 거절됐습니다. 요약 응답의 속성 시간대를 기준으로 YYYY-MM-DD를 계산해 전달하도록 수정했고, 실제 API에서 정상 응답을 재검증했습니다. 최초 방문 기록이 쌓이지 않은 과거 코호트는 데이터 없음으로 표시합니다.
