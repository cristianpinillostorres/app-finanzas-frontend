/** Historial de tasa E.A. para créditos con bancos de tasa variable (IBR o DTF + puntos). */
export interface CambioTasa {
  id: string;
  creditoId: string;
  fechaDesde: string;
  /** Tasa efectiva anual vigente desde `fechaDesde`, como fracción (0.24 = 24%). */
  tasaEa: number;
}
