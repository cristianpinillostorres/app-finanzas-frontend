import type { Objetivo } from '../models';
import type { ProgresoMeta } from './metas-ahorro';
import { TOPE_CUOTAS_SALUDABLE } from './panorama-del-mes';
import type { EstadoPresupuesto, PresupuestoDelMes } from './presupuestos';

/**
 * El asistente de General: cruza cifras que la persona no ve juntas (lo que
 * permiten sus presupuestos contra lo que de verdad le queda libre, lo que
 * compró a cuotas contra lo que pagó de deuda...) y dice, en una frase, lo
 * más importante según su objetivo, con un botón que hace algo que la app ya
 * sabe hacer. Todo sale de reglas con cifras reales: ninguna cifra la inventa
 * un modelo de lenguaje.
 */

export type TemaAsistente = 'deudas' | 'gastos' | 'pagos' | 'ahorrar';

/** Qué hace el botón de la tarjeta. */
export type AccionAsistente =
  /** Lleva a una pantalla. */
  | { tipo: 'IR_A'; etiqueta: string; ruta: string }
  /**
   * Abre los topes de los presupuestos; `topes` trae los valores sugeridos
   * por categoría (vacío si no hay sugerencia). La persona revisa y guarda.
   */
  | { tipo: 'AJUSTAR_TOPES'; etiqueta: string; topes: Record<string, number> }
  /** Deja en pausa (aporte en 0) las metas con esos ids. */
  | { tipo: 'PAUSAR_METAS'; etiqueta: string; metasIds: string[] };

/** Una cifra que respalda la alerta; la tarjeta la dibuja como barra frente a las demás. */
export interface EvidenciaAsistente {
  rotulo: string;
  valor: number;
  /** Es la cifra que preocupa: la barra va en el color de alerta. */
  alerta?: boolean;
}

export interface AlertaAsistente {
  tema: TemaAsistente;
  /** 1: informativa. 2: conviene mirarla. 3: urgente. */
  gravedad: 1 | 2 | 3;
  /** La alerta completa en una frase, con sus cifras: lo que lee un lector de pantalla y lo que respalda a la IA. */
  texto: string;
  /** Titular y consejo de plantilla, sin cifras; la IA, si responde, los reemplaza. */
  titular: string;
  consejo: string;
  /** Las cifras que explican la alerta, para dibujarlas. */
  evidencia: readonly EvidenciaAsistente[];
  /**
   * Los hechos que se le dan a la IA, ya calculados (con la acción disponible
   * va aparte): ella redacta, no calcula. Solo cifras y nombres de categoría.
   */
  hechos: Readonly<Record<string, number | string>>;
  accion: AccionAsistente;
}

/** Lo que el asistente necesita saber; todo ya calculado por General. */
export interface ContextoAsistente {
  /** Lo que hay hoy en las cuentas. */
  disponible: number;
  /** Lo que falta pagar antes del próximo pago (o del fin de mes). */
  porPagar: number;
  /** Cuántos pagos suman ese `porPagar`. */
  pagosPendientes: number;
  /** Hasta cuándo cuenta: "tu pago" o "fin de mes". */
  hasta: string;
  /** Lo libre una vez apartado el ahorro del ciclo: de ahí sale lo que se puede gastar. */
  libreParaGastar: number;
  /** Lo libre antes de apartar para las metas. */
  libreAntesDeMetas: number;
  presupuestos: readonly PresupuestoDelMes[];
  cuotasDelMes: number;
  /** Qué parte de los ingresos se va en cuotas (0-1+), o `null` sin ingresos. */
  comprometido: number | null;
  estadoComprometido: EstadoPresupuesto;
  comprasACuotas: number;
  pagosDeuda: number;
  metas: readonly ProgresoMeta[];
}

/** Convierte un monto en texto: General le pasa `formatearCop`. */
export type FormatoMonto = (valor: number) => string;

