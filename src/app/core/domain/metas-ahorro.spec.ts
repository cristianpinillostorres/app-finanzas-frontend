import type { Cuenta, MetaAhorro, Movimiento } from '../models';
import { inicioDelCiclo } from './ciclo-pago';
import {
  aporteFaltanteTotal,
  aportadoAlBolsillo,
  libreDespuesDeAhorrar,
  progresoDeMeta,
} from './metas-ahorro';

const BOLSILLO = 'bolsillo-viaje';

function cuenta(parcial: Partial<Cuenta> & Pick<Cuenta, 'id'>): Cuenta {
  return {
    nombre: parcial.id,
    tipo: 'BANCO',
    color: 'azul',
    cuentaPadreId: null,
    saldoInicial: 0,
    sumaEnDisponible: true,
    reservado: false,
    archivada: false,
    creadoEn: '2026-01-01T00:00:00Z',
    ...parcial,
  };
}

function mov(parcial: Partial<Movimiento> & Pick<Movimiento, 'tipo' | 'monto'>): Movimiento {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: '2026-11-05',
    descripcion: '',
    creadoEn: '2026-11-05T12:00:00Z',
    ...parcial,
  };
}

const meta: MetaAhorro = {
  id: 'm1',
  nombre: 'Viaje',
  objetivo: 1_000_000,
  aporteMensual: 200_000,
  bolsilloId: BOLSILLO,
};
const cuentas = [
  cuenta({ id: 'ahorros' }),
  cuenta({ id: BOLSILLO, cuentaPadreId: 'ahorros', reservado: true }),
];
const CICLO = new Date(2026, 10, 1);

describe('inicioDelCiclo', () => {
  it('es el último día de pago que ya llegó', () => {
    expect(inicioDelCiclo(new Date(2026, 10, 25), 20)).toEqual(new Date(2026, 10, 20));
  });

  it('antes del pago de este mes, es el del mes pasado', () => {
    expect(inicioDelCiclo(new Date(2026, 10, 9), 20)).toEqual(new Date(2026, 9, 20));
  });

  it('el mismo día de pago, el ciclo empieza hoy', () => {
    expect(inicioDelCiclo(new Date(2026, 10, 20), 20)).toEqual(new Date(2026, 10, 20));
  });

  it('un día 31 cae en el último día de los meses cortos', () => {
    expect(inicioDelCiclo(new Date(2026, 10, 9), 31)).toEqual(new Date(2026, 9, 31));
    expect(inicioDelCiclo(new Date(2026, 2, 5), 31)).toEqual(new Date(2026, 1, 28));
  });

  it('sin día de pago, el ciclo es el mes calendario', () => {
    expect(inicioDelCiclo(new Date(2026, 10, 9), null)).toEqual(new Date(2026, 10, 1));
  });
});

describe('aportadoAlBolsillo', () => {
  it('suma lo que entró desde el inicio del ciclo y resta lo que salió', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 150_000, cuentaDestinoId: BOLSILLO, fecha: '2026-11-03' }),
      mov({ tipo: 'INTERNO', monto: 30_000, cuentaOrigenId: BOLSILLO, fecha: '2026-11-04' }),
      mov({ tipo: 'INTERNO', monto: 999_000, cuentaDestinoId: BOLSILLO, fecha: '2026-10-31' }),
    ];
    expect(aportadoAlBolsillo(BOLSILLO, movimientos, CICLO)).toBe(120_000);
  });

  it('no baja de cero', () => {
    const movimientos = [mov({ tipo: 'INTERNO', monto: 50_000, cuentaOrigenId: BOLSILLO })];
    expect(aportadoAlBolsillo(BOLSILLO, movimientos, CICLO)).toBe(0);
  });
});

