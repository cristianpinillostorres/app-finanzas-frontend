/** Los cuatro grupos que se muestran en la tab Créditos. */
export type GrupoCredito = 'TARJETA' | 'BANCO' | 'PLATAFORMA' | 'PERSONA';

/** Solo aplica a créditos con bancos. */
export type TipoTasa = 'FIJA' | 'VARIABLE';

interface CreditoBase {
  id: string;
  nombre: string;
  entidad?: string;
  /** Día del mes límite de pago (1-31). */
  diaPago: number;
  archivado: boolean;
  /**
   * Cuándo se registró el crédito en la app (ISO). Las cuotas que vencieron
   * antes no se cobran: se pagaron por fuera. Los créditos creados antes de
   * existir este campo no lo tienen (ver `primerMesLlevado`).
   */
  creadoEn?: string;
}

/** Cupo con compras a cuotas. La deuda es la suma de cuotas pendientes de sus compras. */
export interface CreditoTarjeta extends CreditoBase {
  grupo: 'TARJETA';
  ultimos4?: string;
  cupo: number;
  /** Día de corte del extracto. */
  diaCorte: number;
}

/** Cupo con compras a cuotas; cada compra es un plan separado (Addi, Sistecrédito). */
export interface CreditoPlataforma extends CreditoBase {
  grupo: 'PLATAFORMA';
  cupo: number;
}

/** Préstamo de cuota fija con tabla de amortización (libre inversión, vehículo, vivienda...). */
export interface CreditoBanco extends CreditoBase {
  grupo: 'BANCO';
  /** Monto prestado originalmente. */
  monto: number;
  /** Tasa efectiva anual, como fracción (0.24 = 24%). */
  tasaEa: number;
  tipoTasa: TipoTasa;
  plazoMeses: number;
  /** Cuotas ya pagadas antes de empezar a registrar en la app. */
  cuotasPagadasIniciales: number;
  seguroMensual: number;
}

/** Deuda informal con abonos. Puede no tener intereses ni fecha fija. */
export interface CreditoPersona extends CreditoBase {
  grupo: 'PERSONA';
  monto: number;
  fechaAcordada?: string;
}

export type Credito = CreditoTarjeta | CreditoPlataforma | CreditoBanco | CreditoPersona;

export function esCuotaCredito(credito: Credito): credito is CreditoTarjeta | CreditoPlataforma {
  return credito.grupo === 'TARJETA' || credito.grupo === 'PLATAFORMA';
}

/**
 * `Omit` normal colapsa una unión a sus propiedades comunes. Esta variante
 * distribuye sobre cada miembro para que `NuevoCredito` conserve los campos
 * propios de cada grupo (cupo, monto, tasaEa...).
 */
type OmitDistributivo<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Datos que pide el formulario para crear un crédito, sin `id` ni `archivado`. */
export type NuevoCredito = OmitDistributivo<Credito, 'id' | 'archivado' | 'creadoEn'>;
