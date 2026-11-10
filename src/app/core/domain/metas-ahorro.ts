import type { Cuenta, MetaAhorro, Movimiento } from '../models';
import { saldoCuenta } from './cuentas';
import { fechaIsoDesdeLocal } from './fechas';

/** Cómo va una meta: lo ahorrado, lo que falta y lo que toca apartar este ciclo. */
export interface ProgresoMeta {
  meta: MetaAhorro;
  /** Lo que hay hoy en el bolsillo de la meta (nunca negativo). */
  ahorrado: number;
  /** Lo que falta para el objetivo (0 si ya se alcanzó). */
  falta: number;
  /** Lo ahorrado sobre el objetivo; 1 o más es meta cumplida. */
  proporcion: number;
  cumplida: boolean;
  /** Lo que entró al bolsillo en lo que va del ciclo de pago. */
  aportadoEnCiclo: number;
  /** Lo que todavía falta apartar este ciclo para cumplir el aporte mensual. */
  aporteFaltante: number;
  /** Meses que tomaría llegar al objetivo al ritmo del aporte; `null` si no hay aporte o ya llegó. */
  mesesParaLlegar: number | null;
  /** El bolsillo ya no existe o está archivado: la meta no puede contar lo ahorrado. */
  sinBolsillo: boolean;
  /** Sin cifra final: solo se ahorra. No hay barra, ni "falta", ni fecha de llegada. */
  sinObjetivo: boolean;
}

/**
 * Cuánto se aportó a un bolsillo desde `desde`: lo que entró menos lo que
 * salió, sin bajar de cero. Cuenta cualquier movimiento (apartar desde la
 * cuenta, una transferencia, un ingreso directo): lo que importa es que la
 * plata esté en el bolsillo.
 */
export function aportadoAlBolsillo(
  bolsilloId: string,
  movimientos: readonly Movimiento[],
  desde: Date,
): number {
  const desdeIso = fechaIsoDesdeLocal(desde);
  let neto = 0;
  for (const m of movimientos) {
    if (m.fecha < desdeIso) continue;
    if (m.cuentaDestinoId === bolsilloId) neto += m.monto;
    if (m.cuentaOrigenId === bolsilloId) neto -= m.monto;
  }
  return Math.max(neto, 0);
}

export function progresoDeMeta(
  meta: MetaAhorro,
  cuentas: readonly Cuenta[],
  movimientos: readonly Movimiento[],
  inicioDelCiclo: Date,
): ProgresoMeta {
  const bolsillo = cuentas.find((c) => c.id === meta.bolsilloId && !c.archivada);
  const ahorrado = bolsillo ? Math.max(saldoCuenta(bolsillo, movimientos as Movimiento[]), 0) : 0;
  const sinObjetivo = meta.objetivo <= 0;
  const falta = sinObjetivo ? 0 : Math.max(meta.objetivo - ahorrado, 0);
  const cumplida = !sinObjetivo && falta === 0;
  const aportadoEnCiclo = bolsillo
    ? aportadoAlBolsillo(meta.bolsilloId, movimientos, inicioDelCiclo)
    : 0;
  const porAportar = Math.max(meta.aporteMensual - aportadoEnCiclo, 0);
  // Con objetivo, nunca se pide apartar más de lo que falta para llegar.
  const aporteFaltante = cumplida ? 0 : sinObjetivo ? porAportar : Math.min(porAportar, falta);
  return {
    meta,
    ahorrado,
    falta,
    proporcion: sinObjetivo ? 0 : ahorrado / meta.objetivo,
    cumplida,
    aportadoEnCiclo,
    aporteFaltante,
    mesesParaLlegar:
      !sinObjetivo && !cumplida && meta.aporteMensual > 0
        ? Math.ceil(falta / meta.aporteMensual)
        : null,
    sinBolsillo: !bolsillo,
    sinObjetivo,
  };
}

/** Lo que toca apartar este ciclo entre todas las metas. */
export function aporteFaltanteTotal(progresos: readonly ProgresoMeta[]): number {
  return progresos.reduce((acc, p) => acc + p.aporteFaltante, 0);
}

/**
 * Lo libre para gastar una vez apartado el ahorro del ciclo. Lo apartado no
 * pasa de lo que hay libre: ahorrar no deja el día a día en negativo, y quien
 * no alcanza a aportar todo lo planeado ve el gasto diario en cero, no un
 * número imposible.
 */
export function libreDespuesDeAhorrar(libre: number, aporteFaltante: number): number {
  if (libre <= 0) return libre;
  return libre - Math.min(aporteFaltante, libre);
}
