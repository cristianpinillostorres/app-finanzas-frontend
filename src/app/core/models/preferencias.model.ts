import type { MetaAhorro } from './meta-ahorro.model';

/**
 * Lo que la persona quiere lograr con la app; lo elige en la bienvenida.
 * Ordena las funciones que se le sugieren (ver `PasoBienvenida.objetivos`).
 */
export type Objetivo = 'deudas' | 'ahorrar' | 'gastos' | 'pagos' | 'orden';

/**
 * Lo que la persona decidió sobre la app (no datos financieros), guardado en
 * su cuenta para que la siga en cualquier dispositivo o navegador.
 */
export interface Preferencias {
  /** El recorrido de bienvenida (ver `BienvenidaService`). */
  recorrido: {
    /** Tocó "Saltar recorrido" o lo ocultó desde General. */
    oculto: boolean;
    /** Pasos que dijo que no aplican ("No tengo deudas"...), por id. */
    omitidos: string[];
  };
  /** Última cuenta usada para pagar un gasto y para recibir un ingreso, por id. */
  ultimaCuenta: {
    gasto: string | null;
    ingreso: string | null;
  };
  /** Lo que eligió en "¿Qué quieres lograr?"; vacío si no eligió nada. */
  objetivos: Objetivo[];
  /**
   * Lo más importante ahora, uno solo: decide qué cifra encabeza General (ver
   * `vistaDelHeroe`). `null` si todavía no lo eligió.
   */
  objetivoPrincipal: Objetivo | null;
  /** Cómo prefiere que la llamemos; `null` si no lo dijo. */
  nombre: string | null;
  /**
   * Día del mes (1-31) en que le pagan; `null` si no tiene uno fijo. Con
   * él General cuenta "lo que te queda libre" hasta ese día y no hasta fin de
   * mes (ver `libreHastaProximoPago`).
   */
  diaDePago: number | null;
  /** Con cuántos días de anticipación un pago pasa a amarillo y a rojo (ver `UmbralesAviso`). */
  avisos: { amarillo: number; rojo: number };
  /** Lo que quiere ahorrar, con su aporte mensual (ver `MetaAhorro`). */
  metasAhorro: MetaAhorro[];
  /**
   * Ids de las categorías de ingreso con que se mide lo que se paga en cuotas
   * (ver `ingresoMensualDeReferencia`). `null`: todas las de ingreso menos los
   * reembolsos, también las que se creen después.
   */
  categoriasDeIngreso: string[] | null;
}

/** Cambios parciales: solo los campos que vienen se escriben. */
export interface CambiosPreferencias {
  recorrido?: Partial<Preferencias['recorrido']>;
  ultimaCuenta?: Partial<Preferencias['ultimaCuenta']>;
  objetivos?: Objetivo[];
  objetivoPrincipal?: Objetivo | null;
  nombre?: string | null;
  diaDePago?: number | null;
  avisos?: Partial<Preferencias['avisos']>;
  /** La lista completa: lo que viene reemplaza lo anterior. */
  metasAhorro?: MetaAhorro[];
  /** La lista completa, o `null` para volver a "todas menos reembolsos". */
  categoriasDeIngreso?: string[] | null;
}

/** Lo que vale mientras la persona no haya decidido nada. */
export const PREFERENCIAS_INICIALES: Preferencias = {
  recorrido: { oculto: false, omitidos: [] },
  ultimaCuenta: { gasto: null, ingreso: null },
  objetivos: [],
  objetivoPrincipal: null,
  nombre: null,
  diaDePago: null,
  // Los mismos de `UMBRALES_INICIALES` (core/domain/semaforo.ts): el modelo no importa del dominio.
  avisos: { amarillo: 4, rojo: 1 },
  metasAhorro: [],
  categoriasDeIngreso: null,
};

/**
 * Lo que se guarda al elegir (o quitar) el objetivo: uno solo, que manda en
 * General y también ordena lo que la bienvenida sugiere (`objetivos` queda
 * como lista de ese único objetivo).
 */
export function cambiosDeObjetivo(objetivo: Objetivo | null): CambiosPreferencias {
  return { objetivoPrincipal: objetivo, objetivos: objetivo ? [objetivo] : [] };
}

/** Todos los objetivos, para validar lo que llega guardado. */
export const OBJETIVOS: readonly Objetivo[] = ['deudas', 'ahorrar', 'gastos', 'pagos', 'orden'];
