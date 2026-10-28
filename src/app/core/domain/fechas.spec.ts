import { diasEntre, mesesEntre, ultimoDiaDelMes } from './fechas';

describe('ultimoDiaDelMes', () => {
  it('devuelve 28 en febrero de un año no bisiesto', () => {
    expect(ultimoDiaDelMes(2026, 2)).toBe(28);
  });

  it('devuelve 29 en febrero de un año bisiesto', () => {
    expect(ultimoDiaDelMes(2028, 2)).toBe(29);
  });

  it('devuelve 31 en diciembre', () => {
    expect(ultimoDiaDelMes(2026, 12)).toBe(31);
  });
});

describe('diasEntre', () => {
  it('cuenta los días completos entre dos fechas', () => {
    expect(diasEntre(new Date(2026, 8, 11), new Date(2026, 8, 16))).toBe(5);
  });

  it('es negativa si la fecha límite ya pasó', () => {
    expect(diasEntre(new Date(2026, 8, 11), new Date(2026, 8, 9))).toBe(-2);
  });

  it('ignora la hora del día', () => {
    const desde = new Date(2026, 8, 11, 23, 59);
    const hasta = new Date(2026, 8, 12, 0, 1);
    expect(diasEntre(desde, hasta)).toBe(1);
  });
});

describe('mesesEntre', () => {
  it('cuenta meses completos dentro del mismo año', () => {
    expect(mesesEntre(new Date(2026, 2, 15), new Date(2026, 5, 1))).toBe(3);
  });

  it('cuenta meses completos cruzando años', () => {
    expect(mesesEntre(new Date(2025, 10, 1), new Date(2026, 1, 1))).toBe(3);
  });
});
