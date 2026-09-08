/* The analyst.
   Every sentence it produces is derived from a figure that actually arrived from
   the provider. If the figure is missing, the section says what is missing rather
   than filling the gap. It never states direction as fact: it frames scenarios and
   names what to watch. DATOS -> ANÁLISIS -> INTERPRETACIÓN -> CONCLUSIÓN. */

import { NA, isNA, pct, ratio, compact, price } from './format.js';

const has = (v) => !isNA(v);

/** A finding: a claim, the figure behind it, and how it reads. */
const f = (text, tone = 'neutral') => ({ text, tone });

function valuationVerdict(fun) {
  const { pe, ps, pb } = fun;
  if (!has(pe) && !has(ps)) return { verdict: 'sin datos', tone: 'neutral' };
  if (has(pe)) {
    if (pe < 0) return { verdict: 'sin beneficios', tone: 'warn' };
    if (pe < 12) return { verdict: 'baja', tone: 'good' };
    if (pe < 25) return { verdict: 'razonable', tone: 'neutral' };
    if (pe < 45) return { verdict: 'elevada', tone: 'warn' };
    return { verdict: 'muy elevada', tone: 'bad' };
  }
  if (ps < 2) return { verdict: 'baja sobre ventas', tone: 'good' };
  if (ps < 8) return { verdict: 'razonable sobre ventas', tone: 'neutral' };
  return { verdict: 'elevada sobre ventas', tone: 'warn' };
}

function profitabilityFindings(fun) {
  const out = [];
  if (has(fun.netMargin)) {
    out.push(f(`El margen neto es del ${pct(fun.netMargin, false)}, ${fun.netMargin > 20 ? 'un nivel alto que indica poder de fijación de precios' : fun.netMargin > 8 ? 'un nivel intermedio' : fun.netMargin > 0 ? 'un margen estrecho que deja poco colchón ante subidas de costes' : 'negativo: la compañía pierde dinero en su actividad'}.`,
      fun.netMargin > 20 ? 'good' : fun.netMargin > 0 ? 'neutral' : 'bad'));
  }
  if (has(fun.grossMargin) && has(fun.operatingMargin)) {
    const gap = fun.grossMargin - fun.operatingMargin;
    out.push(f(`Entre el margen bruto (${pct(fun.grossMargin, false)}) y el operativo (${pct(fun.operatingMargin, false)}) se van ${pct(gap, false)} en estructura y gasto operativo.`));
  }
  if (has(fun.roe)) {
    out.push(f(`El ROE es del ${pct(fun.roe, false)}, ${fun.roe > 20 ? 'muy por encima del coste de capital habitual' : fun.roe > 10 ? 'en línea con lo exigible' : 'por debajo de lo que suele exigirse al capital'}.`,
      fun.roe > 20 ? 'good' : fun.roe > 10 ? 'neutral' : 'warn'));
  }
  if (has(fun.roic)) out.push(f(`El ROIC es del ${pct(fun.roic, false)}, que mide el retorno sobre todo el capital empleado, no solo el de los accionistas.`));
  return out;
}

function growthFindings(fun) {
  const out = [];
  if (has(fun.revenueGrowth)) {
    out.push(f(`Los ingresos ${fun.revenueGrowth >= 0 ? 'crecen' : 'caen'} un ${pct(Math.abs(fun.revenueGrowth), false)} respecto al ejercicio anterior.`,
      fun.revenueGrowth > 15 ? 'good' : fun.revenueGrowth >= 0 ? 'neutral' : 'bad'));
  }
  if (has(fun.epsGrowth)) {
    out.push(f(`El beneficio por acción ${fun.epsGrowth >= 0 ? 'avanza' : 'retrocede'} un ${pct(Math.abs(fun.epsGrowth), false)}.`,
      fun.epsGrowth > 15 ? 'good' : fun.epsGrowth >= 0 ? 'neutral' : 'bad'));
  }
  if (has(fun.revenueGrowth) && has(fun.epsGrowth)) {
    out.push(fun.epsGrowth > fun.revenueGrowth
      ? f('El beneficio crece más rápido que las ventas, señal de apalancamiento operativo o de mejora de márgenes.', 'good')
      : f('Las ventas crecen más que el beneficio, lo que apunta a presión en márgenes o mayor gasto.', 'warn'));
  }
  return out;
}

