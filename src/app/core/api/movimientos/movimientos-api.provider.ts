import type { Provider } from '@angular/core';

import { MOVIMIENTOS_API } from './movimientos-api';
import { MovimientosSupabaseApi } from './movimientos-supabase-api';

export function provideMovimientosApi(): Provider {
  return { provide: MOVIMIENTOS_API, useClass: MovimientosSupabaseApi };
}
