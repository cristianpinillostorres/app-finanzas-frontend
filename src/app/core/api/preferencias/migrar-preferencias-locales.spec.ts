import { PREFERENCIAS_INICIALES, type Preferencias } from '../../models';
import { migrarPreferenciasLocales } from './migrar-preferencias-locales';

describe('migrarPreferenciasLocales', () => {
  beforeEach(() => localStorage.clear());

  it('sube lo que había en el navegador y lo borra', () => {
    localStorage.setItem('finanzas.primerosPasos.oculto.u1', '1');
    localStorage.setItem('finanzas.primerosPasos.omitidos.u1', '["creditos"]');
    localStorage.setItem('finanzas.ultimaCuentaGasto', 'c1');
    localStorage.setItem('finanzas.ultimaCuentaIngreso', 'c2');

    expect(migrarPreferenciasLocales('u1', PREFERENCIAS_INICIALES)).toEqual({
      recorrido: { oculto: true, omitidos: ['creditos'] },
      ultimaCuenta: { gasto: 'c1', ingreso: 'c2' },
    });
    expect(localStorage.length).toBe(0);
  });

  it('no pisa lo que ya está en la cuenta y suma los omitidos nuevos', () => {
    localStorage.setItem('finanzas.primerosPasos.omitidos.u1', '["creditos","categorias"]');
    localStorage.setItem('finanzas.ultimaCuentaGasto', 'vieja');
    const actuales: Preferencias = {
      recorrido: { oculto: false, omitidos: ['creditos'] },
      ultimaCuenta: { gasto: 'nueva', ingreso: null },
      objetivos: [],
      objetivoPrincipal: null,
      nombre: null,
      diaDePago: null,
      avisos: { amarillo: 4, rojo: 1 },
      metasAhorro: [],
      categoriasDeIngreso: null,
    };

    expect(migrarPreferenciasLocales('u1', actuales)).toEqual({
      recorrido: { omitidos: ['creditos', 'categorias'] },
    });
  });

  it('sin nada guardado no escribe nada', () => {
    expect(migrarPreferenciasLocales('u1', PREFERENCIAS_INICIALES)).toBeNull();
  });

  it('ignora lo guardado para otro usuario', () => {
    localStorage.setItem('finanzas.primerosPasos.oculto.otro', '1');
    expect(migrarPreferenciasLocales('u1', PREFERENCIAS_INICIALES)).toBeNull();
    expect(localStorage.getItem('finanzas.primerosPasos.oculto.otro')).toBe('1');
  });
});