const TEMAS_POR_ORDEN: readonly TemaAsistente[] = ['pagos', 'gastos', 'deudas', 'ahorrar'];

/** Los topes se sugieren de a mil pesos: cifras que una persona escribiría. */
const REDONDEO_TOPE = 1000;

function porcentaje(proporcion: number): number {
  return Math.round(proporcion * 100);
}

/** Lo que los presupuestos todavía permiten gastar (lo ya pasado no resta). */
export function restanteEnPresupuestos(presupuestos: readonly PresupuestoDelMes[]): number {
  return presupuestos.reduce((suma, p) => suma + Math.max(p.restante, 0), 0);
}

/**
 * Topes que hacen que lo que los presupuestos todavía permiten gastar
 * quepa en `libre`: lo que queda por gastar de cada uno se reduce en la
 * misma proporción, y lo ya gastado no se toca. Solo trae los que cambian.
 */
export function topesAjustadosALibre(
  presupuestos: readonly PresupuestoDelMes[],
  libre: number,
): Record<string, number> {
  const restante = restanteEnPresupuestos(presupuestos);
  if (libre <= 0 || restante <= libre) return {};
  const factor = libre / restante;
  const topes: Record<string, number> = {};
  for (const p of presupuestos) {
    if (p.restante <= 0) continue;
    const permitido = Math.floor((p.restante * factor) / REDONDEO_TOPE) * REDONDEO_TOPE;
    const nuevo = Math.min(p.tope, Math.max(REDONDEO_TOPE, Math.round(p.gastado) + permitido));
    if (nuevo !== p.tope) topes[p.categoria.id] = nuevo;
  }
  return topes;
}

function alertaDePagos(c: ContextoAsistente, fmt: FormatoMonto): AlertaAsistente | null {
  if (c.pagosPendientes === 0 || c.porPagar <= 0) return null;
  const accion: AccionAsistente = {
    tipo: 'IR_A',
    etiqueta: 'Ver pagos pendientes',
    ruta: '/pagos-fijos',
  };
  const disponible = Math.max(c.disponible, 0);
  const falta = Math.max(c.porPagar - disponible, 0);
  const hechos = { disponible, porPagar: c.porPagar, pagosPendientes: c.pagosPendientes, falta };
  const evidencia = (alerta: boolean): EvidenciaAsistente[] => [
    { rotulo: 'Disponible', valor: disponible },
    { rotulo: 'Por pagar', valor: c.porPagar, alerta },
  ];
  if (c.disponible < c.porPagar) {
    return {
      tema: 'pagos',
      gravedad: 3,
      texto: `Antes de ${c.hasta} debes pagar ${fmt(c.porPagar)} y tienes ${fmt(disponible)}: te faltan ${fmt(falta)}.`,
      titular: 'No te alcanza para tus pagos',
      consejo: 'Mira cuáles vencen primero y cuánto falta para cubrirlos.',
      evidencia: evidencia(true),
      hechos,
      accion,
    };
  }
  return {
    tema: 'pagos',
    gravedad: 1,
    texto: `Tienes cubiertos los ${fmt(c.porPagar)} que vencen antes de ${c.hasta}.`,
    titular: 'Tus pagos están cubiertos',
    consejo: 'Deja esa plata quieta hasta pagarlos.',
    evidencia: evidencia(false),
    hechos,
    accion,
  };
}

