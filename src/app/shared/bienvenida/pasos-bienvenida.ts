/**
 * Lo que ya existe en la cuenta del usuario: cada paso de la bienvenida se
 * marca solo con esto, nunca a mano. Cada función nueva que agregue un
 * paso suma acá el dato que necesita.
 */
export interface ContextoBienvenida {
  cuentas: number;
  /** Si ya creó o adaptó alguna categoría (ver `hayCategoriasAjustadas`). */
  categoriasAjustadas: boolean;
  creditos: number;
  pagosFijos: number;
  movimientos: number;
  /** Categorías con tope mensual. */
  presupuestos: number;
}

export type BloqueBienvenida = 'esencial' | 'extra';

/** A dónde lleva un paso: una tab, o el formulario del botón "+". */
export type DestinoPaso = { ruta: string } | 'nuevo-movimiento';

export interface PasoBienvenida {
  id: string;
  bloque: BloqueBienvenida;
  titulo: string;
  descripcion: string;
  icono: string;
  /**
   * Qué hacer en la pantalla del paso: lo que dice la franja guía
   * (`GuiaPaso`) al llegar desde la bienvenida.
   */
  guia: string;
  destino: DestinoPaso;
  hecho: (c: ContextoBienvenida) => boolean;
  /** Si el paso tiene sentido para esta persona; sin esto, siempre. */
  aplica?: (c: ContextoBienvenida) => boolean;
  /**
   * Texto del botón para saltarlo ("No tengo deudas"). Va en la franja
   * guía, no en el checklist: la decisión se toma viendo la pantalla. Sin
   * esto, el paso no se puede saltar: es parte de lo mínimo para que la
   * app sirva.
   */
  omitir?: string;
}

/**
 * Los pasos de la bienvenida, en orden. Dos bloques:
 *
 * - **esencial**: lo mínimo para que "Te queda libre" diga algo cierto.
 * - **extra** ("Sácale más provecho"): un paso por cada función que va
 *   más allá de registrar. Aparece cuando lo esencial está listo, así el
 *   checklist nunca pasa de un puñado de pasos a la vez.
 *
 * Una función nueva entra a la bienvenida agregando su paso acá (bloque
 * `extra`, con `omitir: 'No me interesa'`); el panel no cambia.
 */
export const PASOS_BIENVENIDA: PasoBienvenida[] = [
  {
    id: 'cuentas',
    bloque: 'esencial',
    titulo: 'Crea tu primera cuenta',
    descripcion: 'Banco, billetera digital o efectivo: donde tienes tu plata.',
    icono: 'account_balance',
    guia: 'Toca «Agregar cuenta» y crea la primera: tu banco, tu billetera digital o el efectivo. El saldo inicial es lo que tienes hoy; desde ahí la app lo lleva sola.',
    destino: { ruta: '/cuentas' },
    hecho: (c) => c.cuentas > 0,
  },
  {
    id: 'categorias',
    bloque: 'esencial',
    titulo: 'Ajusta tus categorías',
    descripcion: 'Crea las tuyas o renombra las que vienen: Mascotas, Gimnasio, Colegio…',
    icono: 'sell',
    guia: 'Con estas categorías clasificas tus gastos e ingresos. Renombra las que quieras con el lápiz, oculta las que no usas con el ojo, o crea las tuyas con «Nueva categoría».',
    destino: { ruta: '/categorias' },
    hecho: (c) => c.categoriasAjustadas,
    omitir: 'Me sirven las que vienen',
  },
  {
    id: 'creditos',
    bloque: 'esencial',
    titulo: 'Agrega tus tarjetas o créditos',
    descripcion: 'Tarjetas, préstamos, compras a cuotas o lo que le debes a alguien.',
    icono: 'credit_card',
    guia: 'Agrega cada tarjeta, préstamo, compra a cuotas y lo que le debes a alguien. Así sabrás cuánto pagas al mes y cuántas cuotas te faltan.',
    destino: { ruta: '/creditos' },
    hecho: (c) => c.creditos > 0,
    omitir: 'No tengo deudas',
  },
  {
    id: 'pagosFijos',
    bloque: 'esencial',
    titulo: 'Registra tus pagos fijos',
    descripcion: 'Arriendo, servicios, suscripciones: lo que pagas cada mes.',
    icono: 'event_repeat',
    guia: 'Agrega lo que pagas todos los meses: arriendo, servicios, suscripciones. Con esto la app calcula cuánto te queda libre.',
    destino: { ruta: '/pagos-fijos' },
    hecho: (c) => c.pagosFijos > 0,
  },
  {
    id: 'movimientos',
    bloque: 'esencial',
    titulo: 'Registra tu primer gasto o ingreso',
    descripcion: 'Con el botón + desde cualquier pantalla. Toma segundos.',
    icono: 'add_circle',
    guia: 'Elige gasto o ingreso, el monto y la cuenta. Desde ahora, el botón + está en todas las pantallas.',
    destino: 'nuevo-movimiento',
    hecho: (c) => c.movimientos > 0,
  },
  {
    id: 'presupuesto',
    bloque: 'extra',
    titulo: 'Ponle tope a una categoría',
    descripcion: 'Te avisamos cuando vas por el 80 %, antes de pasarte.',
    icono: 'speed',
    guia: 'Toca el lápiz de una categoría de gasto, como Restaurantes, y escribe en «Tope mensual» lo máximo que quieres gastar ahí al mes. Lo verás en General.',
    destino: { ruta: '/categorias' },
    hecho: (c) => c.presupuestos > 0,
    omitir: 'No me interesa',
  },
];

export type EstadoPaso = 'hecho' | 'omitido' | 'pendiente';

export interface PasoEnPanel {
  paso: PasoBienvenida;
  estado: EstadoPaso;
}

export interface EstadoBienvenida {
  bloque: BloqueBienvenida;
  pasos: PasoEnPanel[];
  /** Hechos u omitidos: los dos cuentan como resueltos para el progreso. */
  resueltos: number;
}

/**
 * Qué muestra el panel de bienvenida: el bloque esencial mientras le falte
 * algo; después, el de extras mientras le falte algo; y `null` cuando no
 * queda nada pendiente (o no hay extras todavía).
 */
export function estadoBienvenida(
  pasos: readonly PasoBienvenida[],
  contexto: ContextoBienvenida,
  omitidos: ReadonlySet<string>,
): EstadoBienvenida | null {
  for (const bloque of ['esencial', 'extra'] as const) {
    const delBloque: PasoEnPanel[] = pasos
      .filter((p) => p.bloque === bloque && (p.aplica?.(contexto) ?? true))
      .map((paso) => ({
        paso,
        estado: paso.hecho(contexto)
          ? 'hecho'
          : paso.omitir && omitidos.has(paso.id)
            ? 'omitido'
            : 'pendiente',
      }));
    const resueltos = delBloque.filter((p) => p.estado !== 'pendiente').length;
    if (resueltos < delBloque.length) return { bloque, pasos: delBloque, resueltos };
  }
  return null;
}
