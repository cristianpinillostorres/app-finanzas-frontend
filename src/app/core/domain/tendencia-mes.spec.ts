import { describe, expect, it } from 'vitest';

import type { Movimiento } from '../models';
import { tendenciaDelMes } from './tendencia-mes';

function mov(parciales: Partial<Movimiento>): Movimiento {
  return {
    id: 'm',
    tipo: 'GASTO',
    fecha: '2026-09-05',
    monto: 100,
    descripcion: '',
    creadoEn: '2026-09-05T10:00:00.000Z',
    ...parciales,
  } as Movimiento;
}

const SEPTIEMBRE = { anio: 2026, mes: 9 };
// Mes ya terminado, para los casos que necesitan la serie completa.
const AGOSTO = { anio: 2026, mes: 8 };
const HOY_10_SEP = new Date(2026, 8, 10);

describe('tendenciaDelMes', () => {
  it('acumula ingresos y gastos día a día', () => {
    const movimientos = [
      mov({ id: 'm1', tipo: 'INGRESO', fecha: '2026-09-02', monto: 1000 }),
      mov({ id: 'm2', tipo: 'GASTO', fecha: '2026-09-03', monto: 200 }),
      mov({ id: 'm3', tipo: 'GASTO', fecha: '2026-09-05', monto: 300 }),
    ];

    const serie = tendenciaDelMes(movimientos, SEPTIEMBRE, HOY_10_SEP);

    expect(serie).toHaveLength(10);
    expect(serie[0]).toEqual({ dia: 1, ingresos: 0, gastos: 0 });
    expect(serie[1]).toEqual({ dia: 2, ingresos: 1000, gastos: 0 });
    expect(serie[2]).toEqual({ dia: 3, ingresos: 1000, gastos: 200 });
    // El día 4 no tiene movimientos: el acumulado se mantiene, no baja a 0.
    expect(serie[3]).toEqual({ dia: 4, ingresos: 1000, gastos: 200 });
    expect(serie[4]).toEqual({ dia: 5, ingresos: 1000, gastos: 500 });
    expect(serie[9]).toEqual({ dia: 10, ingresos: 1000, gastos: 500 });
  });

  it('suma varios movimientos del mismo día', () => {
    const movimientos = [
      mov({ id: 'm1', tipo: 'GASTO', fecha: '2026-09-03', monto: 200 }),
      mov({ id: 'm2', tipo: 'GASTO', fecha: '2026-09-03', monto: 50 }),
    ];

    const serie = tendenciaDelMes(movimientos, SEPTIEMBRE, HOY_10_SEP);

    expect(serie[2].gastos).toBe(250);
  });

  it('ignora transferencias, internos y ajustes, igual que resumenMovimientos', () => {
    const movimientos = [
      mov({ id: 'm1', tipo: 'TRANSFERENCIA', fecha: '2026-09-02', monto: 900 }),
      mov({ id: 'm2', tipo: 'INTERNO', fecha: '2026-09-02', monto: 900 }),
      mov({ id: 'm3', tipo: 'AJUSTE', fecha: '2026-09-02', monto: 900 }),
    ];

    const serie = tendenciaDelMes(movimientos, SEPTIEMBRE, HOY_10_SEP);

    expect(serie.every((p) => p.ingresos === 0 && p.gastos === 0)).toBe(true);
  });

  it('ignora movimientos de otro mes', () => {
    const movimientos = [
      mov({ id: 'm1', tipo: 'GASTO', fecha: '2026-08-31', monto: 400 }),
      mov({ id: 'm2', tipo: 'GASTO', fecha: '2026-10-01', monto: 400 }),
    ];

    const serie = tendenciaDelMes(movimientos, SEPTIEMBRE, HOY_10_SEP);

    expect(serie.every((p) => p.gastos === 0)).toBe(true);
  });

  it('corta la serie en el día de hoy cuando es el mes en curso', () => {
    const serie = tendenciaDelMes([], SEPTIEMBRE, HOY_10_SEP);

    expect(serie).toHaveLength(10);
    expect(serie.at(-1)?.dia).toBe(10);
  });

  it('deja fuera un movimiento con fecha posterior a hoy dentro del mes en curso', () => {
    const movimientos = [mov({ id: 'm1', tipo: 'GASTO', fecha: '2026-09-20', monto: 700 })];

    const serie = tendenciaDelMes(movimientos, SEPTIEMBRE, HOY_10_SEP);

    expect(serie).toHaveLength(10);
    expect(serie.at(-1)?.gastos).toBe(0);
  });

  it('cubre el mes completo cuando ya terminó', () => {
    const movimientos = [mov({ id: 'm1', tipo: 'GASTO', fecha: '2026-08-31', monto: 700 })];

    const serie = tendenciaDelMes(movimientos, AGOSTO, HOY_10_SEP);

    expect(serie).toHaveLength(31);
    expect(serie.at(-1)).toEqual({ dia: 31, ingresos: 0, gastos: 700 });
  });

  it('respeta los meses de 28, 30 y 31 días', () => {
    const febrero = tendenciaDelMes([], { anio: 2026, mes: 2 }, HOY_10_SEP);
    const abril = tendenciaDelMes([], { anio: 2026, mes: 4 }, HOY_10_SEP);

    expect(febrero).toHaveLength(28);
    expect(abril).toHaveLength(30);
  });

  it('devuelve una serie vacía para un mes futuro', () => {
    expect(tendenciaDelMes([], { anio: 2026, mes: 10 }, HOY_10_SEP)).toEqual([]);
    expect(tendenciaDelMes([], { anio: 2027, mes: 1 }, HOY_10_SEP)).toEqual([]);
  });

  it('devuelve un solo punto el día 1 del mes', () => {
    const serie = tendenciaDelMes(
      [mov({ id: 'm1', tipo: 'INGRESO', fecha: '2026-09-01', monto: 500 })],
      SEPTIEMBRE,
      new Date(2026, 8, 1),
    );

    expect(serie).toEqual([{ dia: 1, ingresos: 500, gastos: 0 }]);
  });
});