function alertaDeGastos(c: ContextoAsistente, fmt: FormatoMonto): AlertaAsistente | null {
  if (c.presupuestos.length === 0) return null;
  const restante = restanteEnPresupuestos(c.presupuestos);
  const libre = Math.max(c.libreParaGastar, 0);
  const hechosGenerales = { presupuestosPermiten: restante, libre };
  const cruce: EvidenciaAsistente[] = [
    { rotulo: 'Presupuestos permiten', valor: restante, alerta: true },
    { rotulo: `Libre hasta ${c.hasta}`, valor: libre },
  ];

  if (restante > 0 && c.libreParaGastar <= 0) {
    return {
      tema: 'gastos',
      gravedad: 3,
      texto: `Ya no te queda libre hasta ${c.hasta}, pero tus presupuestos aún permiten gastar ${fmt(restante)}.`,
      titular: 'Sin plata libre, con presupuesto por gastar',
      consejo: 'Primero cubre tus pagos: los presupuestos pueden esperar.',
      evidencia: cruce,
      hechos: hechosGenerales,
      accion: { tipo: 'IR_A', etiqueta: 'Ver pagos pendientes', ruta: '/pagos-fijos' },
    };
  }
  if (restante > c.libreParaGastar) {
    return {
      tema: 'gastos',
      gravedad: 3,
      texto: `Tus presupuestos aún permiten gastar ${fmt(restante)}, pero solo te quedan ${fmt(c.libreParaGastar)} libres hasta ${c.hasta}.`,
      titular: 'Tus presupuestos pasan lo que tienes',
      consejo: 'Baja los topes a lo que de verdad te queda para no quedarte corto.',
      evidencia: cruce,
      hechos: hechosGenerales,
      accion: {
        tipo: 'AJUSTAR_TOPES',
        etiqueta: 'Ajustar topes',
        topes: topesAjustadosALibre(c.presupuestos, c.libreParaGastar),
      },
    };
  }

  // Ya vienen de la más cerca del tope a la más lejos.
  const peor = c.presupuestos[0];
  const accion: AccionAsistente = { tipo: 'AJUSTAR_TOPES', etiqueta: 'Ajustar topes', topes: {} };
  const hechosPeor = {
    categoria: peor.categoria.nombre,
    porcentajeDelTope: porcentaje(peor.proporcion),
    gastado: peor.gastado,
    tope: peor.tope,
  };
  const gastadoFrenteAlTope = (alerta: boolean): EvidenciaAsistente[] => [
    { rotulo: 'Gastado', valor: peor.gastado, alerta },
    { rotulo: 'Tope', valor: peor.tope },
  ];
  if (peor.estado === 'pasado') {
    return {
      tema: 'gastos',
      gravedad: 2,
      texto: `${peor.categoria.nombre} ya pasó su tope por ${fmt(-peor.restante)}.`,
      titular: `${peor.categoria.nombre} pasó su tope`,
      consejo: 'Frena ese gasto lo que queda del ciclo o sube el tope si fue a propósito.',
      evidencia: gastadoFrenteAlTope(true),
      hechos: hechosPeor,
      accion,
    };
  }
  if (peor.estado === 'cerca') {
    return {
      tema: 'gastos',
      gravedad: peor.ritmoAlto ? 2 : 1,
      texto: peor.ritmoAlto
        ? `${peor.categoria.nombre} va al ${porcentaje(peor.proporcion)} % de su tope y gastas más rápido de lo que avanza el mes.`
        : `${peor.categoria.nombre} va al ${porcentaje(peor.proporcion)} % de su tope.`,
      titular: peor.ritmoAlto
        ? `${peor.categoria.nombre} va más rápido que el mes`
        : `${peor.categoria.nombre} está cerca del tope`,
      consejo: peor.ritmoAlto
        ? 'A este ritmo se agota antes de que termine el ciclo.'
        : 'Te queda poco margen en esta categoría.',
      evidencia: gastadoFrenteAlTope(false),
      hechos: { ...hechosPeor, vaMasRapidoQueElMes: peor.ritmoAlto ? 'sí' : 'no' },
      accion,
    };
  }
  return null;
}

