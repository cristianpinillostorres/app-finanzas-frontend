import { describe, expect, it } from 'vitest';

import type { Categoria, Movimiento } from '../models';
import { presupuestosDelMes } from './presupuestos';

function categoria(parciales: Partial<Categoria>): Categoria {
  return {
    id: 'c',
    nombre: 'C',
    tipo: 'GASTO',
    icono: 'sell',
    archivada: false,
    personalizada: false,
    topeMensual: null,
    ...parciales,
  };
}

function gasto(parciales: Partial<Movimiento>): Movimiento {
  return {
    id: 'm',
    tipo: 'GASTO',
    fecha: '2026-10-05',
    monto: 100,
    descripcion: '',
    creadoEn: '2026-10-05T10:00:00.000Z',
    ...parciales,
  } as Movimiento;
}

const octubre = { anio: 2026, mes: 10 };

describe('presupuestosDelMes', () => {
  it('sin topes no devuelve nada', () => {
    expect(presupuestosDelMes([categoria({})], [gasto({ categoriaId: 'c' })], octubre)).toEqual([]);
  });

  it('suma solo los gastos del mes de cada categoría y ordena por cercanía al tope', () => {
    const categorias = [
      categoria({ id: 'rest', topeMensual: 300 }),
      categoria({ id: 'merc', topeMensual: 1000 }),
      categoria({ id: 'trans', topeMensual: 100 }),
    ];
    const movimientos = [
      gasto({ categoriaId: 'rest', monto: 250 }),
      gasto({ categoriaId: 'merc', monto: 200 }),
      gasto({ categoriaId: 'trans', monto: 130 }),
      gasto({ categoriaId: 'merc', monto: 900, fecha: '2026-09-30' }),
      gasto({ categoriaId: 'merc', monto: 50, tipo: 'INGRESO' }),
    ];

    const resultado = presupuestosDelMes(categorias, movimientos, octubre);

    expect(resultado.map((p) => [p.categoria.id, p.gastado, p.estado])).toEqual([
      ['trans', 130, 'pasado'],
      ['rest', 250, 'cerca'],
      ['merc', 200, 'bien'],
    ]);
    expect(resultado[0].restante).toBe(-30);
  });

  it('deja fuera las ocultas y las de ingreso', () => {
    const categorias = [
      categoria({ id: 'oculta', topeMensual: 100, archivada: true }),
      categoria({ id: 'ingreso', topeMensual: 100, tipo: 'INGRESO' }),
    ];
    expect(presupuestosDelMes(categorias, [], octubre)).toEqual([]);
  });
});
