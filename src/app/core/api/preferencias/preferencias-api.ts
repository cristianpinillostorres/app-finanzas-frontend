import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CambiosPreferencias, Preferencias } from '../../models';

/**
 * Preferencias de la persona (ver `Preferencias`). `obtener` es en vivo:
 * un cambio hecho en otro dispositivo llega solo.
 */
export interface PreferenciasApi {
  obtener(): Observable<Preferencias>;
  actualizar(cambios: CambiosPreferencias): Observable<void>;
}

export const PREFERENCIAS_API = new InjectionToken<PreferenciasApi>('PreferenciasApi');