function alertaDeDeudas(c: ContextoAsistente, fmt: FormatoMonto): AlertaAsistente | null {
  if (c.comprometido === null || c.cuotasDelMes <= 0) return null;
  const pct = porcentaje(c.comprometido);
  const margen =
    c.estadoComprometido === 'pasado'
      ? 'margen crítico'
      : c.estadoComprometido === 'cerca'
        ? 'margen justo'
        : 'margen sano';
  const gravedad = c.estadoComprometido === 'pasado' ? 3 : c.estadoComprometido === 'cerca' ? 2 : 1;
  const accion: AccionAsistente = { tipo: 'IR_A', etiqueta: 'Ver mis créditos', ruta: '/creditos' };

  // Compró más a cuotas de lo que pagó de deuda: la deuda subió este mes.
  if (c.comprasACuotas > 0 && c.comprasACuotas > c.pagosDeuda) {
    return {
      tema: 'deudas',
      gravedad: Math.max(gravedad, 2) as 2 | 3,
      texto: `Este mes compraste ${fmt(c.comprasACuotas)} a cuotas y pagaste ${fmt(c.pagosDeuda)} de deuda: tu deuda subió. Tus cuotas ya son el ${pct} % de tus ingresos.`,
      titular: 'Tu deuda subió este mes',
      consejo: 'Compraste más a cuotas de lo que pagaste: piénsalo antes de sumar otra cuota.',
      evidencia: [
        { rotulo: 'Compras a cuotas', valor: c.comprasACuotas, alerta: true },
        { rotulo: 'Pagos de deuda', valor: c.pagosDeuda },
      ],
      hechos: {
        comprasACuotas: c.comprasACuotas,
        pagosDeuda: c.pagosDeuda,
        porcentajeDeIngresosEnCuotas: pct,
      },
      accion,
    };
  }

  // El tope saludable en pesos sale del ingreso con que se mide (cuotas / proporción).
  const topeEnPesos =
    c.comprometido > 0
      ? Math.round((c.cuotasDelMes / c.comprometido) * TOPE_CUOTAS_SALUDABLE)
      : null;
  const textos = {
    pasado: ['Tus cuotas pesan demasiado', 'Evita nuevas cuotas hasta bajar de ese nivel.'],
    cerca: ['Tus cuotas empiezan a apretar', 'Cuidado con sumar otra cuota por ahora.'],
    bien: ['Tus cuotas están bajo control', 'Hay margen, pero cada cuota nueva lo reduce.'],
  } as const;
  const [titular, consejo] = textos[c.estadoComprometido];
  return {
    tema: 'deudas',
    gravedad,
    texto: `Tus cuotas se llevan el ${pct} % de tus ingresos este mes: ${margen}.`,
    titular,
    consejo,
    evidencia: [
      { rotulo: 'Cuotas del mes', valor: c.cuotasDelMes, alerta: gravedad > 1 },
      ...(topeEnPesos !== null ? [{ rotulo: 'Tope saludable', valor: topeEnPesos }] : []),
    ],
    hechos: { cuotasDelMes: c.cuotasDelMes, porcentajeDeIngresosEnCuotas: pct, margen },
    accion,
  };
}

function alertaDeAhorro(c: ContextoAsistente, fmt: FormatoMonto): AlertaAsistente | null {
  const activas = c.metas.filter((p) => !p.cumplida && p.meta.aporteMensual > 0);
  if (activas.length === 0) return null;
  const pendiente = activas.reduce((suma, p) => suma + p.aporteFaltante, 0);
  const libre = Math.max(c.libreAntesDeMetas, 0);
  const irAMetas: AccionAsistente = { tipo: 'IR_A', etiqueta: 'Ver mis metas', ruta: '/ahorro' };
  const hechos = { porApartar: pendiente, libre, metasActivas: activas.length };

  if (pendiente <= 0) {
    return {
      tema: 'ahorrar',
      gravedad: 1,
      texto: 'Ya apartaste lo de este ciclo para tus metas.',
      titular: 'Tus metas van al día',
      consejo: 'Ya apartaste lo de este ciclo.',
      evidencia: [],
      hechos,
      accion: irAMetas,
    };
  }
  const evidencia: EvidenciaAsistente[] = [
    { rotulo: 'Por apartar', valor: pendiente, alerta: pendiente > libre },
    { rotulo: 'Libre', valor: libre },
  ];
  if (pendiente > c.libreAntesDeMetas) {
    return {
      tema: 'ahorrar',
      gravedad: 3,
      texto: `Te faltan ${fmt(pendiente)} por apartar para tus metas y solo tienes ${fmt(libre)} libres.`,
      titular: 'No te alcanza para tus metas',
      consejo: 'Puedes pausarlas y retomarlas cuando tengas más libre.',
      evidencia,
      hechos,
      accion: {
        tipo: 'PAUSAR_METAS',
        etiqueta: 'Pausar mis metas',
        metasIds: activas.map((p) => p.meta.id),
      },
    };
  }
  return {
    tema: 'ahorrar',
    gravedad: 2,
    texto: `Te faltan ${fmt(pendiente)} por apartar este ciclo para tus metas.`,
    titular: 'Aún te falta apartar para tus metas',
    consejo: 'Tienes con qué: hazlo ahora, antes de gastarlo en otra cosa.',
    evidencia,
    hechos,
    accion: irAMetas,
  };
}

