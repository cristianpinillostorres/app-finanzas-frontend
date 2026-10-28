import type { Provider } from '@angular/core';

import { provideCategoriasApi } from './categorias/categorias-api.provider';
import { provideComprasApi } from './compras/compras-api.provider';
import { provideCreditosApi } from './creditos/creditos-api.provider';
import { provideCuentasApi } from './cuentas/cuentas-api.provider';
import { provideMovimientosApi } from './movimientos/movimientos-api.provider';
import { providePagosFijosApi } from './pagos-fijos/pagos-fijos-api.provider';
import { providePreferenciasApi } from './preferencias/preferencias-api.provider';

/** Registra la implementación de Supabase (con copia local, ver `SesionLocal`) de cada recurso. */
export const API_PROVIDERS: Provider[] = [
  provideCuentasApi(),
  provideCreditosApi(),
  provideComprasApi(),
  providePagosFijosApi(),
  provideMovimientosApi(),
  provideCategoriasApi(),
  providePreferenciasApi(),
];
