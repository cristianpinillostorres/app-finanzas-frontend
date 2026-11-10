import { semaforo, UMBRALES_INICIALES } from './semaforo';

const HOY = new Date(2026, 8, 11); // 11 de septiembre de 2026

describe('semaforo', () => {
  it('es pagado sin importar la fecha si ya se pagó', () => {
    expect(semaforo('2026-08-01', HOY, true)).toBe('pagado');
  });

  it('es verde si faltan 5 días o más', () => {
    expect(semaforo('2026-09-16', HOY)).toBe('verde');
  });

  it('es amarillo si faltan entre 2 y 4 días', () => {
    expect(semaforo('2026-09-13', HOY)).toBe('amarillo');
    expect(semaforo('2026-09-15', HOY)).toBe('amarillo');
  });

  it('es rojo si vence mañana', () => {
    expect(semaforo('2026-09-12', HOY)).toBe('rojo');
  });

  it('es rojo si vence hoy', () => {
    expect(semaforo('2026-09-11', HOY)).toBe('rojo');
  });

  it('es rojo si ya venció', () => {
    expect(semaforo('2026-09-01', HOY)).toBe('rojo');
  });

  it('acepta un objeto Date además de un texto ISO', () => {
    expect(semaforo(new Date(2026, 8, 20), HOY)).toBe('verde');
  });

  describe('con umbrales propios', () => {
    it('los de siempre dan lo mismo que sin pasarlos', () => {
      expect(semaforo('2026-09-15', HOY, false, UMBRALES_INICIALES)).toBe('amarillo');
      expect(semaforo('2026-09-16', HOY, false, UMBRALES_INICIALES)).toBe('verde');
    });

    it('un amarillo más temprano avisa antes', () => {
      // faltan 7 días: verde por defecto, amarillo si el aviso es con 7 días o menos
      expect(semaforo('2026-09-18', HOY)).toBe('verde');
      expect(semaforo('2026-09-18', HOY, false, { amarillo: 7, rojo: 1 })).toBe('amarillo');
    });

    it('un rojo más temprano avisa antes', () => {
      expect(semaforo('2026-09-14', HOY)).toBe('amarillo'); // faltan 3
      expect(semaforo('2026-09-14', HOY, false, { amarillo: 7, rojo: 3 })).toBe('rojo');
    });

    it('con rojo en 0 solo es rojo el día que vence o después', () => {
      const umbrales = { amarillo: 4, rojo: 0 };
      expect(semaforo('2026-09-12', HOY, false, umbrales)).toBe('amarillo'); // mañana
      expect(semaforo('2026-09-11', HOY, false, umbrales)).toBe('rojo'); // hoy
    });

    it('lo pagado sigue siendo pagado con cualquier umbral', () => {
      expect(semaforo('2026-09-01', HOY, true, { amarillo: 14, rojo: 5 })).toBe('pagado');
    });
  });
});