const REGLAS: Record<
  TemaAsistente,
  (c: ContextoAsistente, fmt: FormatoMonto) => AlertaAsistente | null
> = {
  pagos: alertaDePagos,
  gastos: alertaDeGastos,
  deudas: alertaDeDeudas,
  ahorrar: alertaDeAhorro,
};

/** La más urgente de todas (gravedad 2 o más); ante empate, el orden de `TEMAS_POR_ORDEN`. */
function laMasImportante(c: ContextoAsistente, fmt: FormatoMonto): AlertaAsistente | null {
  let mejor: AlertaAsistente | null = null;
  for (const tema of TEMAS_POR_ORDEN) {
    const alerta = REGLAS[tema](c, fmt);
    if (alerta && alerta.gravedad >= 2 && (!mejor || alerta.gravedad > mejor.gravedad)) {
      mejor = alerta;
    }
  }
  return mejor;
}

const TEMA_DEL_OBJETIVO: Partial<Record<Objetivo, TemaAsistente>> = {
  deudas: 'deudas',
  ahorrar: 'ahorrar',
  gastos: 'gastos',
  pagos: 'pagos',
};

/**
 * Lo que dice el asistente: la alerta del tema que más le importa a la
 * persona. Si ese tema no tiene nada que decir, o eligió "orden" (o nada), dice
 * la más urgente de todas. `null` si no hay nada que avisar.
 */
export function alertaDelAsistente(
  objetivo: Objetivo | null,
  contexto: ContextoAsistente,
  formato: FormatoMonto,
): AlertaAsistente | null {
  const tema = objetivo ? TEMA_DEL_OBJETIVO[objetivo] : undefined;
  const propia = tema ? REGLAS[tema](contexto, formato) : null;
  return propia ?? laMasImportante(contexto, formato);
}

/** Identifica las cifras de una alerta: si cambian, el texto de la IA que se pidió antes ya no vale. */
export function claveDeAlerta(alerta: AlertaAsistente): string {
  return `${alerta.tema}:${JSON.stringify(alerta.hechos)}`;
}

/**
 * ¿Se puede mostrar el texto que escribió la IA? Solo si no inventó cifras: toda
 * cifra que escriba tiene que ser uno de los hechos que se le dieron (en la
 * práctica, un porcentaje). A la IA se le pide que no escriba montos; esto
 * lo comprueba, porque una cifra de dinero inventada es peor que ninguna.
 */
export function textoDeIaValido(texto: string, alerta: AlertaAsistente): boolean {
  const permitidas = new Set(
    Object.values(alerta.hechos).filter((v): v is number => typeof v === 'number'),
  );
  const cifras = texto.match(/\d[\d.,]*/g) ?? [];
  return cifras.every((c) => permitidas.has(Number(c.replace(/[.,]/g, ''))));
}
