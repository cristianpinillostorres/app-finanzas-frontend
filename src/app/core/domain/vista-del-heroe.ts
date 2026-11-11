import type { Objetivo } from '../models';

/** Qué cifra encabeza General: cada una responde la pregunta de un objetivo. */
export type VistaDelHeroe = 'gasto' | 'ahorro' | 'deudas' | 'pagos';

/** Lo que hay en la cuenta, para saber si la vista del objetivo tiene algo que mostrar. */
export interface ContextoHeroe {
  hayMetas: boolean;
  hayDeudas: boolean;
  hayPagosPendientes: boolean;
}

/**
 * La vista del héroe según el objetivo principal. Si el objetivo no tiene
 * con qué mostrarse (quiere ahorrar pero no creó una meta, quiere salir de
 * deudas pero no tiene créditos) vuelve a la vista de gasto: un héroe en $0
 * no ayuda a nadie. "Controlar gastos", "tenerlo todo en un lugar" y no
 * haber elegido nada comparten la vista de siempre.
 */
export function vistaDelHeroe(objetivo: Objetivo | null, contexto: ContextoHeroe): VistaDelHeroe {
  switch (objetivo) {
    case 'ahorrar':
      return contexto.hayMetas ? 'ahorro' : 'gasto';
    case 'deudas':
      return contexto.hayDeudas ? 'deudas' : 'gasto';
    case 'pagos':
      return contexto.hayPagosPendientes ? 'pagos' : 'gasto';
    default:
      return 'gasto';
  }
}
