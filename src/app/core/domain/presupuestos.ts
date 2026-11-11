import type { Categoria, Movimiento } from '../models';
import type { Periodo } from './fechas';
import { perteneceAlPeriodo } from './fechas';

/**
 * `bien`: por debajo del 80 % del tope. `cerca`: del 80 % al tope.
 * `pasado`: por encima. El aviso amarillo llega antes de pasarse, que es
 * cuando todavía sirve.
 */
export type EstadoPresupuesto = 'bien' | 'cerca' | 'pasado';

const UMBRAL_CERCA = 0.8;

/** La categoría donde caen los gastos de las categorías que no tienen tope. */
export const CATEGORIA_OTROS_GASTOS = 'cat-otros-gastos';

export interface PresupuestoDelMes {
  categoria: Categoria;
  gastado: number;
  /** Cuánto de `gastado` viene de categorías sin tope (solo en "Otros gastos"). */
  deOtras: number;
  tope: number;
  /** gastado / tope, sin recortar: 1.25 es "te pasaste un 25 %". */
  proporcion: number;
  /** Lo que queda antes del tope; negativo si ya se pasó. */
  restante: number;
  estado: EstadoPresupuesto;
  /** Se gasta bastante más rápido de lo que avanza el mes (aviso antes del 80 %). */
  ritmoAlto: boolean;
}

/** Los primeros días del mes no dicen nada: una compra grande dispara cualquier ritmo. */
const DIA_MINIMO_PARA_RITMO = 5;
/** Gasta 1,2 veces más rápido que el mes o más. */
const FACTOR_DE_RITMO = 1.2;
/** Con menos de la mitad del tope gastada todavía no hay de qué avisar. */
const PROPORCION_MINIMA_PARA_RITMO = 0.5;

/** Qué parte del mes ya pasó (0-1), contando el día de hoy. */
export function avanceDelMes(hoy: Date): number {
  const dias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return hoy.getDate() / dias;
}

function vaMasRapidoQueElMes(proporcion: number, avance: number | null): boolean {
  if (avance === null || proporcion < PROPORCION_MINIMA_PARA_RITMO) return false;
  // Fracción mínima = día 5 de un mes de 31 días; basta con ser algo conservador.
  if (avance < DIA_MINIMO_PARA_RITMO / 31) return false;
  return proporcion / avance > FACTOR_DE_RITMO;
}

/**
 * Las categorías de gasto con tope (presupuesto) y cuánto se lleva gastado
 * en cada una este mes, de la más cerca del tope a la más lejos — lo que
 * pide atención primero. Las ocultas no entran: ya no se registra en ellas.
 */
export function presupuestosDelMes(
  categorias: readonly Categoria[],
  movimientos: readonly Movimiento[],
  periodo: Periodo,
  avance: number | null = null,
): PresupuestoDelMes[] {
  const conTope = categorias.filter(
    (c) => c.tipo === 'GASTO' && !c.archivada && (c.topeMensual ?? 0) > 0,
  );
  if (conTope.length === 0) return [];

  const conTopeIds = new Set(conTope.map((c) => c.id));
  const hayOtros = conTopeIds.has(CATEGORIA_OTROS_GASTOS);

  const gastado = new Map<string, number>();
  let sinPresupuesto = 0;
  for (const m of movimientos) {
    if (m.tipo !== 'GASTO' || !perteneceAlPeriodo(m.fecha, periodo)) continue;
    if (m.categoriaId && conTopeIds.has(m.categoriaId)) {
      gastado.set(m.categoriaId, (gastado.get(m.categoriaId) ?? 0) + m.monto);
    } else {
      sinPresupuesto += m.monto;
    }
  }

  return conTope
    .map((categoria) => {
      const tope = categoria.topeMensual!;
      // Lo que no tiene tope propio cae en "Otros gastos", si ese sí lo tiene.
      const deOtras = hayOtros && categoria.id === CATEGORIA_OTROS_GASTOS ? sinPresupuesto : 0;
      const total = (gastado.get(categoria.id) ?? 0) + deOtras;
      const proporcion = total / tope;
      const estado = estadoDe(proporcion);
      const ritmoAlto = estado === 'bien' && vaMasRapidoQueElMes(proporcion, avance);
      return {
        categoria,
        gastado: total,
        deOtras,
        tope,
        proporcion,
        restante: tope - total,
        // Aviso temprano: el amarillo llega antes del 80 % si se gasta mucho más rápido que el mes.
        estado: ritmoAlto ? 'cerca' : estado,
        ritmoAlto,
      };
    })
    .sort((a, b) => b.proporcion - a.proporcion);
}

function estadoDe(proporcion: number): EstadoPresupuesto {
  if (proporcion > 1) return 'pasado';
  if (proporcion >= UMBRAL_CERCA) return 'cerca';
  return 'bien';
}
