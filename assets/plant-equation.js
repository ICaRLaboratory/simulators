// The static shell and slider updates share this numeric-only MathML template.
const number = value => `<mn>${Number(value.toFixed(4))}</mn>`;
export function plantEquation({b, a1, a0}) {
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" displaystyle="true"><mi>G</mi><mo>(</mo><mi>s</mi><mo>)</mo><mo>=</mo><mfrac>${number(b)}<mrow><msup><mi>s</mi><mn>2</mn></msup><mo>+</mo>${a1 === 1 ? '' : number(a1)}<mi>s</mi><mo>+</mo>${number(a0)}</mrow></mfrac></math>`;
}

const math = body => `<math xmlns="http://www.w3.org/1998/Math/MathML">${body}</math>`;
export function pinnedPlant({wn,zeta,gain,disturbance}) {
  return [math(`<msub><mi>ω</mi><mi>n</mi></msub><mo>=</mo>${number(wn)}`)+' rad/s',
    ...[['ζ',zeta],['K',gain],['d',disturbance]].map(([name,value])=>math(`<mi>${name}</mi><mo>=</mo>${number(value)}`)),
  ].join(' · ');
}
export function equilibriumInput(need) {
  return math(`<mi>u</mi><mo>=</mo><mfrac><mn>1</mn><mi>K</mi></mfrac><mo>−</mo><mi>d</mi><mo>≈</mo>${number(need)}`);
}
