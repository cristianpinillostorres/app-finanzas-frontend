import { describe, expect, it } from 'vitest';

import type { CompraCuotas, Movimiento } from '../models';
import { separarComprasACuotas } from './compras-a-cuotas';

function gasto(id: string, monto: number): Movimiento {
  return {
    id,
    tipo: 'GASTO',
    fecha: '2026-11-05',
    monto,
    descripcion: '',
    creadoEn: '2026-11-05T10:00:00.000Z',
  } as Movimiento;
}

function compra(movimientoId: string, numCuotas: number): CompraCuotas {
  return {
    id: `compra-${movimientoId}`,
    creditoId: 'tarjeta',
    movimientoId,
    descripcion: '',
    monto: 0,
    numCuotas,
    fecha: '2026-11-05',
  };
}

describe('separarComprasACuotas', () => {
  it('manda a cuotas solo los gastos con 2 o más cuotas', () => {
    const movimientos = [gasto('iphone', 3_850_000), gasto('cafe', 8_000), gasto('un-pago', 50_000)];
    const compras = [compra('iphone', 25), compra('un-pago', 1)];

    const { diaADia, aCuotas } = separarComprasACuotas(movimientos, compras);

    expect(aCuotas.map((m) => m.id)).toEqual(['iphone']);
    expect(diaADia.map((m) => m.id)).toEqual(['cafe', 'un-pago']);
  });

  it('sin compras a cuotas todo queda en el día a día', () => {
    const movimientos = [gasto('a', 1), gasto('b', 2)];
    expect(separarComprasACuotas(movimientos, []).aCuotas).toEqual([]);
  });
});