function priceFindings(quote) {
  const out = [];
  if (has(quote.price) && has(quote.yearHigh) && has(quote.yearLow)) {
    const range = quote.yearHigh - quote.yearLow;
    if (range > 0) {
      const posPct = ((quote.price - quote.yearLow) / range) * 100;
      out.push(f(`Cotiza en el ${pct(posPct, false)} de su rango de las últimas 52 semanas, entre ${price(quote.yearLow)} y ${price(quote.yearHigh)}.`,
        posPct > 85 ? 'warn' : posPct < 20 ? 'warn' : 'neutral'));
    }
  }
  if (has(quote.volume) && has(quote.avgVolume) && quote.avgVolume > 0) {
    const rel = (quote.volume / quote.avgVolume) * 100;
    if (rel > 160 || rel < 45) {
      out.push(f(`El volumen de la sesión es el ${pct(rel, false)} del volumen medio, una desviación que conviene mirar junto a las noticias del día.`, 'warn'));
    }
  }
  return out;
}

const RISK_BY_SECTOR = {
  'Tecnología': ['Ciclo de inversión en capex de los clientes', 'Concentración en pocos clientes o proveedores', 'Control de exportaciones y restricciones geopolíticas'],
  'Semiconductores': ['Ciclicidad histórica del sector', 'Dependencia de la capacidad de fundición', 'Restricciones a la exportación'],
  'Financiero': ['Sensibilidad a los tipos de interés', 'Calidad crediticia de la cartera', 'Exigencias regulatorias de capital'],
  'Salud': ['Vencimiento de patentes', 'Resultados de ensayos clínicos', 'Presión regulatoria sobre precios'],
  'Energía': ['Precio de la materia prima subyacente', 'Transición energética y regulación climática', 'Riesgo geopolítico en la producción'],
  'Consumo discrecional': ['Sensibilidad al ciclo económico', 'Poder adquisitivo del consumidor', 'Costes de materias primas y logística'],
  'Consumo básico': ['Presión de marcas blancas', 'Costes de insumos', 'Tipo de cambio en mercados emergentes'],
  'Comunicación': ['Dependencia del mercado publicitario', 'Regulación de contenidos y competencia', 'Coste de adquisición de contenido'],
  'Cripto': ['Volatilidad estructural muy superior a la renta variable', 'Riesgo regulatorio en cambio permanente', 'Riesgo de custodia y de contrapartida'],
  'Divisas': ['Política monetaria de los bancos centrales', 'Diferenciales de tipos', 'Riesgo político'],
};

