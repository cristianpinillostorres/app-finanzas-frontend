import type { Provider } from '@angular/core';

import { CATEGORIAS_API } from './categorias-api';
import { CategoriasSupabaseApi } from './categorias-supabase-api';

export function provideCategoriasApi(): Provider {
  return { provide: CATEGORIAS_API, useClass: CategoriasSupabaseApi };
}
