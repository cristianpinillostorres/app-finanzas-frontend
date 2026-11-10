import { describe, expect, it } from 'vitest';

import type { ReporteMovimientos } from '../../core/domain';
import { armarPdfMovimientos, nombreArchivoMovimientos } from './pdf-movimientos';

function reporte(filas = 3): ReporteMovimientos {
  return {
    rango: { desde: '2026-11-01', hasta: '2026-11-30' },
    filas: Array.from({ length: filas }, (_, i) => ({
      fecha: '2026-11-05',
      tipo: i % 2 === 0 ? ('GASTO' as const) : ('INGRESO' as const),
      descripcion: `Movimiento ${i}`,
      categoria: 'Restaurantes',
      cuenta: 'Cuenta ahorros › Ahorro',
      monto: 30_000 + i,
    })),
    ingresos: 100_000,
    gastos: 90_000,
    balance: 10_000,
  };
}

describe('nombreArchivoMovimientos', () => {
  it('un mes completo lleva el mes', () => {
    expect(nombreArchivoMovimientos(reporte())).toBe('movimientos-2026-11.pdf');
  });

  it('sin rango dice "todo"', () => {
    expect(nombreArchivoMovimientos({ ...reporte(), rango: { desde: null, hasta: null } })).toBe(
      'movimientos-todo.pdf',
    );
  });

  it('un rango que cruza meses lleva las dos fechas', () => {
    expect(
      nombreArchivoMovimientos({ ...reporte(), rango: { desde: '2026-10-15', hasta: '2026-11-14' } }),
    ).toBe('movimientos-2026-10-15-a-2026-11-14.pdf');
  });
});

describe('armarPdfMovimientos', () => {
  it('arma un PDF de verdad con el nombre del periodo', async () => {
    const { nombre, blob, paginas } = await armarPdfMovimientos(
      reporte(),
      'Movimientos de Noviembre de 2026',
    );
    expect(nombre).toBe('movimientos-2026-11.pdf');
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(1500);
    expect(paginas).toBe(1);
  });

  it('con cientos de movimientos reparte la tabla en varias hojas', async () => {
    const { paginas } = await armarPdfMovimientos(reporte(400), 'Todos los movimientos');
    expect(paginas).toBeGreaterThan(5);
  });
});