export function analyse({ asset, quote, fundamentals: fun, profile }) {
  const q = quote || {}, fn = fun || {}, pr = profile || {};
  const val = valuationVerdict(fn);
  const prof = profitabilityFindings(fn);
  const grow = growthFindings(fn);
  const px = priceFindings(q);

  const available = [q.price, fn.pe, fn.netMargin, fn.revenueGrowth, fn.roe].filter(has).length;
  const coverage = available === 0 ? 'ninguno' : available < 3 ? 'parcial' : 'suficiente';

  // ---- 1. resumen ----
  const summary = [];
  if (has(q.changePct)) {
    summary.push(`${asset.short} ${q.changePct >= 0 ? 'sube' : 'baja'} un ${pct(Math.abs(q.changePct), false)} en la sesión, hasta ${price(q.price, asset.currency)}.`);
  }
  if (has(q.marketCap)) summary.push(`Su capitalización es de ${compact(q.marketCap, asset.currency)}.`);
  if (val.verdict !== 'sin datos') summary.push(`Por múltiplos, la valoración se lee como ${val.verdict}.`);
  if (!summary.length) summary.push('No hay datos de mercado suficientes para describir la situación actual.');

  // ---- 5. riesgos ----
  const sectorRisks = RISK_BY_SECTOR[asset.sector] || RISK_BY_SECTOR[asset.industry] || [];
  const risks = [...sectorRisks];
  if (has(fn.pe) && fn.pe > 40) risks.push('La valoración descuenta un crecimiento alto: una decepción en resultados corrige con fuerza.');
  if (has(fn.netMargin) && fn.netMargin < 0) risks.push('La compañía no es rentable a nivel neto, lo que la hace dependiente de financiación externa.');
  if (has(fn.revenueGrowth) && fn.revenueGrowth < 0) risks.push('Los ingresos se están contrayendo.');
  if (asset.type === 'crypto') risks.push('Sin flujos de caja subyacentes, la valoración depende por completo de la oferta y la demanda.');
  if (!risks.length) risks.push('No hay datos suficientes para señalar riesgos específicos más allá de los propios del mercado.');

  // ---- 6. catalizadores ----
  const catalysts = [];
  if (has(fn.revenueGrowth) && fn.revenueGrowth > 15) catalysts.push('El crecimiento de ingresos de dos dígitos sostiene la tesis si se mantiene en los próximos trimestres.');
  if (has(fn.operatingMargin) && has(fn.grossMargin) && fn.operatingMargin < fn.grossMargin - 40) catalysts.push('Hay recorrido de mejora si la compañía contiene el gasto operativo.');
  if (has(q.price) && has(q.yearHigh) && q.price < q.yearHigh * 0.75) catalysts.push('Cotiza lejos de máximos anuales: una normalización del sentimiento tiene margen de recorrido.');
  catalysts.push('Publicación de resultados trimestrales y revisión de guías.');
  if (asset.type === 'stock') catalysts.push('Lanzamientos de producto, adquisiciones y cambios regulatorios en su sector.');

  // ---- 7. conclusión, en escenarios ----
  const scenarios = [
    { name: 'Escenario base', text: has(fn.revenueGrowth)
        ? `Continuidad de la tendencia actual de ingresos (${pct(fn.revenueGrowth, false)}) con márgenes estables.`
        : 'Sin datos de crecimiento no es posible plantear un escenario base cuantificado.' },
    { name: 'Escenario positivo', text: 'Aceleración del crecimiento o expansión de márgenes por encima de lo descontado, lo que justificaría múltiplos mayores.' },
    { name: 'Escenario negativo', text: has(fn.pe) && fn.pe > 30
        ? 'Desaceleración del crecimiento con la valoración actual, el caso en el que la corrección de múltiplo pesa más que los resultados.'
        : 'Deterioro de márgenes o del entorno competitivo que reduzca la generación de beneficio.' },
  ];

  return {
    coverage,
    sections: [
      { id: 'resumen', title: 'Resumen', body: summary },
      { id: 'financiera', title: 'Situación financiera', findings: prof,
        empty: 'El proveedor no ha devuelto métricas de rentabilidad para este activo.' },
      { id: 'valoracion', title: 'Valoración', verdict: val,
        findings: [
          has(fn.pe) ? f(`PER de ${ratio(fn.pe)} sobre beneficios de los últimos doce meses.`) : null,
          has(fn.ps) ? f(`Precio sobre ventas de ${ratio(fn.ps)}.`) : null,
          has(fn.pb) ? f(`Precio sobre valor contable de ${ratio(fn.pb)}.`) : null,
        ].filter(Boolean),
        empty: 'Sin múltiplos disponibles no se puede valorar el activo por esta vía.' },
      { id: 'crecimiento', title: 'Crecimiento', findings: grow,
        empty: 'El proveedor no ha devuelto series de crecimiento para este activo.' },
      { id: 'mercado', title: 'Comportamiento en mercado', findings: px,
        empty: 'Sin rango anual ni volumen medio no se puede situar el precio en su contexto.' },
      { id: 'riesgos', title: 'Riesgos', list: risks },
      { id: 'catalizadores', title: 'Catalizadores', list: catalysts },
      { id: 'conclusion', title: 'Conclusión', scenarios,
        watch: [
          'Evolución de márgenes trimestre a trimestre',
          'Revisión de guías por parte de la compañía',
          has(fn.pe) ? 'Compresión o expansión del múltiplo frente a su sector' : 'Publicación de métricas de valoración',
        ] },
    ],
  };
}
