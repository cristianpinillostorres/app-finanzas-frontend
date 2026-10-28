import { semaforo } from './semaforo';

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
});
