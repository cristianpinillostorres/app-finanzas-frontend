/** Valor real a pagar de una tarjeta en un periodo, anotado al llegar el extracto. */
export interface ExtractoTarjeta {
  id: string;
  creditoId: string;
  /** Periodo en formato "YYYY-MM". */
  periodo: string;
  valorAPagar: number;
}
