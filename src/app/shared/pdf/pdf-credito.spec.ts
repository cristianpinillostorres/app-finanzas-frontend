import { describe, expect, it } from 'vitest';

import type { ReporteCredito } from '../../core/domain';
import { armarPdfCredito, nombreArchivoCredito } from './pdf-credito';

function reporte(compras = 2, pagos = 1): ReporteCredito {
  return {
    nombre: 'Zero G',
    compras: Array.from({ length: compras }, (_, i) => ({
      fecha: '2026-09-29',
      descripcion: `Compra ${i}`,
      monto: 255_000,
      cuotaActual: 2,
      numCuotas: 5,
      valorCuota: 51_000,
      saldoPendiente: 204_000,
      terminada: i % 5 === 4,
    })),
    pagos: Array.from({ length: pagos }, () => ({
      fecha: '2026-10-28',
      cuenta: 'Cuenta ahorros › Ahorro',
      monto: 425_233,
    })),
    deuda: 408_000,
    cuotaDelMes: 102_000,
    totalPagado: 425_233,
    cupoDisponible: 1_792_000,
  };
}

describe('nombreArchivoCredito', () => {
  it('queda sin tildes, símbolos ni espacios, con el día', () => {
    expect(nombreArchivoCredito('Zero G', new Date(2026, 10, 9))).toBe('zero-g-compras-2026-11-09.pdf');
    expect(nombreArchivoCredito('Crédito de vehículo', new Date(2026, 10, 9))).toBe(
      'credito-de-vehiculo-compras-2026-11-09.pdf',
    );
  });

  it('con un nombre sin letras ni números usa uno de respaldo', () => {
    expect(nombreArchivoCredito('¡¡¡', new Date(2026, 10, 9))).toBe('credito-compras-2026-11-09.pdf');
  });
});

describe('armarPdfCredito', () => {
  it('arma un PDF de verdad con el nombre de la tarjeta', async () => {
    const { nombre, blob, paginas } = await armarPdfCredito(reporte(), new Date(2026, 10, 9));
    expect(nombre).toBe('zero-g-compras-2026-11-09.pdf');
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
    expect(paginas).toBe(1);
  });

  it('sin compras ni pagos arma el PDF igual, con el aviso de vacío', async () => {
    const { blob } = await armarPdfCredito(reporte(0, 0));
    expect(blob.size).toBeGreaterThan(1500);
  });

  it('una tarjeta con muchas compras sigue en varias hojas, sin romperse', async () => {
    const { paginas } = await armarPdfCredito(reporte(300, 60));
    expect(paginas).toBeGreaterThan(3);
  });
});
