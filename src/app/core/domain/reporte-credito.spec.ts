import { describe, expect, it } from 'vitest';

import type { CompraCuotas, CreditoTarjeta, Cuenta, Movimiento } from '../models';
import { armarReporteCredito } from './reporte-credito';

const HOY = new Date(2026, 10, 9); // 9 de noviembre de 2026

const zeroG: CreditoTarjeta = {
  id: 'zero',
  grupo: 'TARJETA',
  nombre: 'Zero G',
  diaPago: 25,
  diaCorte: 8,
  cupo: 2_200_000,
  archivado: false,
};

const nequi = {
  id: 'nequi',
  nombre: 'Nequi',
  tipo: 'BILLETERA',
  color: '#000000',
  cuentaPadreId: null,
  saldoInicial: 0,
  sumaEnDisponible: true,
  reservado: false,
  archivada: false,
  creadoEn: '2026-01-01',
} as Cuenta;

function compra(
  datos: Partial<CompraCuotas> & Pick<CompraCuotas, 'id' | 'monto' | 'numCuotas' | 'fecha'>,
): CompraCuotas {
  return { creditoId: 'zero', movimientoId: '', descripcion: datos.id, ...datos };
}

function movimiento(datos: Partial<Movimiento> & Pick<Movimiento, 'id' | 'fecha'>): Movimiento {
  return { tipo: 'GASTO', monto: 0, descripcion: '', creadoEn: `${datos.fecha}T10:00:00`, ...datos };
}

describe('armarReporteCredito', () => {
  const compras = [
    compra({ id: 'gym', monto: 255_000, numCuotas: 5, fecha: '2026-10-08', movimientoId: 'mov-gym' }),
    compra({ id: 'vieja', monto: 100_000, numCuotas: 2, fecha: '2026-06-01' }), // ya terminó
    compra({ id: 'otra', creditoId: 'rappi', monto: 999, numCuotas: 1, fecha: '2026-11-01' }), // de otro crédito
  ];
  const movimientos = [
    movimiento({ id: 'mov-gym', fecha: '2026-09-29' }),
    movimiento({
      id: 'pago1',
      fecha: '2026-10-28',
      tipo: 'TRANSFERENCIA',
      monto: 425_233,
      creditoDestinoId: 'zero',
      cuentaOrigenId: 'nequi',
    }),
    movimiento({
      id: 'pago-otro',
      fecha: '2026-10-29',
      tipo: 'TRANSFERENCIA',
      monto: 5,
      creditoDestinoId: 'rappi',
      cuentaOrigenId: 'nequi',
    }),
  ];

  it('trae solo las compras de ese crédito, con la fecha real de la compra', () => {
    const r = armarReporteCredito(zeroG, compras, movimientos, [nequi], HOY);
    expect(r.compras.map((c) => c.descripcion)).toEqual(['vieja', 'gym']);
    expect(r.compras[1].fecha).toBe('2026-09-29'); // la del movimiento, no la de las cuotas
  });

  it('dice en qué cuota va cada compra y cuánto queda', () => {
    const [vieja, gym] = armarReporteCredito(zeroG, compras, movimientos, [nequi], HOY).compras;
    expect(vieja).toMatchObject({ terminada: true, cuotaActual: 2, numCuotas: 2, saldoPendiente: 0 });
    // cuotas desde el 8 de octubre, hoy 9 de noviembre: pasó 1 mes → cuota 2 de 5, quedan 4
    expect(gym).toMatchObject({
      terminada: false,
      cuotaActual: 2,
      valorCuota: 51_000,
      saldoPendiente: 204_000,
    });
  });

  it('suma la deuda, la cuota del mes y el cupo que queda', () => {
    const r = armarReporteCredito(zeroG, compras, movimientos, [nequi], HOY);
    expect(r.deuda).toBe(204_000);
    expect(r.cuotaDelMes).toBe(51_000);
    expect(r.cupoDisponible).toBe(2_200_000 - 204_000);
  });

  it('lista los pagos de ese crédito con el nombre de la cuenta de la que salieron', () => {
    const r = armarReporteCredito(zeroG, compras, movimientos, [nequi], HOY);
    expect(r.pagos).toEqual([{ fecha: '2026-10-28', cuenta: 'Nequi', monto: 425_233 }]);
    expect(r.totalPagado).toBe(425_233);
  });

  it('sin compras ni pagos da todo en cero', () => {
    const r = armarReporteCredito(zeroG, [], [], [], HOY);
    expect(r).toMatchObject({ compras: [], pagos: [], deuda: 0, cuotaDelMes: 0, totalPagado: 0 });
  });
});
