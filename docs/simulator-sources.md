# 실험별 모델 출처와 재사용 조건

[카탈로그](../assets/catalog.js)의 출처 링크는 무엇을 비교할 수 있는지 알려 준다. 아래에서는 수식이 일치하는 모델, 주제가 같은 예제, 실제 배포하는 외부 자산을 구분한다. 고정한 버전은 **대조한 버전**이지 개발 당시에 사용한 버전이라는 뜻이 아니다. 출처 표기만으로 코드·번역·도면의 재배포가 허용되지는 않는다.

## 수치 모델과 제어 예제를 구별해야 하는 실험

- `aircraft-pitch` — [MathWorks의 항공기 피치 상태공간 예제](https://www.mathworks.com/help/control/ref/dynamicsystem.compreal.html#mw_e9be8f40-d51f-4bd0-89db-cf2ea697e2cf)에서 `aircraftPitchSSModel.mat`의 두 번째 상태 `x₂`를 `q_web = 56.7 x₂`로 환산하면 `dθ/dt = q_web`이며 나머지 상태방정식과 승강타 입력 계수도 [웹 모델](../assets/models/aircraft-pitch.js)과 일치한다. [Rick Hill의 File Exchange 앱 40798](https://www.mathworks.com/matlabcentral/fileexchange/40798-aircraft-pitch-control)은 같은 플랜트에 LQR을 적용한 별도 예제다. 웹 실험의 제어기는 승강타 제한이 있는 PID다.
  - 별도로 대조한 CTMS 튜토리얼의 본문·그림에는 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)이 표시되어 있다. 번역·각색물을 배포하려면 출처와 라이선스를 밝히고 변경 사항을 표시하며 동일조건변경허락을 지킨다. 수치 모델의 일치만으로 웹 실험 전체에 이 조건을 적용하지 않는다.
  - 앱 v1.0.0의 [배포 조건](https://addons.mathworks.com/downloads/e5/e597c245-4a80-11e4-9553-005056977bd0/1.0.0/license.txt)은 © 2013 Rick Hill의 두 조건(소스에는 고지·조건·면책 유지, 바이너리는 동봉 자료에 재현)이다. `pitchgui.m`에는 © 1997 Regents of the University of Michigan 및 Rick Hill·Li Guan의 수정 표기도 있다. 앱 파일을 가져올 계획이라면 패키지와 파일 고지를 모두 확인한다. CTMS 본문의 조건을 앱 라이선스와 혼동하지 않는다.
- `cstr` — [Amir Amini의 File Exchange 예제 103695](https://www.mathworks.com/matlabcentral/fileexchange/103695-continuously-stirred-tank-reactor-cstr-pid-control) v1.0.1의 `cstr1.m`은 농도·반응 온도·냉각수 온도를 적분한다. [웹 모델](../assets/models/cstr.js)은 농도와 반응 온도만 적분하고 재킷 온도는 제한된 PI 출력으로 둔다. [APMonitor가 Henson–Seborg에 귀속한 벤치마크](https://apmonitor.com/wiki/index.php/Apps/StirredReactor)와 두 수지식의 구조, 공급 온도 350 K, E/R = 8750 K가 일치한다. 웹 모델은 100 L, 100 L/min 조건에서 `k(350 K) = 1/60 s⁻¹`로 반응 속도를 보정한다. 이는 식·수치의 비교이며 APMonitor 코드에서 유래했다는 증거가 아니다.
  - File Exchange가 가리키는 [Amini의 v1.0.1 트리](https://github.com/aminiam90/CSTR/tree/2f1367044064eb7311f896098624f8d45f755001)와 배포 압축파일에서 명시적 재사용 허락을 찾지 못했다. MATLAB 코드·GUI·그림은 별도 허락 없이 포함하지 않는다. APMonitor 링크도 벤치마크 확인용이다.

## Virtual Controls Laboratory: 여섯 장치의 비교 파일

MathWorks **Virtual Controls Laboratory v3.0.0** (`fcb48179caf2762c906ddf52484718d0e84ab5b9`)의 장치·제어 주제와 비교했다. 웹 모델과 장면은 SLX를 실행하지 않는다. 이 버전과의 코드·대표 그림 대조에서는 이식된 파일을 식별하지 못했다. 이는 모든 버전이나 제작 이력에 대한 판정이 아니다.

| 카탈로그 ID | v3.0.0 대응 모델 | 웹 실험과의 차이 |
|---|---|---|
| `cruise-control` | [CruiseControl.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/CruiseControl.slx) | 도로 프로파일 대신 일정 부하를 가하는 1차 속도 모델이다. |
| `dc-motor` | [DCMotorControl.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/DCMotorControl.slx) | 전압·기어 동역학 대신 2차 위치 방정식을 쓰고 측정 각속도로 미분 피드백을 건다. |
| `ball-and-beam` | [BallAndBeam.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/BallAndBeam.slx) | 서보 링크·접촉 모델 대신 빔 각도를 직접 입력하고 빔 끝에서 실험을 멈춘다. |
| `inverted-pendulum` | [InvertedPendulum.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/InvertedPendulum.slx) | 전압과 랙·피니언 대신 카트에 힘을 직접 가한다. |
| `rotary-pendulum` | [RotaryPendulum.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/RotaryPendulum.slx) | 스윙업 없이 직립점 근방에서 암 토크로 균형을 제어한다. |
| `ball-and-plate` | [BallAndPlate.slx](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/BallAndPlate.slx) | 축별 PD는 공통이나 서보·접촉 대신 두 기울기를 직접 지정한다. |

[VCL 배포 조건](https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/LICENSE.md)은 BSD-3-Clause(© 2023–2026 The MathWorks, Inc.)다. 이후 원본 또는 수정 파일을 배포한다면 소스에는 고지·조건·면책을 보존하고 바이너리에는 동봉 자료로 재현한다. 서면 허가 없이 저작권자·기여자 명의를 보증이나 홍보에 사용하지 않는다. CAD 등 개별 자산의 고지도 따로 확인한다.

## 장치 예제: 실제 자산과 주제 참고의 경계

- `path-tracking` — [vehicle-pure-pursuit의 고정 버전](https://github.com/mathworks/vehicle-pure-pursuit/tree/41f54ee0a9a0d143f1b9a3600aeea4817c012448)은 저장된 경유점과 차량 모델을 사용한다. 웹에서는 원형 경로와 자전거 운동학으로 pure pursuit를 설명한다. [조건 3](https://raw.githubusercontent.com/mathworks/vehicle-pure-pursuit/41f54ee0a9a0d143f1b9a3600aeea4817c012448/license.txt)은 원본·수정본·파생물을 MathWorks 제품·서비스와 함께 사용하는 경우로 제한한다. 소스·바이너리 고지를 유지하는 것만으로 독립형 브라우저 이식이 허용되지는 않는다. 모델·스크립트·지도·이미지를 옮기지 말고 필요한 경우 별도 허락을 받는다.
- `drone` — 웹의 평면 추력·롤 모델과 [Simscape 쿼드콥터](https://github.com/mathworks/Quadcopter-Drone-Model-Simscape/tree/b2513ee228f26c87c7c862275633f250c5fbb95e)의 배터리·전동기·배송 시나리오는 다르다. 이 프로젝트의 [조건 3](https://raw.githubusercontent.com/mathworks/Quadcopter-Drone-Model-Simscape/b2513ee228f26c87c7c862275633f250c5fbb95e/LICENSE.md)에도 MathWorks 제품·서비스와 함께 사용해야 한다는 제한이 있다. CAD와 애니메이션을 포함한 파일의 독립형 사용 허락으로 보지 않는다.
- `impedance-robot` — [MathWorks 임피던스 제어 예제](https://github.com/mathworks/Robotic-Arm-Impedance-Control/tree/397a9615291ab7cee6f10a6dd7186a4db769fb59)의 홈 자세를 사용하지만 브라우저가 Simulink 제어기를 실행하는 것은 아니다. [프로젝트 본체의 조건 3](https://raw.githubusercontent.com/mathworks/Robotic-Arm-Impedance-Control/397a9615291ab7cee6f10a6dd7186a4db769fb59/LICENSE.txt)과 **실제로 배포하는 Kinova Gen3 파생 형상**의 조건을 구분한다. 링크 치수·좌표계·축약 메시의 원본과 버전은 [형상 출처 고지](../assets/vendor/kinova/NOTICE.md)에 있다. 재배포 시 [Kinova 자체 조건](../assets/vendor/kinova/LICENSE.txt)에 따라 © 2018 Kinova 고지·조건·면책을 소스와 바이너리 동봉 자료에 유지하고, 사전 서면 허가 없이 사명·기여자 명의로 보증하지 않는다. 이 조건은 MathWorks 프로그램의 사용 허락이 아니다.
- `suspension` — 웹의 2질량 스카이훅 모델은 [Tanmay Panchal의 쿼터카 앱 95308](https://www.mathworks.com/matlabcentral/fileexchange/95308-quarter-car-suspension-active-control-demo-app-simulink)의 PID 앱이나 [James Allison의 애니메이션](https://www.mathworks.com/matlabcentral/fileexchange/35478-animation-of-a-quarter-car-automotive-suspension)이 아니다. v1.0.0 [패키지 조건](https://addons.mathworks.com/downloads/07/076da050-6037-405b-a7d3-845945e1126e/1.0.0/license.txt)은 © 2021 Tanmay Panchal과 © 2012 James Allison을 **모두** 명시한다. 코드·애니메이션을 재사용한다면 양쪽 고지·조건·면책을 소스에 유지하고 바이너리 동봉 자료에 재현한다. Kettering University와 University of Illinois at Urbana-Champaign 및 각 기여자에 대한 별도 비보증 조항을 단일 저자용 양식으로 대체하지 않는다.

다음 MathWorks Help 링크는 주제 비교용이다. 검토한 문서에서 예제의 코드·데이터·그림·번역을 독립 배포할 수 있는 별도 허락은 확인하지 못했다. 문서나 예제 파일을 가져오는 대신 링크한다.

| ID | MathWorks 예제 | 웹 실험 |
|---|---|---|
| `robot-arm` | [6관절 로봇 암의 다중 루프 PI 튜닝](https://www.mathworks.com/help/control/ug/multi-loop-pid-control-of-a-robot-arm.html) | 평면 2관절 PID와 중력 보상. Gen3 형상은 사용하지 않는다. |
| `parking` | [지도 기반 자동 발레 주차 계획](https://www.mathworks.com/help/driving/ug/automated-parking-valet-in-simulink.html) | 자체 경로에서 전진 정렬 후 후진 주차. 예제의 지도·경유점이 아니다. |
| `heat-exchanger` | [밸브 측정 데이터로 열응답 식별](https://www.mathworks.com/help/control/ug/temperature-control-in-a-heat-exchanger.html) | 혼합 용적의 에너지 수지와 PI 열입력. 예제 측정 데이터가 아니다. |
| `rocket-landing` | [다단 비선형 MPC 착륙](https://www.mathworks.com/help/mpc/ug/landing-rocket-with-mpc-example.html) | 두 추력기의 평면 착륙을 다루지만 MPC를 실행하지 않는다. [별도 비교 자료와 범위](rocket-landing-sources.md) 참조. |

## 그래프 실험과 외부 연결

아래 다섯 링크는 **제어 개념의 참고 문헌**이다. 응답 곡선은 웹의 공통 2차 LTI 플랜트로 계산한다. 논문 DOI나 튜토리얼을 인용했다고 해서 코드·그림·본문을 복제하거나 번역해 배포할 수 있는 것은 아니다.

| ID | 개념 자료 |
|---|---|
| `pid-lti` | [MathWorks, PID Controller Design at the Command Line](https://www.mathworks.com/help/control/ug/pid-controller-design-at-the-command-line.html) — PI·PID 설계 및 폐루프 계단응답 예제. |
| `mpc-lti` | [MathWorks, What Is Model Predictive Control?](https://www.mathworks.com/help/mpc/gs/what-is-mpc.html) — 예측·제약 개념. Toolbox 구현을 사용하는 것은 아니다. |
| `deepc-lti` | [Coulson, Lygeros & Dörfler (2019)](https://doi.org/10.23919/ECC.2019.8795639) — 측정 데이터에 의한 예측 제어. |
| `smc-lti` | [Utkin (1977)](https://doi.org/10.1109/TAC.1977.1101446) — 슬라이딩 모드 제어. |
| `tdc-lti` | [Youcef-Toumi & Ito (1990)](https://doi.org/10.1115/1.2894130) — 시간 지연을 이용한 동역학 추정. |

`research-tracking`과 `research-contact`는 각각 Research의 [궤적 추종](https://icarlaboratory.github.io/research.html?sim=track&lang=ko#interactive)·[접촉 제어](https://icarlaboratory.github.io/research.html?sim=contact&lang=ko#interactive)로 연결하는 카드다. 이 저장소에 두 모델의 구현이 있는 것은 아니다. 카드 이미지의 캡처 경로·언어·해시는 [미리보기 매니페스트](../assets/previews/manifest.json)에서 확인한다.
