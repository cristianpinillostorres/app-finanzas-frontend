import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import { AuthService } from '../../core/auth/auth.service';
import { type CambiosPreferencias, PREFERENCIAS_INICIALES, type Preferencias } from '../../core/models';
import { ConfiguracionPage } from './configuracion.page';

describe('ConfiguracionPage', () => {
  const guardados: CambiosPreferencias[] = [];
  const preferencias$ = new BehaviorSubject<Preferencias>(PREFERENCIAS_INICIALES);

  afterEach(() => vi.useRealTimers());

  function crear(inicial: Partial<Preferencias> = {}) {
    guardados.length = 0;
    preferencias$.next({ ...PREFERENCIAS_INICIALES, ...inicial });
    TestBed.configureTestingModule({
      imports: [ConfiguracionPage],
      providers: [
        provideRouter([]),
        {
          provide: PREFERENCIAS_API,
          useValue: {
            obtener: () => preferencias$.asObservable(),
            actualizar: (cambios: CambiosPreferencias) => {
              guardados.push(cambios);
              return of(undefined);
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            email: signal('persona@correo.co'),
            tieneGoogle: signal(false),
            vinculando: signal(false),
            vincularGoogle: () => undefined,
            cerrarSesion: () => undefined,
          },
        },
        { provide: MOVIMIENTOS_API, useValue: { listar: () => of([]) } },
        { provide: CUENTAS_API, useValue: { listar: () => of([]) } },
        { provide: CREDITOS_API, useValue: { listar: () => of([]) } },
        { provide: CATEGORIAS_API, useValue: { listar: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(ConfiguracionPage);
    fixture.detectChanges();
    const pagina = fixture.componentInstance as unknown as {
      alternarDiaFijo(activo: boolean): void;
      moverDia(paso: 1 | -1): void;
      moverAmarillo(paso: 1 | -1): void;
      moverRojo(paso: 1 | -1): void;
      alternarObjetivo(objetivo: string): void;
      cambiarNombre(texto: string): void;
      diaDePago(): number | null;
      avisos(): { amarillo: number; rojo: number };
    };
    return { fixture, pagina, html: fixture.nativeElement as HTMLElement };
  }

  it('sin día de pago el interruptor está apagado y no hay contador de día', () => {
    const { html } = crear();
    expect((html.querySelector('#cfg-fijo') as HTMLInputElement).checked).toBe(false);
    expect(html.textContent).not.toContain('Día del mes');
    expect(html.textContent).not.toContain('Tu próximo pago');
  });

  it('con día de pago el interruptor está encendido y el contador lo muestra', () => {
    const { html } = crear({ diaDePago: 20 });
    expect((html.querySelector('#cfg-fijo') as HTMLInputElement).checked).toBe(true);
    expect(html.querySelector('.contador__valor')?.textContent?.trim()).toBe('20');
    expect(html.textContent).toContain('Tu próximo pago es el');
  });

  it('encender el interruptor guarda el día inicial; apagarlo lo guarda vacío', () => {
    const { pagina } = crear();
    pagina.alternarDiaFijo(true);
    expect(pagina.diaDePago()).toBe(15);
    pagina.alternarDiaFijo(false);
    expect(pagina.diaDePago()).toBeNull();
    expect(guardados).toEqual([{ diaDePago: 15 }, { diaDePago: null }]);
  });

  it('varios toques en + o − guardan una sola vez, con el día final', () => {
    vi.useFakeTimers();
    const { pagina, fixture, html } = crear({ diaDePago: 20 });
    pagina.moverDia(1);
    pagina.moverDia(1);
    pagina.moverDia(-1);
    fixture.detectChanges();
    expect(html.querySelector('.contador__valor')?.textContent?.trim()).toBe('21');
    expect(guardados).toEqual([]); // todavía espera

    vi.advanceTimersByTime(700);
    expect(guardados).toEqual([{ diaDePago: 21 }]);
  });

  it('el contador da la vuelta: del 31 al 1 y del 1 al 31', () => {
    vi.useFakeTimers();
    const { pagina } = crear({ diaDePago: 31 });
    pagina.moverDia(1);
    expect(pagina.diaDePago()).toBe(1);
    pagina.moverDia(-1);
    expect(pagina.diaDePago()).toBe(31);
  });

  it('el nombre se guarda sin espacios y no se repite si no cambió', () => {
    const { pagina, fixture } = crear();
    pagina.cambiarNombre('  Cristhian ');
    expect(guardados).toEqual([{ nombre: 'Cristhian' }]);

    preferencias$.next({ ...PREFERENCIAS_INICIALES, nombre: 'Cristhian' });
    fixture.detectChanges();
    pagina.cambiarNombre('Cristhian');
    expect(guardados.length).toBe(1);

    pagina.cambiarNombre('   ');
    expect(guardados[1]).toEqual({ nombre: null });
  });

  describe('avisos de pagos', () => {
    it('muestra los de siempre (4 y 1) aunque no se haya guardado nada', () => {
      const { html } = crear();
      const valores = [...html.querySelectorAll('.contador__valor')].map((o) => o.textContent?.trim());
      expect(valores).toEqual(['4', '1']);
    });

    it('varios toques guardan una sola vez, con los días finales', () => {
      vi.useFakeTimers();
      const { pagina } = crear();
      pagina.moverAmarillo(1);
      pagina.moverAmarillo(1);
      pagina.moverRojo(1);
      expect(guardados).toEqual([]);
      vi.advanceTimersByTime(700);
      expect(guardados).toEqual([{ avisos: { amarillo: 6, rojo: 2 } }]);
    });

    it('el rojo siempre queda por debajo del amarillo', () => {
      vi.useFakeTimers();
      const { pagina } = crear({ avisos: { amarillo: 4, rojo: 3 } });
      pagina.moverRojo(1); // ya está al tope: amarillo − 1
      expect(pagina.avisos()).toEqual({ amarillo: 4, rojo: 3 });
      pagina.moverAmarillo(-1); // amarillo baja a 3: el rojo baja con él
      expect(pagina.avisos()).toEqual({ amarillo: 3, rojo: 2 });
    });

    it('respeta los límites: amarillo de 1 a 14 y rojo desde 0', () => {
      vi.useFakeTimers();
      const { pagina } = crear({ avisos: { amarillo: 14, rojo: 0 } });
      pagina.moverAmarillo(1);
      pagina.moverRojo(-1);
      expect(pagina.avisos()).toEqual({ amarillo: 14, rojo: 0 });
    });

  });

  describe('objetivos', () => {
    it('marcar uno lo guarda, siempre en el orden de la bienvenida', () => {
      const { pagina } = crear({ objetivos: ['ahorrar'] });
      pagina.alternarObjetivo('deudas');
      expect(guardados).toEqual([{ objetivos: ['deudas', 'ahorrar'] }]);
    });

    it('tocar uno ya marcado lo quita', () => {
      const { pagina } = crear({ objetivos: ['deudas', 'ahorrar'] });
      pagina.alternarObjetivo('deudas');
      expect(guardados).toEqual([{ objetivos: ['ahorrar'] }]);
    });
  });
});
