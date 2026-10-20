/**
 * Peso formatting. The API will send integer centavos; convert once with
 * `fromCentavos` and format every amount through `formatPeso`.
 */
const grouping = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeGrouping = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

/** `whole` drops centavos (rounded), for the small home tiles only; detail screens always show centavos. */
export function formatPeso(pesos: number, opts: { sign?: boolean; whole?: boolean } = {}) {
  const n = Number.isFinite(pesos) ? pesos : 0;
  const body = '₱' + (opts.whole ? wholeGrouping : grouping).format(Math.abs(n));
  if (n < 0) return '−' + body;
  return opts.sign && n > 0 ? '+' + body : body;
}

export const fromCentavos = (centavos: number) => Math.round(centavos) / 100;
