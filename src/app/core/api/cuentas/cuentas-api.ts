import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { Cuenta, NuevaCuenta, NuevoBolsillo } from '../../models';

/**
 * Cuentas y bolsillos (misma tabla, ver `Cuenta`). Los saldos que se ven en
 * pantalla son calculados por `core/domain` a partir de `saldoInicial` y los
 * movimientos: esta API solo guarda y devuelve las filas de cuenta.
 */
export interface CuentasApi {
  listar(): Observable<Cuenta[]>;
  obtener(id: string): Observable<Cuenta | undefined>;
  crear(datos: NuevaCuenta): Observable<Cuenta>;
  crearBolsillo(datos: NuevoBolsillo): Observable<Cuenta>;
  actualizar(id: string, cambios: Partial<Cuenta>): Observable<Cuenta>;
  /** No borra la cuenta: la marca archivada para no dañar el historial de movimientos. */
  archivar(id: string): Observable<void>;
}

export const CUENTAS_API = new InjectionToken<CuentasApi>('CuentasApi');
