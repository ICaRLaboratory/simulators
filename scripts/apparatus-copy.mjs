import {math} from './paper-math.mjs';

// Only these authored fragments are formulas. Keep units in ordinary sentences,
// controller names, axis separators and every intervening word as source prose.
const t = String.raw;
const gains = {Kp:'K_p', Ki:'K_i', Kd:'K_d', 'Ki=0':'K_i=0'};
const inertia = t`\begin{bmatrix}A&B\\B&C\end{bmatrix}`;
const perPage = {
  'rotary-pendulum': {
    'τ*=kα(α−αr)+kvα̇+kθθ+kωθ̇':t`\tau^*=k_\alpha(\alpha-\alpha_r)+k_v\dot\alpha+k_\theta\theta+k_\omega\dot\theta`,
    'αr':t`\alpha_r`, 'θ=0':t`\theta=0`, 'α̇':t`\dot\alpha`, 'θ̇':t`\dot\theta`,
    'α̈':t`\ddot\alpha`, 'θ̈':t`\ddot\theta`, '+α':t`+\alpha`, '+θ':t`+\theta`, α:t`\alpha`, θ:t`\theta`,
    '2×2':t`2\times2`, 'M(θ)=[A B; B C]':`M(\\theta)=${inertia}`,
    '[A B; B C][α̈; θ̈]=[f; h]':inertia+t`\begin{bmatrix}\ddot\alpha\\\ddot\theta\end{bmatrix}=\begin{bmatrix}f\\h\end{bmatrix}`,
    'm=0.12 kg':t`m=0.12\,\mathrm{kg}`, 'r=0.18 m':t`r=0.18\,\mathrm{m}`, 'l=0.22 m':t`\ell=0.22\,\mathrm{m}`,
    'Jarm=0.004 kg·m²':t`J_{\mathrm{arm}}=0.004\,\mathrm{kg}\cdot\mathrm{m}^2`, 'g=9.81 m/s²':t`g=9.81\,\mathrm{m}/\mathrm{s}^2`,
    'ba=0.012':'b_a=0.012', 'bp=0.001 N·m·s/rad':t`b_p=0.001\,\mathrm{N}\cdot\mathrm{m}\cdot\mathrm{s}/\mathrm{rad}`,
    '|α|≥1.5 rad':t`\lvert\alpha\rvert\ge1.5\,\mathrm{rad}`, '|θ|≥0.6 rad':t`\lvert\theta\rvert\ge0.6\,\mathrm{rad}`,
    '−2, −2.5, −3, −3.5 s⁻¹':t`-2,\,-2.5,\,-3,\,-3.5\,\mathrm{s}^{-1}`,
  },
  'ball-and-plate': {
    '(xr, yr)':'(x_r,y_r)', 'βi*=kpi(ri−qi)−kdi vi':t`\beta_i^*=k_{pi}(r_i-q_i)-k_{di}v_i`,
    'sin(β)':t`\sin(\beta)`, '(x,y,vx,vy)':'(x,y,v_x,v_y)', '(+Δv,−Δv)':t`(+\Delta v,-\Delta v)`,
    'βx':t`\beta_x`, 'βy':t`\beta_y`, '+Δv':t`+\Delta v`, '−Δv':t`-\Delta v`,
    '+x':'+x','−y':'-y', x:'x',y:'y',vx:'v_x',vy:'v_y',sin:t`\sin`,D:'D', '0.15 s⁻¹':t`0.15\,\mathrm{s}^{-1}`,
  },
  'robot-arm': {...gains, 'qᵣ':'q_r', 'q₁':'q_1','q₂':'q_2', D:'D', '|q|≥2.8 rad':t`\lvert q\rvert\ge2.8\,\mathrm{rad}`},
  parking:{y:'y'},
  'heat-exchanger': {...gains,T:'T',Q:'Q'},
  drone:{...gains, 'x,z,φ':t`x,z,\phi`,x:'x',z:'z','z≤0':t`z\le0`,
    '|롤|≥1.1 rad':t`\lvert\text{롤}\rvert\ge1.1\,\mathrm{rad}`, '|roll|≥1.1 rad':t`\lvert\text{roll}\rvert\ge1.1\,\mathrm{rad}`},
  'impedance-robot': {K:'K','Kₑ':'K_e','+x':'+x'},
  'path-tracking': {d:'d',α:t`\alpha`,'d < 10⁻⁹ m':t`d<10^{-9}\,\mathrm{m}`},
  suspension:{'u = −g v_s':'u=-g v_s'},
  cstr:{...gains,T:'T','T[K]=T[°C]+273.15':t`T[\mathrm{K}]=T[\degree\mathrm{C}]+273.15`,
    'E/R':t`\frac{E}{R}`, 'E/R = 8750 K':t`\frac{E}{R}=8750\,\mathrm{K}`, '1/60 s⁻¹':t`\frac{1}{60}\,\mathrm{s}^{-1}`,
    'V=100 L':t`V=100\,\mathrm{L}`, '유량=100 L/min':t`\text{유량}=100\,\mathrm{L}/\mathrm{min}`, 'flow=100 L/min':t`\text{flow}=100\,\mathrm{L}/\mathrm{min}`,
    '공급온도=350 K':t`\text{공급온도}=350\,\mathrm{K}`, 'feed=350 K':t`\text{feed}=350\,\mathrm{K}`, 'ρ=1000 g/L':t`\rho=1000\,\mathrm{g}/\mathrm{L}`,
    'cp=0.239 J/(g·K)':t`c_p=0.239\,\frac{\mathrm{J}}{\mathrm{g}\cdot\mathrm{K}}`,
    '−ΔH=50000 J/mol':t`-\Delta H=50000\,\mathrm{J}/\mathrm{mol}`, 'UA=50000 J/(min·K)':t`UA=50000\,\frac{\mathrm{J}}{\mathrm{min}\cdot\mathrm{K}}`,
    'C=0.5 mol/L':t`C=0.5\,\mathrm{mol}/\mathrm{L}`, 'T=350 K':t`T=350\,\mathrm{K}`, 'Tc=300 K':t`T_c=300\,\mathrm{K}`,
    'T≥400 K':t`T\ge400\,\mathrm{K}`, 'T≤250 K':t`T\le250\,\mathrm{K}`},
  'aircraft-pitch':{...gains,'PI − Kd·피치율':t`\mathrm{PI}-K_d\cdot\text{피치율}`, 'PI − Kd·pitch rate':t`\mathrm{PI}-K_d\cdot\text{pitch rate}`,
    α:t`\alpha`,q:'q',θ:t`\theta`,δ:t`\delta`,D:'D','q=56.7 qcanonical':t`q=56.7\,q_{\mathrm{canonical}}`,
    'q_web = 56.7 x₂':t`q_{\mathrm{web}}=56.7\,x_2`,'x₂':'x_2','|θ|':t`\lvert\theta\rvert`, '|α|≥30°':t`\lvert\alpha\rvert\ge30\degree`},
  'rocket-landing':{'x,y,θ':t`x,y,\theta`,x:'x',y:'y',θ:t`\theta`,vx:'v_x',
    'm=1 kg':t`m=1\,\mathrm{kg}`, 'J=0.5 kg·m²':t`J=0.5\,\mathrm{kg}\cdot\mathrm{m}^2`, 'l=0.6 m':t`\ell=0.6\,\mathrm{m}`, 'g=9.81 m/s²':t`g=9.81\,\mathrm{m}/\mathrm{s}^2`,
    '≤0.8 m':t`\le0.8\,\mathrm{m}`, '|vx|≤0.5 m/s':t`\lvert v_x\rvert\le0.5\,\mathrm{m}/\mathrm{s}`, '−0.8≤vy≤0.1 m/s':t`-0.8\le v_y\le0.1\,\mathrm{m}/\mathrm{s}`,
    '|θ|≤0.12 rad':t`\lvert\theta\rvert\le0.12\,\mathrm{rad}`, '|ω|≤0.3 rad/s':t`\lvert\omega\rvert\le0.3\,\mathrm{rad}/\mathrm{s}`,
    '|x|≥14 m':t`\lvert x\rvert\ge14\,\mathrm{m}`, 'y≥24 m':t`y\ge24\,\mathrm{m}`, '|θ|≥0.85 rad':t`\lvert\theta\rvert\ge0.85\,\mathrm{rad}`},
};
// A in the matrix discussion is an entry, not the English indefinite article.
const matrixNames = {A:'A',B:'B',C:'C',f:'f',h:'h'};
export const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const diagramQuantities = {
  '±0.18 N·m':t`\pm0.18\,\mathrm{N}\cdot\mathrm{m}`, '±40 / ±20 N·m':t`\pm40\;/\;\pm20\,\mathrm{N}\cdot\mathrm{m}`,
  '0–150 kW':t`0\text{–}150\,\mathrm{kW}`, '−10 °C':t`-10\,\degree\mathrm{C}`, '0–10 N':t`0\text{–}10\,\mathrm{N}`,
  '14 m':t`14\,\mathrm{m}`, '±0.6 rad':t`\pm0.6\,\mathrm{rad}`, '±1500 N':t`\pm1500\,\mathrm{N}`,
  'PI + 300 K':t`\mathrm{PI}+300\,\mathrm{K}`, '+0.2 mol/L':t`+0.2\,\mathrm{mol}/\mathrm{L}`, '+5 °/s':t`+5\,\degree/\mathrm{s}`, '0–12 N':t`0\text{–}12\,\mathrm{N}`,
};
export function apparatusCopy(id, pair, field='') {
  const dict = field==='diagram' ? {...perPage[id], ...diagramQuantities} : id==='rotary-pendulum' && field==='notes' && pair[0].includes('[A B; B C]')
    ? {...perPage[id], ...matrixNames} : perPage[id];
  const tokens = Object.keys(dict).sort((a,b)=>b.length-a.length);
  // Bound Latin identifiers, not Hangul particles (vx에, Ki=0이면).
  const pattern = new RegExp(tokens.map(key=>(/^[A-Za-z0-9]/.test(key)?'(?<![A-Za-z0-9_])':'')+escapeRegex(key)+(/[A-Za-z0-9]$/.test(key)?'(?![A-Za-z0-9_])':'')).join('|'),'g');
  let changed=false;
  const html = pair.map(s=>{
    let from=0, out='';
    for(const match of s.matchAll(pattern)) {
      changed=true; out+=escapeHTML(s.slice(from,match.index))+math(dict[match[0]]); from=match.index+match[0].length;
    }
    return out+escapeHTML(s.slice(from));
  });
  return changed ? html : null;
}
