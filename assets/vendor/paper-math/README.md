# 실험 수식 조판

- `STIXTwoMath.woff2`: STIX Two Math 2.14 (Copyright 2001–2021 The STIX Fonts Project Authors). [Temml에서 배포하는 WOFF2 원본](https://github.com/ronkok/Temml/blob/4ffdf0e56577c426375d0b2818f8895edb5e5030/site/assets/STIXTwoMath.woff2)을 수정 없이 사용합니다. [STIX 프로젝트](https://github.com/stipub/stixfonts) · [SIL Open Font License 1.1](STIX-OFL.txt).
- `Temml-STIX2.css`: `temml@0.14.0`의 같은 이름의 스타일시트입니다. [MIT 라이선스](Temml-LICENSE.txt). Temml JS는 정적 페이지를 만들 때만 사용하며 방문자 브라우저에 전송하지 않습니다.
- 재생성: 저장소 루트에서 `npm ci --include=dev` 후 `node scripts/vendor-paper-math.mjs`. 이 스크립트는 버전을 고정한 원본의 SHA-256을 확인하고 텍스트 줄 끝 공백만 제거합니다. 수식 원고와 시뮬레이션 모델은 이 디렉터리의 제3자 파일이 아닙니다.