describe('progresoDeMeta', () => {
  it('toma lo ahorrado del saldo del bolsillo', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 300_000, cuentaDestinoId: BOLSILLO, fecha: '2026-10-10' }),
      mov({ tipo: 'INTERNO', monto: 50_000, cuentaDestinoId: BOLSILLO, fecha: '2026-11-04' }),
    ];
    const p = progresoDeMeta(meta, cuentas, movimientos, CICLO);
    expect(p.ahorrado).toBe(350_000);
    expect(p.falta).toBe(650_000);
    expect(p.proporcion).toBeCloseTo(0.35);
    expect(p.aportadoEnCiclo).toBe(50_000);
    expect(p.aporteFaltante).toBe(150_000);
    expect(p.mesesParaLlegar).toBe(4);
    expect(p.cumplida).toBe(false);
  });

  it('con el aporte del ciclo cumplido ya no falta apartar nada', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 250_000, cuentaDestinoId: BOLSILLO, fecha: '2026-11-04' }),
    ];
    expect(progresoDeMeta(meta, cuentas, movimientos, CICLO).aporteFaltante).toBe(0);
  });

  it('nunca pide apartar más de lo que falta para llegar', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 900_000, cuentaDestinoId: BOLSILLO, fecha: '2026-10-10' }),
    ];
    const p = progresoDeMeta(meta, cuentas, movimientos, CICLO);
    expect(p.falta).toBe(100_000);
    expect(p.aporteFaltante).toBe(100_000);
  });

  it('una meta alcanzada no pide aporte', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 1_000_000, cuentaDestinoId: BOLSILLO, fecha: '2026-10-10' }),
    ];
    const p = progresoDeMeta(meta, cuentas, movimientos, CICLO);
    expect(p.cumplida).toBe(true);
    expect(p.aporteFaltante).toBe(0);
    expect(p.mesesParaLlegar).toBeNull();
  });

  it('con el aporte en pausa no calcula meses ni pide nada', () => {
    const p = progresoDeMeta({ ...meta, aporteMensual: 0 }, cuentas, [], CICLO);
    expect(p.aporteFaltante).toBe(0);
    expect(p.mesesParaLlegar).toBeNull();
  });

  it('sin objetivo solo ahorra: sin falta, sin meses y el aporte del ciclo sigue contando', () => {
    const movimientos = [
      mov({ tipo: 'INTERNO', monto: 470_000, cuentaDestinoId: BOLSILLO, fecha: '2026-10-10' }),
      mov({ tipo: 'INTERNO', monto: 100_000, cuentaDestinoId: BOLSILLO, fecha: '2026-11-04' }),
    ];
    const p = progresoDeMeta({ ...meta, objetivo: 0, aporteMensual: 250_000 }, cuentas, movimientos, CICLO);
    expect(p.sinObjetivo).toBe(true);
    expect(p.ahorrado).toBe(570_000);
    expect(p.falta).toBe(0);
    expect(p.cumplida).toBe(false);
    expect(p.mesesParaLlegar).toBeNull();
    expect(p.aporteFaltante).toBe(150_000);
  });

  it('si el bolsillo ya no existe, no cuenta lo ahorrado y lo avisa', () => {
    const p = progresoDeMeta(meta, [cuenta({ id: 'ahorros' })], [], CICLO);
    expect(p.sinBolsillo).toBe(true);
    expect(p.ahorrado).toBe(0);
  });
});

describe('ahorro y gasto diario', () => {
  it('suma lo que falta apartar de todas las metas', () => {
    const a = progresoDeMeta(meta, cuentas, [], CICLO);
    const b = progresoDeMeta({ ...meta, id: 'm2', aporteMensual: 50_000 }, cuentas, [], CICLO);
    expect(aporteFaltanteTotal([a, b])).toBe(200_000 + 50_000);
  });

  it('lo libre baja en lo que falta apartar', () => {
    expect(libreDespuesDeAhorrar(355_232, 100_000)).toBe(255_232);
  });

  it('no aparta más de lo que hay libre', () => {
    expect(libreDespuesDeAhorrar(60_000, 100_000)).toBe(0);
  });

  it('sin plata libre deja el valor como está', () => {
    expect(libreDespuesDeAhorrar(-20_000, 100_000)).toBe(-20_000);
  });
});
