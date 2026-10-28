import type { ItemPagoFijoMes, ResumenPagosFijosMes } from './pagos-fijos-agrupados';
import { lineaDelMes, tramoDePago } from './linea-del-mes';

const OCTUBRE = { anio: 2026, mes: 10 };
const HOY = new Date(2026, 9, 15, 9, 30);

function item(datos: Partial<ItemPagoFijoMes> & Pick<ItemPagoFijoMes, 'id'>): ItemPagoFijoMes {
  return {
    nombre: datos.id,
    esCredito: false,
    pagado: false,
    marcadoSinMovimiento: false,
    fechaLimite: new Date(2026, 9, 20),
    monto: 100_000,
    esEstimado: false,
    estado: 'verde',
    periodo: '2026-10',
    ...datos,
  };
}

function resumen(items: ItemPagoFijoMes[], mes = OCTUBRE): ResumenPagosFijosMes {
  return {
    mes,
    porPagar: items.filter((i) => !i.pagado),
    pagados: items.filter((i) => i.pagado),
    totalMes: 0,
    totalPagado: 0,
    totalPorPagar: 0,
    progreso: 0,
  };
}

describe('tramoDePago', () => {
  it('separa vencido, esta semana (hoy incluido), después y pagado', () => {
    expect(tramoDePago(item({ id: 'a', fechaLimite: new Date(2026, 9, 14) }), HOY)).toBe('vencido');
    expect(tramoDePago(item({ id: 'b', fechaLimite: new Date(2026, 9, 15) }), HOY)).toBe('semana');
    expect(tramoDePago(item({ id: 'c', fechaLimite: new Date(2026, 9, 21) }), HOY)).toBe('semana');
    expect(tramoDePago(item({ id: 'd', fechaLimite: new Date(2026, 9, 22) }), HOY)).toBe('despues');
    expect(
      tramoDePago(item({ id: 'e', fechaLimite: new Date(2026, 9, 1), pagado: true }), HOY),
    ).toBe('pagado');
  });
});

describe('lineaDelMes', () => {
  it('agrupa por día, en orden, con pendientes antes que pagados', () => {
    const linea = lineaDelMes(
      resumen([
        item({ id: 'Internet', fechaLimite: new Date(2026, 9, 20) }),
        item({ id: 'Arriendo', fechaLimite: new Date(2026, 9, 5), pagado: true }),
        item({ id: 'Administración', fechaLimite: new Date(2026, 9, 5) }),
      ]),
      HOY,
    );

    expect(linea.dias.map((d) => d.fecha.getDate())).toEqual([5, 20]);
    expect(linea.dias[0].items.map((i) => i.id)).toEqual(['Administración', 'Arriendo']);
    expect(linea.diasDelMes).toBe(31);
  });

  it('el día toma su tramo más urgente: un vencido pesa más que un pagado', () => {
    const linea = lineaDelMes(
      resumen([
        item({ id: 'Arriendo', fechaLimite: new Date(2026, 9, 5), pagado: true }),
        item({ id: 'Administración', fechaLimite: new Date(2026, 9, 5) }),
      ]),
      HOY,
    );
    expect(linea.dias[0].tramo).toBe('vencido');
    expect(linea.conteo).toEqual({ vencido: 1, semana: 0, despues: 0, pagado: 1 });
  });

  it('marca hoy antes del primer día que no ha pasado (lo de hoy queda debajo)', () => {
    const linea = lineaDelMes(
      resumen([
        item({ id: 'a', fechaLimite: new Date(2026, 9, 5) }),
        item({ id: 'b', fechaLimite: new Date(2026, 9, 15) }),
        item({ id: 'c', fechaLimite: new Date(2026, 9, 28) }),
      ]),
      HOY,
    );
    expect(linea.hoy).toEqual(new Date(2026, 9, 15));
    expect(linea.indiceHoy).toBe(1);
  });

  it('si todo el mes ya pasó, la marca de hoy va al final', () => {
    const linea = lineaDelMes(resumen([item({ id: 'a', fechaLimite: new Date(2026, 9, 5) })]), HOY);
    expect(linea.indiceHoy).toBe(1);
  });

  it('en un mes que no es el actual no hay marca de hoy', () => {
    const noviembre = { anio: 2026, mes: 11 };
    const linea = lineaDelMes(
      resumen(
        [item({ id: 'a', fechaLimite: new Date(2026, 10, 5), periodo: '2026-11' })],
        noviembre,
      ),
      HOY,
    );
    expect(linea.hoy).toBeNull();
    expect(linea.indiceHoy).toBeNull();
    expect(linea.diasDelMes).toBe(30);
  });
});
