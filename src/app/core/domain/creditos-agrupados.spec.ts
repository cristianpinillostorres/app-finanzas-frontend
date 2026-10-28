import type { CreditoBanco, CreditoPersona, CreditoTarjeta } from '../models';
import { agruparCreditosPorTipo } from './creditos-agrupados';

const HOY = new Date(2026, 8, 11); // 11 de septiembre de 2026

describe('agruparCreditosPorTipo', () => {
  it('omite los grupos sin créditos', () => {
    expect(agruparCreditosPorTipo([], { hoy: HOY })).toEqual([]);
  });

  it('excluye créditos archivados', () => {
    const visa: CreditoTarjeta = {
      id: 'visa',
      grupo: 'TARJETA',
      nombre: 'Visa',
      diaPago: 5,
      diaCorte: 20,
      cupo: 5_000_000,
      archivado: true,
    };
    expect(agruparCreditosPorTipo([visa], { hoy: HOY })).toEqual([]);
  });

  it('respeta el orden fijo de grupos y ordena por fecha límite más cercana dentro del grupo', () => {
    const vehiculo: CreditoBanco = {
      id: 'vehiculo',
      grupo: 'BANCO',
      nombre: 'Vehículo',
      diaPago: 25, // más lejos
      monto: 10_000_000,
      tasaEa: 0.18,
      tipoTasa: 'FIJA',
      plazoMeses: 36,
      cuotasPagadasIniciales: 0,
      seguroMensual: 0,
      archivado: false,
    };
    const libreInversion: CreditoBanco = {
      id: 'libre-inversion',
      grupo: 'BANCO',
      nombre: 'Libre inversión',
      diaPago: 15, // más cerca
      monto: 5_000_000,
      tasaEa: 0.2,
      tipoTasa: 'FIJA',
      plazoMeses: 24,
      cuotasPagadasIniciales: 0,
      seguroMensual: 0,
      archivado: false,
    };
    const visa: CreditoTarjeta = {
      id: 'visa',
      grupo: 'TARJETA',
      nombre: 'Visa',
      diaPago: 5,
      diaCorte: 20,
      cupo: 5_000_000,
      archivado: false,
    };

    const grupos = agruparCreditosPorTipo([vehiculo, libreInversion, visa], { hoy: HOY });

    expect(grupos.map((g) => g.grupo)).toEqual(['TARJETA', 'BANCO']);
    const bancos = grupos.find((g) => g.grupo === 'BANCO')!;
    expect(bancos.creditos.map((c) => c.credito.id)).toEqual(['libre-inversion', 'vehiculo']);
  });

  it('las personas quedan al final, sin estado de pago', () => {
    const persona: CreditoPersona = {
      id: 'prestamo-juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    const visa: CreditoTarjeta = {
      id: 'visa',
      grupo: 'TARJETA',
      nombre: 'Visa',
      diaPago: 5,
      diaCorte: 20,
      cupo: 5_000_000,
      archivado: false,
    };

    const grupos = agruparCreditosPorTipo([persona, visa], { hoy: HOY });

    expect(grupos.map((g) => g.grupo)).toEqual(['TARJETA', 'PERSONA']);
    expect(grupos.find((g) => g.grupo === 'PERSONA')!.creditos[0].estadoPago).toBeNull();
  });
});
