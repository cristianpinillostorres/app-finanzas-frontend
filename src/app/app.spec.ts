import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { CATEGORIAS_API } from './core/api/categorias/categorias-api';
import { COMPRAS_API } from './core/api/compras/compras-api';
import { CREDITOS_API } from './core/api/creditos/creditos-api';
import { CUENTAS_API } from './core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from './core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from './core/api/pagos-fijos/pagos-fijos-api';
import { PREFERENCIAS_API } from './core/api/preferencias/preferencias-api';
import { PREFERENCIAS_INICIALES } from './core/models';
import { AuthService } from './core/auth/auth.service';

/**
 * Doble de `AuthService`: nada de Supabase real en pruebas unitarias (ver
 * `AuthService`, que sí depende de `SUPABASE`). Cada `it` pisa el
 * signal que le interesa.
 */
function crearAuthFalso(inicial: { cargando: boolean; autenticado: boolean }) {
  return {
    cargando: () => inicial.cargando,
    autenticado: () => inicial.autenticado,
    // El `Shell` lo usa para la inicial del avatar y la cabecera del menú
    // de cuenta; sin sesión real no hay correo que mostrar.
    email: () => null,
    uid: () => 'demo',
    tieneGoogle: () => false,
    vinculando: () => false,
    aviso: () => null,
    iniciandoCon: () => null,
    iniciandoSesion: () => false,
    error: () => null,
    errorGoogle: () => null,
    errorRegistro: () => null,
    iniciarSesion: async () => {},
    entrarConGoogle: async () => {},
    vincularGoogle: async () => {},
    descartarAviso: () => {},
    cerrarSesion: async () => {},
    terminarEntrada: () => {},
  };
}

/** Una API sin Supabase: cualquier lectura devuelve una lista vacía (cuenta nueva). */
const apiVacia = new Proxy({}, { get: () => () => of([]) });
const APIS_VACIAS = [
  CUENTAS_API,
  CREDITOS_API,
  COMPRAS_API,
  PAGOS_FIJOS_API,
  MOVIMIENTOS_API,
  CATEGORIAS_API,
].map((token) => ({ provide: token, useValue: apiVacia }));
const PREFERENCIAS_FALSAS = {
  provide: PREFERENCIAS_API,
  useValue: { obtener: () => of(PREFERENCIAS_INICIALES), actualizar: () => of(undefined) },
};

describe('App', () => {
  async function montar(authFalso: ReturnType<typeof crearAuthFalso>) {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        // Con las APIs vacías la cuenta es nueva y el `Shell` manda a la
        // bienvenida: sin la ruta, esa navegación fallaba fuera de las pruebas.
        provideRouter([{ path: 'bienvenida', children: [] }]),
        provideNoopAnimations(),
        ...APIS_VACIAS,
        PREFERENCIAS_FALSAS,
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();
    return TestBed.createComponent(App);
  }

  it('crea la app', async () => {
    const fixture = await montar(crearAuthFalso({ cargando: false, autenticado: true }));
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el shell con la navegación principal si hay sesión', async () => {
    const fixture = await montar(crearAuthFalso({ cargando: false, autenticado: true }));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-shell')).toBeTruthy();
  });

  it('muestra el login si no hay sesión', async () => {
    const fixture = await montar(crearAuthFalso({ cargando: false, autenticado: false }));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-login-page')).toBeTruthy();
    expect(compiled.querySelector('app-shell')).toBeFalsy();
  });

  it('no muestra nada mientras Supabase todavía no resuelve la sesión', async () => {
    const fixture = await montar(crearAuthFalso({ cargando: true, autenticado: false }));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-shell')).toBeFalsy();
    expect(compiled.querySelector('app-login-page')).toBeFalsy();
  });
});
