import type { PagoFijo } from '../models';
import { aplicaEnMes, fechaLimiteEnMes } from './pagos-fijos';

function pagoFijo(
  datos: Partial<PagoFijo> & Pick<PagoFijo, 'id' | 'nombre' | 'frecuencia' | 'mesInicio'>,
): PagoFijo {
  return {
    categoriaId: 'servicios',
    diaLimite: 15,
    monto: 100_000,
    esVariable: false,
    cuentaDefaultId: 'bancolombia',
    activo: true,
    ...datos,
  };
}

describe('aplicaEnMes', () => {
  it('un pago mensual aplica todos los meses', () => {
    const p = pagoFijo({ id: 'arriendo', nombre: 'Arriendo', frecuencia: 'MENSUAL', mesInicio: 1 });
    for (let mes = 1; mes <= 12; mes++) {
      expect(aplicaEnMes(p, { anio: 2026, mes })).toBe(true);
    }
  });

  it('un pago anual solo aplica en su mes de inicio', () => {
    const soat = pagoFijo({ id: 'soat', nombre: 'SOAT', frecuencia: 'ANUAL', mesInicio: 10 });
    expect(aplicaEnMes(soat, { anio: 2026, mes: 10 })).toBe(true);
    expect(aplicaEnMes(soat, { anio: 2026, mes: 9 })).toBe(false);
    expect(aplicaEnMes(soat, { anio: 2027, mes: 10 })).toBe(true);
  });

  it('un pago bimestral aplica cada 2 meses desde el mes de inicio', () => {
    const p = pagoFijo({ id: 'gas', nombre: 'Gas', frecuencia: 'BIMESTRAL', mesInicio: 2 });
    expect(aplicaEnMes(p, { anio: 2026, mes: 2 })).toBe(true);
    expect(aplicaEnMes(p, { anio: 2026, mes: 3 })).toBe(false);
    expect(aplicaEnMes(p, { anio: 2026, mes: 4 })).toBe(true);
    expect(aplicaEnMes(p, { anio: 2026, mes: 12 })).toBe(true);
    expect(aplicaEnMes(p, { anio: 2027, mes: 1 })).toBe(false);
  });

  it('un pago inactivo nunca aplica', () => {
    const p = pagoFijo({
      id: 'gimnasio',
      nombre: 'Gimnasio',
      frecuencia: 'MENSUAL',
      mesInicio: 1,
      activo: false,
    });
    expect(aplicaEnMes(p, { anio: 2026, mes: 5 })).toBe(false);
  });
});

describe('fechaLimiteEnMes', () => {
  it('usa el día límite tal cual cuando existe en el mes', () => {
    const p = pagoFijo({
      id: 'arriendo',
      nombre: 'Arriendo',
      frecuencia: 'MENSUAL',
      mesInicio: 1,
      diaLimite: 5,
    });
    expect(fechaLimiteEnMes(p, { anio: 2026, mes: 9 })).toEqual(new Date(2026, 8, 5));
  });

  it('usa el último día del mes si el día límite no existe (31 en febrero)', () => {
    const p = pagoFijo({
      id: 'x',
      nombre: 'X',
      frecuencia: 'MENSUAL',
      mesInicio: 1,
      diaLimite: 31,
    });
    expect(fechaLimiteEnMes(p, { anio: 2026, mes: 2 })).toEqual(new Date(2026, 1, 28));
    expect(fechaLimiteEnMes(p, { anio: 2028, mes: 2 })).toEqual(new Date(2028, 1, 29));
  });
});
