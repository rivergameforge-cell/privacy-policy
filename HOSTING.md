# V8REDLINE 사이트 배포

- 소스: https://github.com/rivergameforge-cell/privacy-policy
- 호스팅 작업 계정: `v8redline.studio@gmail.com`
- Firebase 프로젝트: `unlimitbossrun-dist`, 기존 Spark 무료 요금제
- Hosting 사이트: `v8redline-studio`
- 홈: https://v8redline-studio.web.app/
- 분석: https://v8redline-studio.web.app/admin/
- 개인정보: https://v8redline-studio.web.app/unlimit-boss-run-privacy.html
- 약관: https://v8redline-studio.web.app/unlimit-boss-run-terms.html
- 삭제 안내: https://v8redline-studio.web.app/unlimit-boss-run-deletion.html

기존 공개 문서 내용과 초안 표시는 유지합니다. `/privacy-policy/`가 붙은 기존 경로도 새 사이트 내에서 해당 문서로 연결됩니다. 루트는 V8REDLINE 소개로 연결되며 기존 기본 개인정보 문서는 `/index.html`과 `/privacy-policy.html`에 보존합니다. 루트 app-ads.txt는 기존 공개 원본의 두 게시자 행을 보존합니다.

## 로컬 배포

먼저 작업 계정, 대상과 Spark 요금제를 확인합니다. 출력 디렉터리가 없는 소스에서:

```sh
python3 scripts/prepare_hosting.py
firebase deploy --only hosting --project unlimitbossrun-dist --account v8redline.studio@gmail.com
```

배포는 로컬 CLI에서 수행합니다. GitHub Actions, Cloud Build, Functions, App Hosting, 결제 계정 또는 유료 요금제를 사용하지 않습니다. `.hosting-public`에 공개용 HTML/JS/CSS와 확률표·app-ads.txt만 허용 목록으로 복사합니다. Git 메타데이터, 문서, 로컬 자격 증명과 배포 로그는 배포하지 않습니다.

Spark 무료 한도는 저장 10 GB, 전송 360 MB/일입니다. 한도 초과 시 서비스가 제한될 수 있으며 유료 전환은 하지 않습니다. 공식 요금표: https://firebase.google.com/pricing

## 이전 후 확인 범위

Google Analytics OAuth 클라이언트 설정과 V8REDLINE 실데이터 로그인을 검증했습니다. 로그인 전용 Cloud 프로젝트는 `v8redline-analytics-web`이며 허용 출처는 `https://v8redline-studio.web.app`입니다. 외부 테스트 사용자에는 V8REDLINE 계정만 등록했고 권한은 analytics.readonly입니다. 분석 권한은 Google Analytics가 검증하고 토큰은 메모리에만 둡니다.

기존 GitHub Pages 주소는 앱·스토어에 남아 있는 링크를 위해 유지합니다. 이번 변경을 배포하는 소스 브랜치에는 Pages 빌드를 실행하지 않습니다. 기존 호스팅 종료와 게임·스토어의 모든 URL 교체는 별도 전환 작업입니다.
