import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { primeraCarga } from './primera-carga';

describe('primeraCarga', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('espera a que respondan todas las fuentes', () => {
    const cuentas = new Subject<unknown[]>();
    const movimientos = new Subject<unknown[]>();
    const listo = TestBed.runInInjectionContext(() => primeraCarga(cuentas, movimientos));

    expect(listo()).toBe(false);
    cuentas.next([]);
    expect(listo()).toBe(false);
    movimientos.next([]);
    expect(listo()).toBe(true);
  });

  it('da por cargado si una fuente falla, para no dejar esqueletos para siempre', () => {
    const cuentas = new Subject<unknown[]>();
    const listo = TestBed.runInInjectionContext(() => primeraCarga(cuentas));

    cuentas.error(new Error('sin permisos'));
    expect(listo()).toBe(true);
  });
});
