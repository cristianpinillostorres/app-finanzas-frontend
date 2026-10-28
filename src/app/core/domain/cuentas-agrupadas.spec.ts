import type { Cuenta, Movimiento } from '../models';
import { agruparCuentasPorTipo } from './cuentas-agrupadas';

function cuenta(datos: Partial<Cuenta> & Pick<Cuenta, 'id' | 'nombre' | 'tipo'>): Cuenta {
  return {
    color: '#000000',
    cuentaPadreId: null,
    saldoInicial: 0,
    sumaEnDisponible: true,
    reservado: false,
    archivada: false,
    creadoEn: '2026-01-01',
    ...datos,
  };
}

describe('agruparCuentasPorTipo', () => {
  it('devuelve los 4 grupos en orden fijo, incluso vacíos', () => {
    const grupos = agruparCuentasPorTipo([], []);
    expect(grupos.map((g) => g.tipo)).toEqual(['BANCO', 'BILLETERA', 'EFECTIVO', 'OTRO']);
    expect(grupos.every((g) => g.cuentas.length === 0 && g.subtotal === 0)).toBe(true);
  });

  it('agrupa cuentas raíz por tipo y calcula el subtotal del grupo', () => {
    const cuentas = [
      cuenta({ id: 'banco-1', nombre: 'Bancolombia', tipo: 'BANCO', saldoInicial: 1_000_000 }),
      cuenta({ id: 'billetera-1', nombre: 'Nequi', tipo: 'BILLETERA', saldoInicial: 200_000 }),
      cuenta({ id: 'billetera-2', nombre: 'Daviplata', tipo: 'BILLETERA', saldoInicial: 100_000 }),
    ];

    const grupos = agruparCuentasPorTipo(cuentas, []);
    const banco = grupos.find((g) => g.tipo === 'BANCO')!;
    const billetera = grupos.find((g) => g.tipo === 'BILLETERA')!;

    expect(banco.cuentas.map((c) => c.cuenta.id)).toEqual(['banco-1']);
    expect(banco.subtotal).toBe(1_000_000);
    expect(billetera.subtotal).toBe(300_000);
  });

  it('separa saldo libre, total y bolsillos de una cuenta con bolsillos', () => {
    const cuentas = [
      cuenta({ id: 'raiz', nombre: 'Bancolombia', tipo: 'BANCO', saldoInicial: 2_000_000 }),
      cuenta({
        id: 'viaje',
        nombre: 'Viaje',
        tipo: 'BANCO',
        cuentaPadreId: 'raiz',
        saldoInicial: 0,
      }),
    ];
    const movimientos: Movimiento[] = [
      {
        id: 'm1',
        fecha: '2026-01-05',
        tipo: 'INTERNO',
        monto: 300_000,
        descripcion: 'Ahorro para viaje',
        cuentaOrigenId: 'raiz',
        cuentaDestinoId: 'viaje',
        creadoEn: '2026-01-05',
      },
    ];

    const [banco] = agruparCuentasPorTipo(cuentas, movimientos);
    const [item] = banco.cuentas;

    expect(item.saldoLibre).toBe(1_700_000);
    expect(item.saldoTotal).toBe(2_000_000);
    expect(item.bolsillos).toEqual([{ cuenta: cuentas[1], saldo: 300_000 }]);
    expect(banco.subtotal).toBe(2_000_000);
  });

  it('excluye cuentas y bolsillos archivados', () => {
    const cuentas = [
      cuenta({ id: 'raiz', nombre: 'Efectivo', tipo: 'EFECTIVO', saldoInicial: 50_000 }),
      cuenta({
        id: 'archivada',
        nombre: 'Vieja',
        tipo: 'EFECTIVO',
        saldoInicial: 10_000,
        archivada: true,
      }),
      cuenta({
        id: 'bolsillo-archivado',
        nombre: 'Extra',
        tipo: 'EFECTIVO',
        cuentaPadreId: 'raiz',
        saldoInicial: 5_000,
        archivada: true,
      }),
    ];

    const [, , efectivo] = agruparCuentasPorTipo(cuentas, []);

    expect(efectivo.cuentas.map((c) => c.cuenta.id)).toEqual(['raiz']);
    expect(efectivo.cuentas[0].bolsillos).toEqual([]);
  });
});
