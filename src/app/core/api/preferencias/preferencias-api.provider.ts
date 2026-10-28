import type { Provider } from '@angular/core';

import { PREFERENCIAS_API } from './preferencias-api';
import { PreferenciasSupabaseApi } from './preferencias-supabase-api';

export function providePreferenciasApi(): Provider {
  return { provide: PREFERENCIAS_API, useClass: PreferenciasSupabaseApi };
}
