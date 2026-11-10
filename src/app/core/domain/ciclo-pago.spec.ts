import { libreHastaProximoPago, proximoPago } from './ciclo-pago';
import type { ItemPagoFijoMes } from './pagos-fijos-agrupados';

function item(nombre: string, fechaLimite: Date, monto: number): ItemPagoFijoMes {
  return {
    id: nombre,
    nombre,
    esCredito: true,
    pagado: false,
    marcadoSinMovimiento: false,
    fechaLimite,
    monto,
    esEstimado: false,
    estado: 'verde',
    periodo: '2026-11',
  };
}

describe('proximoPago', () => {
  it('es este mes si el día de pago todavía no llegó', () => {
    expect(proximoPago(new Date(2026, 10, 9), 20)).toEqual(new Date(2026, 10, 20));
  });

  it('el mismo día de pago ya cuenta como recibido: el próximo es el del mes siguiente', () => {
    expect(proximoPago(new Date(2026, 10, 20), 20)).toEqual(new Date(2026, 11, 20));
  });

  it('pasa al mes siguiente cuando el día de pago ya pasó', () => {
    expect(proximoPago(new Date(2026, 10, 25), 20)).toEqual(new Date(2026, 11, 20));
  });

  it('cruza el cambio de año', () => {
    expect(proximoPago(new Date(2026, 11, 28), 20)).toEqual(new Date(2027, 0, 20));
  });

  it('un 31 cae en el último día de los meses más cortos', () => {
    expect(proximoPago(new Date(2027, 1, 10), 31)).toEqual(new Date(2027, 1, 28));
    expect(proximoPago(new Date(2026, 3, 10), 31)).toEqual(new Date(2026, 3, 30));
  });
});

describe('libreHastaProximoPago', () => {
  const sistecredito = item('Sistecrédito', new Date(2026, 10, 12), 61_147);
  const zeroG = item('Zero G', new Date(2026, 10, 25), 236_447);
  const nequi = item('Crédito Nequi', new Date(2026, 10, 29), 293_033);

  it('solo resta lo que vence antes del pago y avisa lo de después', () => {
    const r = libreHastaProximoPago(
      505_961,
      [sistecredito, zeroG, nequi],
      [],
      new Date(2026, 10, 9),
      20,
    );
    expect(r.proximoPago).toEqual(new Date(2026, 10, 20));
    expect(r.diasHastaPago).toBe(11);
    expect(r.antes.map((i) => i.nombre)).toEqual(['Sistecrédito']);
    expect(r.totalAntes).toBe(61_147);
    expect(r.libre).toBe(444_814);
    expect(r.despues.map((i) => i.nombre)).toEqual(['Zero G', 'Crédito Nequi']);
    expect(r.totalDespues).toBe(529_480);
  });

  it('un vencido cuenta como pendiente antes del pago', () => {
    const rappi = item('Rappi Card', new Date(2026, 10, 1), 119_838);
    const r = libreHastaProximoPago(100_000, [rappi, zeroG], [], new Date(2026, 10, 9), 20);
    expect(r.antes.map((i) => i.nombre)).toEqual(['Rappi Card']);
    expect(r.libre).toBe(-19_838);
  });

  it('lo que vence el mismo día del pago se paga con ese dinero, no se resta', () => {
    const justoElDia = item('Plataforma', new Date(2026, 10, 20), 50_000);
    const r = libreHastaProximoPago(300_000, [justoElDia], [], new Date(2026, 10, 9), 20);
    expect(r.antes).toEqual([]);
    expect(r.despues.map((i) => i.nombre)).toEqual(['Plataforma']);
    expect(r.libre).toBe(300_000);
  });

  it('si el próximo pago cae el mes siguiente, también resta lo que vence antes en ese mes', () => {
    const vehiculo = item('Crédito de vehículo', new Date(2026, 11, 5), 937_697);
    const tarjetaDic = item('Zero G', new Date(2026, 11, 25), 300_000);
    const r = libreHastaProximoPago(
      1_500_000,
      [nequi],
      [vehiculo, tarjetaDic],
      new Date(2026, 10, 25),
      20,
    );
    expect(r.proximoPago).toEqual(new Date(2026, 11, 20));
    expect(r.antes.map((i) => i.nombre)).toEqual(['Crédito Nequi', 'Crédito de vehículo']);
    expect(r.libre).toBe(1_500_000 - 293_033 - 937_697);
    // Lo de diciembre que vence después del pago no se avisa: es de otro mes.
    expect(r.despues).toEqual([]);
  });
});
