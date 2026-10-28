/** Tipo de una cuenta raíz. No aplica a los bolsillos. */
export type TipoCuenta = 'BANCO' | 'BILLETERA' | 'EFECTIVO' | 'OTRO';

/**
 * Cuenta o bolsillo.
 *
 * Cuentas y bolsillos viven en el mismo modelo: un bolsillo es una cuenta con
 * `cuentaPadreId` distinto de `null`. El "saldo libre" de una cuenta madre es
 * la propia fila; el total de la cuenta (lo que se muestra en Cuentas) es
 * `saldoLibre + suma de bolsillos` y nunca se edita a mano — ver
 * `saldoCuenta` en `core/domain`.
 */
export interface Cuenta {
  id: string;
  /** Nombre visible, ej. "Bancolombia" o "Viaje" para un bolsillo. */
  nombre: string;
  /** Solo aplica a cuentas raíz (`cuentaPadreId` nulo). */
  tipo: TipoCuenta;
  /** Entidad, ej. "Bancolombia", "Nequi". Opcional en cuentas tipo OTRO. */
  entidad?: string;
  /** Últimos 4 dígitos, solo para distinguir cuentas del mismo banco. */
  ultimos4?: string;
  /** Color para reconocer la cuenta rápido. Token semántico o hex de acento. */
  color: string;
  /** `null` si es cuenta principal; id de la cuenta madre si es un bolsillo. */
  cuentaPadreId: string | null;
  /** Saldo desde el que se calculan los movimientos posteriores. */
  saldoInicial: number;
  /** Cuentas raíz: si el saldo libre suma en el disponible general. */
  sumaEnDisponible: boolean;
  /** Bolsillos: si está reservado y por lo tanto no suma en el disponible. */
  reservado: boolean;
  /** No se borra si tiene movimientos, para no dañar el historial. */
  archivada: boolean;
  creadoEn: string;
}

/** Datos que pide el formulario para crear una cuenta raíz. */
export type NuevaCuenta = Omit<
  Cuenta,
  'id' | 'creadoEn' | 'archivada' | 'cuentaPadreId' | 'reservado'
>;

/** Datos que pide el formulario para crear un bolsillo dentro de una cuenta. */
export type NuevoBolsillo = Omit<
  Cuenta,
  'id' | 'creadoEn' | 'archivada' | 'tipo' | 'entidad' | 'ultimos4' | 'sumaEnDisponible'
>;
