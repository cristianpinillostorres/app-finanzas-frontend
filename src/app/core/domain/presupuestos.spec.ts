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

  it('lo que no tiene tope propio descuenta de "Otros gastos" si ese tiene tope', () => {
    const categorias = [
      categoria({ id: 'rest', topeMensual: 300 }),
      categoria({ id: 'cat-otros-gastos', topeMensual: 150 }),
      categoria({ id: 'servicios' }),
    ];
    const movimientos = [
      gasto({ categoriaId: 'rest', monto: 100 }),
      gasto({ categoriaId: 'servicios', monto: 38 }),
      gasto({ categoriaId: 'cat-otros-gastos', monto: 10 }),
      gasto({ monto: 5 }),
    ];

    const otros = presupuestosDelMes(categorias, movimientos, octubre).find(
      (p) => p.categoria.id === 'cat-otros-gastos',
    )!;

    expect(otros.gastado).toBe(53);
    expect(otros.deOtras).toBe(43);
    expect(otros.restante).toBe(97);
  });

  it('sin tope en "Otros gastos", lo suelto no se cuenta en ningún lado', () => {
    const categorias = [categoria({ id: 'rest', topeMensual: 300 }), categoria({ id: 'servicios' })];
    const movimientos = [gasto({ categoriaId: 'servicios', monto: 38 })];

    const [rest] = presupuestosDelMes(categorias, movimientos, octubre);

    expect(rest.gastado).toBe(0);
  });

  describe('ritmo de gasto', () => {
    const categorias = [categoria({ id: 'rest', topeMensual: 200 })];
    const gastar = (monto: number) => [gasto({ categoriaId: 'rest', monto })];
    const primerTercio = 10 / 30;

    it('avisa antes del 80 % si se gasta más de 1,2 veces más rápido que el mes', () => {
      const [p] = presupuestosDelMes(categorias, gastar(140), octubre, primerTercio);
      expect(p.ritmoAlto).toBe(true);
      expect(p.estado).toBe('cerca');
    });

    it('no avisa si el ritmo va con el mes', () => {
      const [p] = presupuestosDelMes(categorias, gastar(140), octubre, 20 / 30);
      expect(p.ritmoAlto).toBe(false);
      expect(p.estado).toBe('bien');
    });

    it('no avisa con menos de la mitad del tope ni en los primeros días', () => {
      expect(presupuestosDelMes(categorias, gastar(90), octubre, primerTercio)[0].ritmoAlto).toBe(
        false,
      );
      expect(presupuestosDelMes(categorias, gastar(150), octubre, 2 / 30)[0].ritmoAlto).toBe(false);
    });

    it('sin el avance del mes no hay aviso por ritmo', () => {
      expect(presupuestosDelMes(categorias, gastar(140), octubre)[0].ritmoAlto).toBe(false);
    });
  });

  it('deja fuera las ocultas y las de ingreso', () => {
    const categorias = [
      categoria({ id: 'oculta', topeMensual: 100, archivada: true }),
      categoria({ id: 'ingreso', topeMensual: 100, tipo: 'INGRESO' }),
    ];
    expect(presupuestosDelMes(categorias, [], octubre)).toEqual([]);
  });
});
