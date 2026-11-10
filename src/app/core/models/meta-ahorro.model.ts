/**
 * Una meta de ahorro: algo que se quiere juntar (un viaje, la prima, un
 * colchón) y cuánto se piensa apartar cada mes.
 *
 * La plata de la meta vive en un bolsillo reservado (ver `Cuenta`): el
 * progreso es el saldo de ese bolsillo, así que no hay una segunda cifra que
 * cuadrar. La meta solo agrega el objetivo y el aporte.
 */
export interface MetaAhorro {
  id: string;
  nombre: string;
  /** Cuánto se quiere juntar en total; 0 si solo se quiere ahorrar, sin una cifra final. */
  objetivo: number;
  /** Cuánto se piensa apartar cada ciclo de pago; 0 la deja en pausa. */
  aporteMensual: number;
  /** Bolsillo (cuenta con `cuentaPadreId`) donde está la plata de la meta. */
  bolsilloId: string;
}
