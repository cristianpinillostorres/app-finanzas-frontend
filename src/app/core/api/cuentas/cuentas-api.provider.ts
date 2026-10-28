import type { Provider } from '@angular/core';

import { CUENTAS_API } from './cuentas-api';
import { CuentasSupabaseApi } from './cuentas-supabase-api';

export function provideCuentasApi(): Provider {
  return { provide: CUENTAS_API, useClass: CuentasSupabaseApi };
}
