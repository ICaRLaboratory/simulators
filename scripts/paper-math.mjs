import temml from 'temml';

// Typeset authored TeX during generation, never on a visitor's device.
// Display-style operators and fractions, but inline roots so clauses can wrap.
export function math(tex) {
  return temml.renderToString('\\displaystyle ' + tex, {
    throwOnError: true, trust: false, xml: true, annotate: false,
  });
}
