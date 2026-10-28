import { cuotaFrancesa, tablaAmortizacion, tasaMensual } from './tasas';

describe('tasaMensual', () => {
  it('convierte una tasa E.A. a mensual con la fórmula compuesta', () => {
    // (1.24)^(1/12) - 1 ≈ 0.01808758...
    expect(tasaMensual(0.24)).toBeCloseTo(0.01808758, 8);
  });

  it('nunca es el resultado ingenuo de dividir la E.A. entre 12', () => {
    expect(tasaMensual(0.24)).not.toBeCloseTo(0.24 / 12, 6);
  });

  it('una tasa de 0% mensual sigue siendo 0%', () => {
    expect(tasaMensual(0)).toBe(0);
  });
});

describe('cuotaFrancesa', () => {
  it('calcula la cuota fija de un préstamo a tasa 0', () => {
    expect(cuotaFrancesa(1_200_000, 0, 12)).toBe(100_000);
  });

  it('calcula la cuota fija con interés y redondea al peso', () => {
    const cuota = cuotaFrancesa(10_000_000, tasaMensual(0.24), 24);
    expect(cuota).toBe(517_326);
  });

  it('devuelve 0 si el plazo no es positivo', () => {
    expect(cuotaFrancesa(1_000_000, 0.01, 0)).toBe(0);
  });
});

describe('tablaAmortizacion', () => {
  it('tiene una fila por cada mes del plazo', () => {
    const tabla = tablaAmortizacion(1_200_000, 0, 12);
    expect(tabla).toHaveLength(12);
  });

  it('el saldo final de la última cuota es exactamente 0', () => {
    const tabla = tablaAmortizacion(10_000_000, tasaMensual(0.24), 24, 25_000);
    expect(tabla.at(-1)?.saldoFinal).toBe(0);
  });

  it('el saldo inicial de una cuota es el saldo final de la anterior', () => {
    const tabla = tablaAmortizacion(10_000_000, tasaMensual(0.24), 24);
    expect(tabla[1].saldoInicial).toBe(tabla[0].saldoFinal);
  });

  it('el seguro se suma a la cuota pero no baja el saldo', () => {
    const sinSeguro = tablaAmortizacion(10_000_000, tasaMensual(0.24), 24);
    const conSeguro = tablaAmortizacion(10_000_000, tasaMensual(0.24), 24, 30_000);
    expect(conSeguro[0].saldoFinal).toBe(sinSeguro[0].saldoFinal);
    expect(conSeguro[0].cuota).toBe(sinSeguro[0].cuota + 30_000);
  });

  it('el capital baja el saldo y el interés se calcula sobre el saldo inicial', () => {
    const tabla = tablaAmortizacion(10_000_000, tasaMensual(0.24), 24);
    const primera = tabla[0];
    expect(primera.interes).toBe(Math.round(10_000_000 * tasaMensual(0.24)));
    expect(primera.saldoFinal).toBe(primera.saldoInicial - primera.capital);
  });
});
