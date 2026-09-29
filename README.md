# Control Simulators

설치와 로그인 없이 브라우저에서 제어를 체험하는 교육용 시뮬레이터 모음입니다.

게시 주소: https://icarlaboratory.github.io/simulators/

## 범위

- 참고 강의자료의 프로젝트를 찾아보는 검색·분류 대시보드
- 개별 실험: 크루즈 컨트롤, DC 모터 위치 제어, 볼 앤 빔, 도립진자
- 기존 Research의 로봇 궤적 추종·접촉 제어로 바로 연결
- 한국어/EN 전환; 언어를 바꿔도 실험 상태 유지
- 나머지 프로젝트는 준비 중으로 구분. 실행 링크를 제공하지 않습니다.
- 로그인, 다운로드, 과제 제출, 결과 저장 및 분석 추적 기능 없음
- 기존 연구실 사이트는 수정하지 않습니다.

## 모델과 출처

이 저장소의 실험은 원본 MATLAB/Simulink 파일을 변환하거나 실행하는 것이 아닙니다. 해당 교육 주제에서 핵심 원리를 경험하도록 독립 구현한 단순화 모델입니다. 원본과 결과가 동일하다고 보장하지 않으며, 실제 장비 설계나 안전성 판단에 사용하지 마세요.

프로젝트 카드와 실험 페이지에 원본 MathWorks 자료 링크와 모델 한계를 제공합니다. 입력 제한·미분 구현·마찰 등은 학습용 선택이며 원본 장치의 식별된 파라미터가 아닙니다.

- 크루즈 컨트롤: 질량·선형 저항·부하를 갖는 종방향 속도 모델
- DC 모터: 전기 회로를 생략한 2차 위치 응답 모델
- 볼 앤 빔: 이상화한 공의 구름 운동, 이상적인 빔 각도 구동. 빔 끝을 넘으면 중단
- 도립진자: 카트와 질점 진자의 비선형 운동, 전체 상태 피드백과 ±20 N 힘 제한. 카트 레일 ±2 m 또는 진자 기울기 ±60°에 도달하면 중단

## 로컬 실행

Node.js 22 이상과 Python 3 권장. 웹사이트 자체에는 빌드나 npm 의존성이 필요하지 않습니다.

```sh
python3 -m http.server 8765 --directory ..
# 상위 폴더 아래 simulators라는 폴더에 체크아웃한 경우:
# http://localhost:8765/simulators/
```

ES modules를 사용하므로 파일 더블클릭 대신 HTTP 서버로 여세요.

## 검증

```sh
npm ci --include=dev
npm test
npx playwright install chromium
npx playwright test tests/*.spec.js --workers=1
```

브라우저 검증은 기본적으로 위 로컬 서버를 사용합니다. 게시된 사이트 검증:

```sh
SIM_BASE=https://icarlaboratory.github.io/simulators/ npx playwright test tests/*.spec.js --workers=1
```

도립진자의 독립 수치 검증은 NumPy/SciPy가 설치된 Python 환경에서 `python3 scripts/verify-pendulum.py`로 실행합니다. 세 목표 위치와 각속도 외란을 포함한 응답을 질량행렬 기반 DOP853 해와 비교합니다.

모델 단위 검증과 브라우저 조작 검증은 별도입니다. 브라우저에서 물체가 움직인다는 것만으로 모델의 정확성을 판정하지 않습니다.

## 게시

GitHub Pages에서 `main` 브랜치의 루트(`/`)를 게시합니다. 정적 파일만 사용하며 서버·MATLAB 라이선스·API 키가 필요하지 않습니다. 새 프로젝트는 `assets/catalog.js`의 상태와 실제 구현이 일치하도록 추가합니다.
