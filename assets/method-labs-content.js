// Per-lab vocabulary and teaching notes. Paired strings are Korean, English.
const tex=String.raw;
const disturbance={key:'disturbance',label:['4초부터의 가속도 외란 d','Acceleration disturbance after 4 s'],range:[0,2,.1,.8]};
export const labs={
 'ddc-lti':{
  intro:['기록한 입력·상태 데이터로 상태 피드백 이득 K를 구합니다. 감쇠율을 높이면 단위 계단응답과 필요한 제어입력이 어떻게 달라질까요?','Design a state-feedback gain K from recorded inputs and states. How does a faster decay rate change the unit step response and the control input it requires?'],
  settings:[{key:'excitation',label:['데이터 수집 입력','Input used to collect data'],choices:[[1,'변화하는 입력','Varying input'],[0,'영 입력 (정지 상태에서 시작)','Zero input from rest']]},{key:'decay',label:['설계 감쇠율 α (1/s)','Design decay rate α (1/s)'],range:[.5,2,.1,1]}],
  response:['데이터 기반 상태 피드백 단위 계단응답','Unit step response with data-driven state feedback'],diag:['이득 설계에 사용한 입력·상태 기록','Input and state record used to design K'],
  diagnosticNote:['정지 상태에서 입력 u를 가하고 위치 y와 속도 v를 측정한 별도의 실험 기록입니다. 감쇠율은 이 기록에서 설계하는 이득을 바꾸지만 기록 자체는 바꾸지 않습니다.','This separate experiment starts from rest. It records the applied input u and both measured states, position y and velocity v. Changing the decay rate changes the design, not the record.'],
  task:['감쇠율을 바꾸고 피드백 이득과 최대 입력을 비교하세요. 수집 입력을 0으로 바꾸면 기록 길이는 같아도 이득을 구할 수 없는 이유는 무엇인가요?','Change the decay rate and compare the gain and peak input. Then select zero input. Why can the lab no longer design a gain from a record of the same length?'],
  equations:[
   [tex`x=\begin{bmatrix}y&v\end{bmatrix}^{\mathsf T},`,tex`v=\dot y`],
   [tex`P=X_0 Q=P^{\mathsf T},`,tex`\begin{bmatrix}P&X_1 Q\\(X_1 Q)^{\mathsf T}&P\end{bmatrix}\succ 0`],
   [tex`K=U_0 Q P^{-1},`,tex`A_{\mathrm{cl}}=X_1 Q P^{-1},`,tex`\rho(A_{\mathrm{cl}})<1`],
   [tex`x^*=\begin{bmatrix}1&0\end{bmatrix}^{\mathsf T},`,tex`u=\operatorname{clip}\big(u^*+K(x-x^*),-4,4\big)`],
  ],
  assumptions:[tex`De Persis–Tesi의 안정화 조건은 무잡음 이산시간 선형 시스템의 입력과 전체 상태 기록을 사용합니다. $X_0$와 $X_1$의 대응하는 열은 한 샘플 간격의 연속 상태이며, $U_0$에는 그 사이에 적용한 입력을 둡니다. 이 실험은 $\begin{bmatrix}U_0\\X_0\end{bmatrix}$의 행 랭크가 3인지 확인한 뒤 목표 극점 $\exp(-\alpha T_s)$, $\exp(-2\alpha T_s)$에 맞춰 Q를 구성하고 위 행렬의 양의 정부호성을 확인합니다. ρ는 폐루프 극점의 최대 절댓값입니다.`,tex`The De Persis–Tesi stabilization result uses input and full-state measurements from a noiseless discrete-time linear system. Matching columns of $X_0$ and $X_1$ contain consecutive states; $U_0$ contains the input held between them. This lab checks that $\begin{bmatrix}U_0\\X_0\end{bmatrix}$ has row rank 3, constructs Q for the selected poles $\exp(-\alpha T_s)$ and $\exp(-2\alpha T_s)$, then checks that the block matrix is positive definite. The spectral radius ρ is the largest closed-loop pole magnitude.`],
  tracking:[tex`단위 계단 추종은 논문의 원점 안정화 결과를 목표 평형점으로 옮긴 교육용 예입니다. 외란 없는 별도 기록에서 평형 입력 $u^*$와 이득 K를 구합니다. 정지 상태에서 첫 샘플부터 $r=1$을 주며 각 명령은 0.2초 동안 유지합니다. 안정성 조건과 극점은 포화되지 않은 공칭 폐루프에 대한 것으로, 입력 포화 또는 지속 외란이 있을 때 오차가 0이 됨을 보장하지 않습니다.`,tex`Unit step tracking shifts the paper’s stabilization result to the target equilibrium. The gain K and equilibrium input $u^*$ come from a separate disturbance-free record. The plant starts from rest with $r=1$ from the first sample; each command is held for 0.2 s. The certificate and poles describe the nominal unsaturated closed loop; they do not guarantee zero error with saturation or a persistent input disturbance.`],
 },
 'smc-lti':{
  intro:['슬라이딩 면에 접근하는 오차 궤적과 제어입력을 살펴봅니다. 경계층을 넓히면 입력의 떨림과 추종 오차는 어떻게 달라질까요?','Follow the error trajectory toward the sliding surface. How does a wider boundary layer affect input switching and tracking error?'],
  settings:[{key:'lambda',label:['슬라이딩 면 기울기 λ','Surface slope λ'],range:[.5,3,.1,1.5]},{key:'gain',label:['도달 이득 η','Reaching gain η'],range:[.5,4,.1,2]},{key:'phi',label:['경계층 폭 φ','Boundary-layer width φ'],range:[0,.5,.01,.1]}],
  response:['슬라이딩 모드 추종 응답','Sliding-mode tracking response'],diag:['오차 위상평면','Tracking-error phase plane'],
  diagnosticNote:[tex`가로축은 오차 $e=y-1$, 세로축은 오차 변화율입니다. 점선은 $s=0$인 직선입니다.`,tex`The horizontal axis is the error $e=y-1$; the vertical axis is its rate. The dashed line is the sliding surface $s=0$.`],
  task:[tex`입력 외란을 0.8로 설정하고 $\varphi=0$에서 4초 부근의 제어입력을 확대하세요. 경계층을 넓히면 입력 전환과 외란 이후의 정상상태 오차는 어떻게 달라지나요?`,'Set the input disturbance to 0.8 and φ to zero. Zoom the control input around 4 s. How does widening the boundary layer change switching and the steady tracking error under load?'],
  equations:[
   ['e=y-1,',tex`s=\dot y+\lambda e`],
   [tex`bu^*=a_0 y+(a_1-\lambda)\dot y`,tex`{}-\eta\operatorname{sat}\!\left(\frac{s}{\varphi}\right)`],
   [tex`u=\operatorname{clip}(u^*,-4,4),`,tex`\ddot y=-a_0 y-a_1\dot y+b(u+d)`],
  ],
  assumptions:[tex`입력 외란 d의 기본값은 0입니다. 4초부터 포화된 제어입력 u에 설정한 외란이 더해집니다. 포화가 없을 때 샘플 시점의 도달식은 $\dot s=-\eta\operatorname{sat}\!\left(\frac{s}{\varphi}\right)+bd$이며, $\varphi=0$이면 부호 함수를 사용합니다. 제어기는 d를 측정하지 않습니다. 입력 포화와 이산 샘플링 때문에 이상적인 연속시간 도달은 보장되지 않습니다.`,tex`The input disturbance d defaults to zero. From 4 s onward it adds to the clipped actuator input u. Without clipping, the reaching law at each sampling instant is $\dot s=-\eta\operatorname{sat}\!\left(\frac{s}{\varphi}\right)+bd$; at $\varphi=0$ the controller uses the sign function. The controller does not measure d. Actuator saturation and discrete sampling can prevent ideal continuous-time reaching.`],
 },
 'tdc-lti':{
  intro:['과거의 가속도와 실제 적용 입력으로 현재의 미지 동역학을 추정합니다. 외란이 바뀐 직후 추정값이 따라오는 시간을 확인하세요.','Estimate the unknown dynamics from past acceleration and applied input. Watch how long the estimate takes to respond after a disturbance step.'],
  settings:[{key:'delay',label:['추정 지연 ℓ (샘플)','Estimation lag ℓ (samples)'],range:[1,10,1,1]},{key:'nominal',label:[tex`입력 이득 비 $\frac{b_0}{b}$`,tex`Input-gain ratio $\frac{b_0}{b}$`],range:[.75,1.5,.05,1]}],
  response:['시간지연 제어 단위 계단응답','Time-delay control: unit step response'],diag:['미지 동역학과 시간지연 추정','Unknown dynamics and delayed estimate'],
  diagnosticNote:['실제 F는 시뮬레이터만 아는 진단값입니다. 제어기에는 과거 측정으로 구한 추정값만 전달됩니다.','The simulator displays the true F for diagnosis. The controller only uses the estimate derived from earlier measurements.'],
  task:['입력 외란을 0.8로 설정하세요. 4초에 외란을 가한 뒤 몇 샘플이 지나야 추정값에 반영되나요? 추정 지연 ℓ을 늘려 비교하세요.','Set the input disturbance to 0.8. How many samples pass before the estimate reflects the disturbance applied at 4 s? Increase the estimation lag ℓ and compare.'],
  equations:[
   [tex`\ddot y=-a_0 y-a_1\dot y+b(u+d)`,tex`{}=F+b_0 u`],
   [tex`F=-a_0 y-a_1\dot y+(b-b_0)u+bd`],
   [tex`\bar a[k]=\frac{v[k+1]-v[k]}{T_s},`,tex`\hat F[k]=\bar a[k-\ell]-b_0 u[k-\ell]`],
   ['r=1,',tex`u=\operatorname{clip}\!\left(\frac{6.25(r-y)-5\dot y-\hat F}{b_0},-4,4\right)`],
  ],
  assumptions:[tex`출력과 속도는 0에서 시작하고 목표값 r은 첫 샘플부터 1입니다. 제어기는 목표값을 미분하지 않고 측정 속도 $\dot y$를 사용합니다. $b_0$는 설정한 비율에 실제 입력 계수 b를 곱한 교육용 보정값입니다. 그래프의 실제 F는 각 입력 유지 구간의 평균입니다. 추정에는 같은 구간의 평균 가속도와 실제 구동기 입력 u를 사용하며, 외란 d는 측정하지 않습니다. 외란의 기본값은 0이며 4초부터 u에 더해집니다. ℓ은 구동기 통신 지연이 아니라 추정에 쓰는 과거 샘플의 지연입니다. 이력이 없는 동안 추정값은 0입니다.`,tex`Output and velocity start at zero with $r=1$ from the first sample. The controller uses measured velocity rather than differentiating the reference step. For this lab, $b_0$ is the selected ratio times the true input gain b. The plot shows the mean F over each hold. The estimator pairs the mean acceleration with the applied actuator input u from the same hold; it does not measure d. The disturbance defaults to zero and adds to u from 4 s onward. The lag ℓ selects a past measurement, not an actuator delay. Until that measurement exists, the estimate is zero.`],
 }
};
export const labels={output:['출력 y','Output y'],target:['목표 r','Reference r'],input:['적용 입력 u','Applied input u'],'record-u':['기록 입력 u','Recorded input u'],'record-y':['측정 위치 y','Measured position y'],'record-v':['측정 속도 v','Measured velocity v'],phase:['오차 궤적','Error trajectory'],surface:[tex`슬라이딩 면 $s=0$`,tex`Sliding surface $s=0$`],unknown:['실제 F','True F'],estimate:[tex`지연 추정 $\hat F$`,tex`Delayed estimate $\hat F$`]};
export const diagnostics={'ddc-lti':['record-u','record-y','record-v'],'smc-lti':['phase','surface'],'tdc-lti':['unknown','estimate']};
