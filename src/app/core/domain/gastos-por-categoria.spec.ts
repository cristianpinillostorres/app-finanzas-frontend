import { describe, expect, it } from 'vitest';

import type { Categoria, Movimiento } from '../models';
import { gastosPorCategoriaDelMes } from './gastos-por-categoria';

const categorias: Categoria[] = [
  {
    id: 'cat-hogar',
    nombre: 'Hogar',
    tipo: 'GASTO',
    icono: 'sell',
    archivada: false,
    personalizada: false,
    topeMensual: null,
  },
  {
    id: 'cat-mercado',
    nombre: 'Mercado',
    tipo: 'GASTO',
    icono: 'sell',
    archivada: false,
    personalizada: false,
    topeMensual: null,
  },
  {
    id: 'cat-salario',
    nombre: 'Salario',
    tipo: 'INGRESO',
    icono: 'sell',
    archivada: false,
    personalizada: false,
    topeMensual: null,
  },
];

function gasto(parciales: Partial<Movimiento>): Movimiento {
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

describe('gastosPorCategoriaDelMes', () => {
  it('suma por categoría y ordena de mayor a menor', () => {
    const movimientos = [
      gasto({ id: 'm1', categoriaId: 'cat-hogar', monto: 300 }),
      gasto({ id: 'm2', categoriaId: 'cat-mercado', monto: 500 }),
      gasto({ id: 'm3', categoriaId: 'cat-mercado', monto: 100 }),
    ];

    const resultado = gastosPorCategoriaDelMes(movimientos, categorias, { anio: 2026, mes: 9 });

    expect(resultado.map((r) => r.categoriaId)).toEqual(['cat-mercado', 'cat-hogar']);
    expect(resultado[0].monto).toBe(600);
    expect(resultado[0].porcentaje).toBe(100);
    expect(resultado[1].porcentaje).toBe(50); // 300 / 600
  });

  it('ignora gastos sin categoría, ingresos y movimientos de otro mes', () => {
    const movimientos = [
      gasto({ id: 'm1', categoriaId: undefined, monto: 900 }),
      gasto({ id: 'm2', tipo: 'INGRESO', categoriaId: 'cat-salario', monto: 900 }),
      gasto({ id: 'm3', categoriaId: 'cat-hogar', monto: 900, fecha: '2026-08-05' }),
      gasto({ id: 'm4', categoriaId: 'cat-hogar', monto: 200 }),
    ];

    const resultado = gastosPorCategoriaDelMes(movimientos, categorias, { anio: 2026, mes: 9 });

    expect(resultado).toEqual([
      { categoriaId: 'cat-hogar', nombre: 'Hogar', monto: 200, porcentaje: 100 },
    ]);
  });

  it('devuelve una lista vacía si no hay gastos categorizados en el mes', () => {
    expect(gastosPorCategoriaDelMes([], categorias, { anio: 2026, mes: 9 })).toEqual([]);
  });
});
