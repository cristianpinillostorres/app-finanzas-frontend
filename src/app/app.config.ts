import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import localeEsCoExtra from '@angular/common/locales/extra/es-CO';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  MAT_BOTTOM_SHEET_DEFAULT_OPTIONS,
  MatBottomSheetConfig,
} from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withViewTransitions } from '@angular/router';

import { API_PROVIDERS } from './core/api/api.providers';
import { SUPABASE_PROVIDERS } from './core/supabase/supabase.providers';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEsCo, 'es-CO', localeEsCoExtra);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // `withViewTransitions`: fundido corto al cambiar de pestaña, con la
    // View Transitions API del navegador. En los que no la soportan, la
    // navegación es instantánea como antes — no hay respaldo que mantener.
    // La duración y el apagado bajo `prefers-reduced-motion` se controlan
    // desde CSS (`::view-transition-*` en `styles.scss`).
    provideRouter(routes, withViewTransitions()),
    // Sin `provideAnimationsAsync()`: está deprecado desde 20.2 (se va en
    // v23) en favor de `animate.enter`/`animate.leave`, y Angular Material
    // 21 ya no declara `@angular/animations` como peer dependency, así que
    // diálogo, menú, tabs, snackbar y hoja inferior animan sin él.
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    // Al abrir una hoja el foco va a la hoja misma, no a "Cancelar" (el
    // primer botón): si no, "Cancelar" aparecía recuadrado sin haberlo
    // tocado. Quien quiere el foco en un campo lo pide al abrir (el "+").
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: { ...new MatDialogConfig(), autoFocus: 'dialog' },
    },
    {
      provide: MAT_BOTTOM_SHEET_DEFAULT_OPTIONS,
      useValue: { ...new MatBottomSheetConfig(), autoFocus: 'dialog' },
    },
    ...SUPABASE_PROVIDERS,
    ...API_PROVIDERS,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
