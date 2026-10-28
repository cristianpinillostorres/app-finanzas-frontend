import type { Provider } from '@angular/core';

import { CREDITOS_API } from './creditos-api';
import { CreditosSupabaseApi } from './creditos-supabase-api';

export function provideCreditosApi(): Provider {
  return { provide: CREDITOS_API, useClass: CreditosSupabaseApi };
}
