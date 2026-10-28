import type { Cuenta, Movimiento } from '../models';
import { disponible, esBolsillo, reservado, saldoCuenta, saldoTotalCuenta } from './cuentas';

function cuenta(datos: Partial<Cuenta> & Pick<Cuenta, 'id'>): Cuenta {
  return {
    nombre: datos.id,
    tipo: 'BANCO',
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

function movimiento(datos: Partial<Movimiento> & Pick<Movimiento, 'id'>): Movimiento {
  return {
    fecha: '2026-09-01',
    tipo: 'TRANSFERENCIA',
    monto: 0,
    descripcion: '',
    creadoEn: '2026-09-01',
    ...datos,
  };
}

describe('esBolsillo', () => {
  it('es false para una cuenta raíz', () => {
    expect(esBolsillo(cuenta({ id: 'bancolombia' }))).toBe(false);
  });

  it('es true para una cuenta con cuentaPadreId', () => {
    expect(esBolsillo(cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia' }))).toBe(true);
  });
});

describe('saldoCuenta', () => {
  it('parte del saldo inicial cuando no hay movimientos', () => {
    expect(saldoCuenta(cuenta({ id: 'nequi', saldoInicial: 50_000 }), [])).toBe(50_000);
  });

  it('suma los movimientos donde la cuenta es destino', () => {
    const c = cuenta({ id: 'nequi', saldoInicial: 50_000 });
    const movimientos = [movimiento({ id: 'm1', cuentaDestinoId: 'nequi', monto: 20_000 })];
    expect(saldoCuenta(c, movimientos)).toBe(70_000);
  });

  it('resta los movimientos donde la cuenta es origen', () => {
    const c = cuenta({ id: 'nequi', saldoInicial: 50_000 });
    const movimientos = [movimiento({ id: 'm1', cuentaOrigenId: 'nequi', monto: 15_000 })];
    expect(saldoCuenta(c, movimientos)).toBe(35_000);
  });
});

describe('saldoTotalCuenta', () => {
  it('es saldo libre + suma de bolsillos', () => {
    const madre = cuenta({ id: 'bancolombia', saldoInicial: 100_000 });
    const bolsillo = cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia', saldoInicial: 30_000 });
    const movimientos = [
      movimiento({
        id: 'm1',
        cuentaOrigenId: 'bancolombia',
        cuentaDestinoId: 'viaje',
        monto: 10_000,
        tipo: 'INTERNO',
      }),
    ];
    expect(saldoTotalCuenta(madre, [madre, bolsillo], movimientos)).toBe(130_000);
  });

  it('no cambia al mover dinero entre saldo libre y un bolsillo', () => {
    const madre = cuenta({ id: 'bancolombia', saldoInicial: 100_000 });
    const bolsillo = cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia', saldoInicial: 0 });
    const antes = saldoTotalCuenta(madre, [madre, bolsillo], []);
    const movimientos = [
      movimiento({
        id: 'm1',
        cuentaOrigenId: 'bancolombia',
        cuentaDestinoId: 'viaje',
        monto: 25_000,
        tipo: 'INTERNO',
      }),
    ];
    const despues = saldoTotalCuenta(madre, [madre, bolsillo], movimientos);
    expect(despues).toBe(antes);
  });
});

describe('disponible', () => {
  it('suma cuentas raíz que suman en el disponible y bolsillos no reservados', () => {
    const cuentas = [
      cuenta({ id: 'bancolombia', saldoInicial: 200_000, sumaEnDisponible: true }),
      cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia', saldoInicial: 50_000, reservado: false }),
      cuenta({
        id: 'emergencias',
        cuentaPadreId: 'bancolombia',
        saldoInicial: 300_000,
        reservado: true,
      }),
    ];
    expect(disponible(cuentas, [])).toBe(250_000);
  });

  it('ignora cuentas archivadas', () => {
    const cuentas = [cuenta({ id: 'vieja', saldoInicial: 100_000, archivada: true })];
    expect(disponible(cuentas, [])).toBe(0);
  });

  it('ignora cuentas raíz que no suman en el disponible', () => {
    const cuentas = [cuenta({ id: 'otro', saldoInicial: 500_000, sumaEnDisponible: false })];
    expect(disponible(cuentas, [])).toBe(0);
  });
});

describe('reservado', () => {
  it('suma solo los bolsillos marcados como reservados', () => {
    const cuentas = [
      cuenta({ id: 'bancolombia', saldoInicial: 200_000 }),
      cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia', saldoInicial: 50_000, reservado: false }),
      cuenta({
        id: 'emergencias',
        cuentaPadreId: 'bancolombia',
        saldoInicial: 300_000,
        reservado: true,
      }),
    ];
    expect(reservado(cuentas, [])).toBe(300_000);
  });
});
