import { describe, expect, it } from 'vitest';

import type { Categoria, Credito, Cuenta, Movimiento } from '../models';
import { armarReporteMovimientos, rangoReporte } from './reporte-movimientos';

function cuenta(id: string, nombre: string, cuentaPadreId: string | null = null): Cuenta {
  return {
    id,
    nombre,
    tipo: 'BANCO',
    color: '#000000',
    cuentaPadreId,
    saldoInicial: 0,
    sumaEnDisponible: true,
    reservado: false,
    archivada: false,
    creadoEn: '2026-01-01',
  };
}

function movimiento(datos: Partial<Movimiento> & Pick<Movimiento, 'id' | 'fecha' | 'tipo'>): Movimiento {
  return { monto: 0, descripcion: '', creadoEn: `${datos.fecha}T10:00:00`, ...datos };
}

const nequi = cuenta('nequi', 'Nequi');
const ahorros = cuenta('ahorros', 'Cuenta ahorros');
const bolsillo = cuenta('bolsillo', 'Ahorro', 'ahorros');
const zeroG = {
  id: 'zero',
  grupo: 'TARJETA',
  nombre: 'Zero G',
  diaPago: 25,
  diaCorte: 8,
  cupo: 2_200_000,
  archivado: false,
} as Credito;
const comida = { id: 'cat-comida', nombre: 'Restaurantes', tipo: 'GASTO' } as Categoria;
const catalogos = { cuentas: [nequi, ahorros, bolsillo], creditos: [zeroG], categorias: [comida] };

describe('rangoReporte', () => {
  const HOY = new Date(2026, 10, 9); // 9 de noviembre de 2026

  it('este mes va del 1 al último día', () => {
    expect(rangoReporte('este-mes', HOY)).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
  });

  it('el mes anterior también, y cruza el cambio de año', () => {
    expect(rangoReporte('mes-anterior', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoReporte('mes-anterior', new Date(2027, 0, 15))).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
  });

  it('todo no acota nada', () => {
    expect(rangoReporte('todo', HOY)).toEqual({ desde: null, hasta: null });
  });
});

describe('armarReporteMovimientos', () => {
  const movimientos = [
    movimiento({ id: 'g1', fecha: '2026-11-05', tipo: 'GASTO', monto: 30_000, descripcion: 'Almuerzo', categoriaId: 'cat-comida', cuentaOrigenId: 'nequi' }),
    movimiento({ id: 'i1', fecha: '2026-11-02', tipo: 'INGRESO', monto: 100_000, descripcion: 'Pago', cuentaDestinoId: 'bolsillo' }),
    movimiento({ id: 't1', fecha: '2026-11-03', tipo: 'TRANSFERENCIA', monto: 50_000, cuentaOrigenId: 'nequi', creditoDestinoId: 'zero' }),
    movimiento({ id: 'v1', fecha: '2026-10-20', tipo: 'GASTO', monto: 999, cuentaOrigenId: 'nequi' }),
  ];

  it('deja solo lo que cae en el rango, de más viejo a más nuevo', () => {
    const r = armarReporteMovimientos(movimientos, catalogos, { desde: '2026-11-01', hasta: '2026-11-30' });
    expect(r.filas.map((f) => f.fecha)).toEqual(['2026-11-02', '2026-11-03', '2026-11-05']);
  });

  it('sin rango trae todo', () => {
    const r = armarReporteMovimientos(movimientos, catalogos, { desde: null, hasta: null });
    expect(r.filas).toHaveLength(4);
  });

  it('habla de cuentas, bolsillos, créditos y categorías por su nombre', () => {
    const r = armarReporteMovimientos(movimientos, catalogos, { desde: '2026-11-01', hasta: '2026-11-30' });
    const [ingreso, transferencia, gasto] = r.filas;
    expect(ingreso.cuenta).toBe('Cuenta ahorros › Ahorro'); // un bolsillo lleva su cuenta
    expect(transferencia.cuenta).toBe('Nequi > Zero G');
    expect(gasto.cuenta).toBe('Nequi');
    expect(gasto.categoria).toBe('Restaurantes');
  });

  it('suma ingresos y gastos como General, sin contar transferencias', () => {
    const r = armarReporteMovimientos(movimientos, catalogos, { desde: '2026-11-01', hasta: '2026-11-30' });
    expect(r.ingresos).toBe(100_000);
    expect(r.gastos).toBe(30_000);
    expect(r.balance).toBe(70_000);
  });

  it('un movimiento de una cuenta que ya no existe sale sin nombre, sin romperse', () => {
    const huerfano = movimiento({ id: 'h', fecha: '2026-11-04', tipo: 'GASTO', monto: 1, cuentaOrigenId: 'borrada' });
    const r = armarReporteMovimientos([huerfano], catalogos, { desde: null, hasta: null });
    expect(r.filas[0].cuenta).toBe('');
  });
});
