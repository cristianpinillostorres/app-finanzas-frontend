import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('finanzas.tema');
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.removeItem('finanzas.tema');
    document.documentElement.removeAttribute('data-theme');
  });

  it('sin elección sigue al sistema y no marca <html>', () => {
    const tema = TestBed.inject(ThemeService);
    expect(tema.preferencia()).toBe('sistema');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('fijar oscuro marca <html> con el atributo de Marca y lo guarda', () => {
    const tema = TestBed.inject(ThemeService);
    tema.elegir('oscuro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(tema.oscuro()).toBe(true);
    expect(localStorage.getItem('finanzas.tema')).toBe('oscuro');
  });

  it('fijar claro gana sobre el sistema', () => {
    const tema = TestBed.inject(ThemeService);
    tema.elegir('claro');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(tema.oscuro()).toBe(false);
  });

  it('volver a "sistema" quita la marca y lo guardado', () => {
    const tema = TestBed.inject(ThemeService);
    tema.elegir('oscuro');
    tema.elegir('sistema');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('finanzas.tema')).toBeNull();
  });

  it('recuerda lo elegido al volver a abrir la app', () => {
    localStorage.setItem('finanzas.tema', 'claro');
    expect(TestBed.inject(ThemeService).preferencia()).toBe('claro');
  });
});
