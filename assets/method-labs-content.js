// Per-lab vocabulary and teaching notes. Paired strings are Korean, English.
const disturbance={key:'disturbance',label:['4초부터의 가속도 외란 d','Acceleration disturbance after 4 s'],range:[0,2,.1,.8]};
export const labs={
 'deepc-lti':{
  intro:['같은 시스템에 서로 다른 입력을 가해 기록한 데이터로 다음 입력을 결정합니다. 입력을 한 값으로 고정하면 무엇을 예측할 수 없게 될까요?','Use recorded inputs and outputs to choose the next control move. What information is lost if the recording input never changes?'],
  settings:[{key:'excitation',label:['데이터 수집 입력','Input used to collect data'],choices:[[1,'변화하는 입력','Varying input'],[0,'상수 입력','Constant input']]},{key:'horizon',label:['예측 구간 N (샘플)','Prediction horizon N (samples)'],range:[4,14,1,10]},{key:'weight',label:['평형 입력 이탈 가중치 λ','Steady-input deviation penalty λ'],range:[.05,1,.05,.2]}],
  response:['데이터로 제어한 계단응답','Data-driven step response'],diag:['학습에 사용한 입출력 기록','Recorded inputs and outputs'],
  diagnosticNote:['각 시각의 입력과 측정 출력을 함께 표시합니다. 이 기록은 위의 폐루프 응답과 별도로 수집합니다.','These inputs and measured outputs are collected in a separate experiment, before the closed-loop run.'],
  task:['데이터 수집 입력을 상수로 바꿔 보세요. 기록 길이는 같지만 입력 이력이 제공하는 독립적인 정보가 줄어듭니다. 변화하는 입력으로 돌아가 예측 구간을 바꿔 보세요.','Switch to constant excitation. The recording is just as long, but contains fewer independent input patterns. Restore varying excitation and change the horizon.'],
  equations:['[U_p; Y_p; U_f; Y_f] g = [u_p; y_p; u_f; ŷ_f]', 'J = Σ [(ŷ − 1)² + λ(u − uₛ)²]'],
  assumptions:['무잡음 선형 시불변 시스템을 가정합니다. 시스템 설정을 변경하면 해당 시스템으로 데이터를 다시 수집합니다. 제어기는 전달함수 계수를 받지 않고 과거 입출력과 기록에서 만든 행켈 행렬로 미래 출력을 예측합니다. 데이터에서 구한 평형 입력 uₛ에서 벗어나는 양에 비용을 주고, 0.2초마다 첫 입력만 적용합니다. 입력 한계는 두지 않습니다.','This example assumes a noiseless LTI system. Changing the plant collects a fresh record from that plant. The controller receives no transfer-function coefficients: it uses input/output history and Hankel matrices from the recording to predict future outputs. The cost penalizes deviations from the data-derived steady input uₛ. Only the first move is applied every 0.2 s, with no actuator bound.'],
 },
 'smc-lti':{
  intro:['슬라이딩 면에 접근하는 오차 궤적과 제어입력을 살펴봅니다. 경계층을 넓히면 입력의 떨림과 추종 오차는 어떻게 달라질까요?','Follow the error trajectory toward the sliding surface. How does a wider boundary layer affect input switching and tracking error?'],
  settings:[{key:'lambda',label:['슬라이딩 면 기울기 λ','Surface slope λ'],range:[.5,3,.1,1.5]},{key:'gain',label:['도달 이득 η','Reaching gain η'],range:[.5,4,.1,2]},{key:'phi',label:['경계층 폭 φ','Boundary-layer width φ'],range:[0,.5,.01,.1]},disturbance],
  response:['슬라이딩 모드 추종 응답','Sliding-mode tracking response'],diag:['오차 위상평면','Tracking-error phase plane'],
  diagnosticNote:['가로축은 오차 e = y − 1, 세로축은 오차 변화율입니다. 점선은 s = 0인 직선입니다.','The horizontal axis is the error e = y − 1; the vertical axis is its rate. The dashed line is the sliding surface s = 0.'],
  task:['φ를 0으로 두고 4초 부근의 입력을 확대하세요. 경계층을 넓힌 뒤 입력 전환과 외란 이후의 오차가 어떻게 변하는지 확인하세요.','Set φ to zero and zoom the input around 4 s. Widen the boundary layer and inspect switching and the error after disturbance onset.'],
  equations:['e = y − 1,　s = ẏ + λe','b u* = a₀y + (a₁ − λ)ẏ − η sat(s/φ)','u = clip(u*, −4, 4),　ÿ = −a₀y − a₁ẏ + bu + d'],
  assumptions:['φ = 0이면 부호 함수를 사용합니다. 제어기는 공칭 동역학을 상쇄하지만 외란을 미리 알지는 못합니다. 입력 포화와 이산 샘플링이 있으므로 이상적인 연속시간 도달을 보장하는 실험은 아닙니다.','At φ = 0 the controller uses the sign function. It cancels the nominal dynamics but does not know the disturbance. Input saturation and discrete sampling mean ideal continuous-time reaching is not guaranteed.'],
 },
 'tdc-lti':{
  intro:['과거의 가속도와 실제 적용 입력으로 현재의 미지 동역학을 추정합니다. 외란이 바뀐 직후 추정값이 따라오는 시간을 확인하세요.','Estimate the unknown dynamics from past acceleration and applied input. Watch how long the estimate takes to respond after a disturbance step.'],
  settings:[{key:'delay',label:['추정 지연 ℓ (샘플)','Estimation lag ℓ (samples)'],range:[1,10,1,1]},{key:'nominal',label:['입력 이득 비 b₀/b','Input-gain ratio b₀/b'],range:[.75,1.5,.05,1]},disturbance],
  response:['시간지연 제어 추종 응답','Time-delay tracking response'],diag:['미지 동역학과 시간지연 추정','Unknown dynamics and delayed estimate'],
  diagnosticNote:['실제 F는 시뮬레이터만 아는 진단값입니다. 제어기에는 과거 측정으로 구한 추정값만 전달됩니다.','The simulator displays the true F for diagnosis. The controller only uses the estimate derived from earlier measurements.'],
  task:['지연 샘플 수를 늘려 보세요. 4초에 외란이 바뀔 때 실제 F와 추정값이 갈라지는 구간을 보고, 입력 이득 비를 바꿔 다시 확인하세요.','Increase the lag. Inspect the gap between F and its estimate when the disturbance changes at 4 s, then adjust the input-gain ratio.'],
  equations:['ÿ = F + b₀u','ā[k] = (v[k+1] − v[k]) / Tₛ,　F̂[k] = ā[k−ℓ] − b₀u[k−ℓ]', 'u = clip((r̈ + 6.25(r − y) + 5(ṙ − ẏ) − F̂)/b₀, −4, 4)'],
  assumptions:['목표는 3초 동안 0에서 1까지 매끄럽게 이동한 뒤 유지됩니다. F는 각 입력 유지 구간에서의 평균값이며, b₀는 조절한 비율에 실제 입력 계수 b를 곱한 교육용 보정값입니다. 초기에는 지연 이력이 없으므로 추정값을 0으로 둡니다. 가속도와 입력은 같은 시점의 값으로 짝지으며, 입력에는 포화 전 명령이 아닌 실제 적용값을 사용합니다. 조절하는 지연은 추정에 쓰는 이력 길이이지 구동기 통신 지연이 아닙니다.','The reference moves smoothly from 0 to 1 in 3 s and then holds. F is the interval average; b₀ is calibrated as the selected ratio times the true input gain b. The estimate is zero until history is available. Historical accelerations are paired with applied inputs from the same time, not unclipped commands. The lag selects the age of the estimate, not an actuator communication delay.'],
 }
};
export const labels={output:['출력 y','Output y'],target:['목표 r','Reference r'],input:['적용 입력 u','Applied input u'],'record-u':['기록 입력 u','Recorded input u'],'record-y':['측정 출력 y','Measured output y'],phase:['오차 궤적','Error trajectory'],surface:['슬라이딩 면 s = 0','Sliding surface s = 0'],unknown:['실제 F','True F'],estimate:['지연 추정 F̂','Delayed estimate F̂']};
export const diagnostics={'deepc-lti':['record-u','record-y'],'smc-lti':['phase','surface'],'tdc-lti':['unknown','estimate']};
