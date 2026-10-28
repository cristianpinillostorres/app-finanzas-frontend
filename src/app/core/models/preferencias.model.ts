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
}

/** Cambios parciales: solo los campos que vienen se escriben. */
export interface CambiosPreferencias {
  recorrido?: Partial<Preferencias['recorrido']>;
  ultimaCuenta?: Partial<Preferencias['ultimaCuenta']>;
}

/** Lo que vale mientras la persona no haya decidido nada. */
export const PREFERENCIAS_INICIALES: Preferencias = {
  recorrido: { oculto: false, omitidos: [] },
  ultimaCuenta: { gasto: null, ingreso: null },
};
