import { describe, expect, it } from 'vitest';

import type { CompraCuotas, Credito, Movimiento } from '../models';
import { creditosConCuotasPendientes } from './progreso-creditos';

const hoy = new Date(2026, 8, 11); // 11 de septiembre de 2026

const banco: Credito = {
  id: 'cr-banco',
  nombre: 'Libre inversión',
  grupo: 'BANCO',
  diaPago: 10,
  archivado: false,
  monto: 10_000_000,
  tasaEa: 0.22,
  tipoTasa: 'FIJA',
  plazoMeses: 24,
  cuotasPagadasIniciales: 12,
  seguroMensual: 18_000,
};

const bancoPagado: Credito = { ...banco, id: 'cr-banco-pagado', cuotasPagadasIniciales: 24 };

const tarjeta: Credito = {
  id: 'cr-tarjeta',
  nombre: 'Tarjeta',
  grupo: 'TARJETA',
  diaPago: 15,
  diaCorte: 1,
  archivado: false,
  cupo: 5_000_000,
};

const persona: Credito = {
  id: 'cr-persona',
  nombre: 'Préstamo',
  grupo: 'PERSONA',
  diaPago: 1,
  archivado: false,
  monto: 900_000,
};

function compra(parciales: Partial<CompraCuotas>): CompraCuotas {
  return {
    id: 'c',
    creditoId: 'cr-tarjeta',
    movimientoId: 'm',
    descripcion: '',
    monto: 600_000,
    numCuotas: 6,
    fecha: '2026-07-01', // 2 meses antes de "hoy": van 2 cuotas, faltan 4.
    ...parciales,
  };
}

describe('creditosConCuotasPendientes', () => {
  it('un banco usa su plazo fijo: pagadas/plazo', () => {
    const resultado = creditosConCuotasPendientes([banco], [], [], hoy);
    expect(resultado).toEqual([{ credito: banco, faltan: 12, total: 24, progreso: 50 }]);
  });

  it('un banco ya pagado por completo no aparece', () => {
    expect(creditosConCuotasPendientes([bancoPagado], [], [], hoy)).toEqual([]);
  });

  it('tarjeta/plataforma usan la compra con más cuotas por delante', () => {
    const compras = [
      compra({ id: 'c1', numCuotas: 6, fecha: '2026-07-01' }), // faltan 4 de 6
      compra({ id: 'c2', numCuotas: 3, fecha: '2026-08-01' }), // faltan 2 de 3
    ];

    const resultado = creditosConCuotasPendientes([tarjeta], compras, [], hoy);

    expect(resultado).toEqual([{ credito: tarjeta, faltan: 4, total: 6, progreso: 33 }]);
  });

  it('una tarjeta sin compras pendientes no aparece', () => {
    expect(creditosConCuotasPendientes([tarjeta], [], [], hoy)).toEqual([]);
  });

  it('las personas no manejan cuotas y no aparecen', () => {
    expect(creditosConCuotasPendientes([persona], [], [], hoy)).toEqual([]);
  });

  it('los créditos archivados no aparecen', () => {
    expect(creditosConCuotasPendientes([{ ...banco, archivado: true }], [], [], hoy)).toEqual([]);
  });
});
