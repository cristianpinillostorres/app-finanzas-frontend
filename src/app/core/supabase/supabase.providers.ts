import type { Provider } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';
import { SUPABASE } from './supabase.tokens';

/**
 * Un solo cliente de Supabase para toda la app (login, datos y tiempo
 * real lo comparten). Con el mismo espíritu que `API_PROVIDERS`: quien lo
 * necesita inyecta `SUPABASE` en vez de crear su propio cliente.
 *
 * `detectSessionInUrl`: al volver de Google, la sesión llega en la URL y
 * el cliente la recoge solo (ver `AuthService.recogerRedireccion`).
 */
export const SUPABASE_PROVIDERS: Provider[] = [
  {
    provide: SUPABASE,
    useFactory: () =>
      createClient(environment.supabaseUrl, environment.supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }),
  },
];
