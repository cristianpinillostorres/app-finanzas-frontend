import type { Provider } from '@angular/core';

import { COMPRAS_API } from './compras-api';
import { ComprasSupabaseApi } from './compras-supabase-api';

export function provideComprasApi(): Provider {
  return { provide: COMPRAS_API, useClass: ComprasSupabaseApi };
}
