import type { Provider } from '@angular/core';

import { PAGOS_FIJOS_API } from './pagos-fijos-api';
import { PagosFijosSupabaseApi } from './pagos-fijos-supabase-api';

export function providePagosFijosApi(): Provider {
  return { provide: PAGOS_FIJOS_API, useClass: PagosFijosSupabaseApi };
}
