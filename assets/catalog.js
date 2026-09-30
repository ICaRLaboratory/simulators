import {translate} from './i18n.js';

export function filterCatalog({query = '', category = '', ready = false} = {}) {
  const text = query.trim().toLocaleLowerCase();
  return catalog.filter(item => (!category || item.category === category) && (!ready || item.status === 'ready') && [item.name,item.english,item.description,item.category,...item.features].flatMap(value => [value,translate(value)]).join(' ').toLocaleLowerCase().includes(text));
}
const virtual = 'https://github.com/MathWorks-Teaching-Resources/Virtual-Controls-Laboratory';
const entries = [
  ['cruise-control','차량 속도 제어','Cruise control','모빌리티','크루즈 컨트롤의 속도 피드백. 외란을 주고 목표 속도가 회복되는 과정을 관찰합니다.',['목표 속도','PID 이득','부하 외란'],virtual,'Virtual Controls Laboratory'],
  ['dc-motor','DC 모터 위치 제어','DC motor','전기·구동','모터 축을 원하는 각도로 움직입니다. 빠른 응답과 오버슈트 사이의 차이를 비교합니다.',['목표 각도','PID 이득','부하 외란'],virtual,'Virtual Controls Laboratory'],
  ['ball-and-beam','볼 앤 빔','Ball and beam','균형·진자','빔의 기울기로 공의 위치를 제어합니다. 작은 조정이 만드는 움직임을 살펴봅니다.',['목표 위치','PID 이득','외란'],virtual,'Virtual Controls Laboratory'],
  ['inverted-pendulum','도립진자','Inverted pendulum','균형·진자','카트를 움직여 불안정한 진자를 세우는 상태 피드백 실험입니다.',['카트 위치','피드백 이득'],virtual,'Virtual Controls Laboratory'],
  ['rotary-pendulum','회전 도립진자','Rotary pendulum','균형·진자','회전 암과 진자의 결합 운동을 통해 균형 제어를 탐색합니다.',['회전 각도','피드백 이득'],virtual,'Virtual Controls Laboratory'],
  ['ball-and-plate','볼 앤 플레이트','Ball and plate','균형·진자','평판 위 공의 두 축 위치를 제어하는 다변수 시스템입니다.',['목표 좌표','축별 제어 이득'],virtual,'Virtual Controls Laboratory'],
  ['robot-arm','로봇 암 다중 루프 제어','Robot arm','로보틱스','관절별 제어 루프가 연결된 로봇 암의 위치 응답을 살펴봅니다.',['관절 목표','루프별 PID'],'https://www.mathworks.com/help/control/ug/multi-loop-pid-control-of-a-robot-arm.html','MathWorks 공식 예제'],
  ['parking','자동 주차','Automated parking','모빌리티','주차 경로와 차량 조향을 연결하는 경로 추종 예제입니다.',['주차 목표','차량 속도'],'https://www.mathworks.com/help/driving/ug/automated-parking-valet-in-simulink.html','MathWorks 공식 예제'],
  ['heat-exchanger','열교환기 온도 제어','Heat exchanger','공정·열','느린 열 응답과 유량 변화가 온도 제어에 미치는 영향을 탐색합니다.',['목표 온도','PI 이득'],'https://www.mathworks.com/help/control/ug/temperature-control-in-a-heat-exchanger.html','MathWorks 공식 예제'],
  ['drone','쿼드콥터 드론','Quadcopter drone','로보틱스','회전익의 추력으로 자세와 고도를 제어하는 모델입니다.',['목표 고도','자세 이득'],'https://github.com/mathworks/Quadcopter-Drone-Model-Simscape','MathWorks GitHub'],
  ['impedance-robot','로봇 임피던스 제어','Robot impedance','로보틱스','접촉 힘과 움직임의 관계를 강성과 감쇠로 조절합니다.',['가상 강성','감쇠 계수'],'https://github.com/mathworks/Robotic-Arm-Impedance-Control','MathWorks GitHub'],
  ['path-tracking','차량 경로 추종','Pure pursuit','모빌리티','전방 주시점을 바꾸며 차량의 경로 추종 특성을 비교합니다.',['전방 주시 거리','차량 속도'],'https://github.com/mathworks/vehicle-pure-pursuit','MathWorks GitHub'],
  ['suspension','능동 서스펜션','Quarter-car suspension','모빌리티','노면 충격에 대한 차체 진동과 승차감의 관계를 탐색합니다.',['감쇠 계수','제어 이득'],'https://www.mathworks.com/matlabcentral/fileexchange/95308-quarter-car-suspension-active-control-demo-app-simulink','MATLAB File Exchange'],
  ['cstr','연속 교반 탱크 반응기','CSTR','공정·열','반응과 열전달이 결합된 공정의 온도 제어를 살펴봅니다.',['온도 설정값','PI 이득'],'https://www.mathworks.com/matlabcentral/fileexchange/103695-continuously-stirred-tank-reactor-cstr-pid-control','MATLAB File Exchange'],
  ['aircraft-pitch','항공기 피치 제어','Aircraft pitch','항공','승강타 입력으로 항공기 피치각을 조절하는 실험입니다.',['목표 피치각','제어 이득'],'https://www.mathworks.com/matlabcentral/fileexchange/40798-aircraft-pitch-control','MATLAB File Exchange']
];
const research = (id, name, english, sim, description, features) => ({id,name,english,category:'로보틱스',description,features,sourceName:'연구 시뮬레이션',status:'ready',external:true,href:`https://icarlaboratory.github.io/research.html?sim=${sim}&lang=ko#interactive`,source:`https://icarlaboratory.github.io/research.html?sim=${sim}&lang=ko#interactive`});
export const catalog = entries.map(([id,name,english,category,description,features,source,sourceName]) => ({id,name,english,category,description,features,source,sourceName,status:'ready',external:false,href:`${id}/`})).concat([
  research('research-tracking','로봇 궤적 추종','Robot trajectory tracking','track','제어 이득을 바꾸며 로봇의 목표 궤적과 추종 오차를 비교합니다.',['목표 궤적','제어 이득']),
  research('research-contact','로봇 접촉 제어','Robot contact control','contact','강성과 감쇠를 바꾸며 접촉 힘과 움직임을 관찰합니다.',['가상 강성','감쇠 계수','접촉 힘'])
]).sort((a,b) => Number(b.status==='ready') - Number(a.status==='ready'));
