import type { Movimiento } from '../models';
import type { ItemPagoFijoMes } from './pagos-fijos-agrupados';
import {
  estadoDeComprometido,
  estadoDelRitmo,
  excesoSobreTopeCuotas,
  gastoDiarioPermitido,
  proporcionComprometida,
  proyeccionDeCaja,
  ingresoMensualDeReferencia,
  ritmoDeGasto,
  salidasYEntradasDelMes,
  totalCuotasDelMes,
  ultimoSueldo,
} from './panorama-del-mes';

const NOVIEMBRE = { anio: 2026, mes: 11 };

function mov(parcial: Partial<Movimiento> & Pick<Movimiento, 'tipo' | 'monto'>): Movimiento {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: '2026-11-05',
    descripcion: '',
    creadoEn: '2026-11-05T12:00:00Z',
    ...parcial,
  };
}

function pago(
  parcial: Partial<ItemPagoFijoMes> & Pick<ItemPagoFijoMes, 'id' | 'monto' | 'fechaLimite'>,
): ItemPagoFijoMes {
  return {
    nombre: parcial.id,
    esCredito: false,
    pagado: false,
    marcadoSinMovimiento: false,
    esEstimado: false,
    estado: 'verde',
    periodo: '2026-11',
    ...parcial,
  } as ItemPagoFijoMes;
}

describe('salidasYEntradasDelMes', () => {
  it('separa gastos, pagos de deuda, ingresos y reembolsos', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_876_134, categoriaId: 'cat-salario' }),
      mov({ tipo: 'INGRESO', monto: 510_000, categoriaId: 'cat-reembolso' }),
      mov({ tipo: 'GASTO', monto: 125_000, categoriaId: 'cat-restaurantes' }),
      mov({ tipo: 'TRANSFERENCIA', monto: 937_697, creditoDestinoId: 'vehiculo' }),
      mov({ tipo: 'TRANSFERENCIA', monto: 273_000, cuentaDestinoId: 'nequi' }),
    ];
    expect(salidasYEntradasDelMes(movimientos, NOVIEMBRE)).toEqual({
      ingresos: 2_876_134,
      reembolsos: 510_000,
      gastos: 125_000,
      pagosDeuda: 937_697,
      salidas: 125_000 + 937_697,
    });
  });

  it('no cuenta transferencias entre cuentas, internos ni ajustes como salida', () => {
    const movimientos = [
      mov({ tipo: 'TRANSFERENCIA', monto: 100_000, cuentaOrigenId: 'a', cuentaDestinoId: 'b' }),
      mov({ tipo: 'INTERNO', monto: 50_000 }),
      mov({ tipo: 'AJUSTE', monto: 10_000 }),
    ];
    expect(salidasYEntradasDelMes(movimientos, NOVIEMBRE).salidas).toBe(0);
  });

  it('solo cuenta los movimientos del mes', () => {
    const movimientos = [
      mov({ tipo: 'GASTO', monto: 40_000, fecha: '2026-10-31' }),
      mov({ tipo: 'GASTO', monto: 10_000, fecha: '2026-11-01' }),
    ];
    expect(salidasYEntradasDelMes(movimientos, NOVIEMBRE).gastos).toBe(10_000);
  });

  it('un ingreso sin categoría cuenta como ingreso, no como reembolso', () => {
    const resumen = salidasYEntradasDelMes([mov({ tipo: 'INGRESO', monto: 30_000 })], NOVIEMBRE);
    expect(resumen.ingresos).toBe(30_000);
    expect(resumen.reembolsos).toBe(0);
  });
});

describe('gastoDiarioPermitido', () => {
  it('reparte lo libre entre los días que faltan', () => {
    expect(gastoDiarioPermitido(506_232, 11)).toBe(46_021);
  });

  it('el día antes del pago todavía se reparte entre un día', () => {
    expect(gastoDiarioPermitido(90_000, 1)).toBe(90_000);
  });

  it('con 0 días no divide entre cero', () => {
    expect(gastoDiarioPermitido(90_000, 0)).toBe(90_000);
  });

  it('sin plata libre da 0', () => {
    expect(gastoDiarioPermitido(-50_000, 5)).toBe(0);
    expect(gastoDiarioPermitido(0, 5)).toBe(0);
  });
});

describe('ritmoDeGasto', () => {
  const hoy = new Date(2026, 10, 9); // 9 de noviembre

  it('promedia los gastos de los últimos 7 días, hoy incluido', () => {
    const movimientos = [
      mov({ tipo: 'GASTO', monto: 70_000, fecha: '2026-11-09' }),
      mov({ tipo: 'GASTO', monto: 70_000, fecha: '2026-11-03' }), // 6 días atrás: entra
    ];
    expect(ritmoDeGasto(movimientos, hoy)).toBe(20_000);
  });

  it('deja fuera lo de hace 7 días o más y lo que no es gasto', () => {
    const movimientos = [
      mov({ tipo: 'GASTO', monto: 100_000, fecha: '2026-11-02' }), // 7 días atrás: fuera
      mov({ tipo: 'TRANSFERENCIA', monto: 900_000, fecha: '2026-11-08', creditoDestinoId: 'x' }),
      mov({ tipo: 'GASTO', monto: 14_000, fecha: '2026-11-08' }),
    ];
    expect(ritmoDeGasto(movimientos, hoy)).toBe(2_000);
  });

  it('no cuenta gastos con fecha futura', () => {
    const movimientos = [mov({ tipo: 'GASTO', monto: 50_000, fecha: '2026-11-12' })];
    expect(ritmoDeGasto(movimientos, hoy)).toBe(0);
  });
});

describe('estadoDelRitmo', () => {
  it('bien por debajo del 80 %', () => {
    expect(estadoDelRitmo(30_000, 46_000)).toBe('bien');
  });
  it('cerca entre el 80 % y el 100 %', () => {
    expect(estadoDelRitmo(40_000, 46_000)).toBe('cerca');
    expect(estadoDelRitmo(46_000, 46_000)).toBe('cerca');
  });
  it('pasado por encima de lo permitido', () => {
    expect(estadoDelRitmo(50_000, 46_000)).toBe('pasado');
  });
  it('sin nada permitido, cualquier gasto es pasarse', () => {
    expect(estadoDelRitmo(1_000, 0)).toBe('pasado');
    expect(estadoDelRitmo(0, 0)).toBe('bien');
  });
});

describe('proyeccionDeCaja', () => {
  const hoy = new Date(2026, 10, 9);

  it('va descontando cada pago y suma el sueldo el día que llega', () => {
    const pendientes = [
      pago({ id: 'siste', monto: 61_147, fechaLimite: new Date(2026, 10, 12) }),
      pago({ id: 'zerog', monto: 236_447, fechaLimite: new Date(2026, 10, 25) }),
    ];
    const sueldo = { nombre: 'Entra tu pago', fecha: new Date(2026, 10, 20), monto: 2_876_134 };

    const eventos = proyeccionDeCaja(567_379, pendientes, hoy, sueldo);

    expect(eventos.map((e) => e.id)).toEqual(['siste', 'ingreso-esperado', 'zerog']);
    expect(eventos.map((e) => e.saldoDespues)).toEqual([
      567_379 - 61_147,
      567_379 - 61_147 + 2_876_134,
      567_379 - 61_147 + 2_876_134 - 236_447,
    ]);
  });

  it('el día del pago, el sueldo va antes que los pagos de ese día', () => {
    const pendientes = [pago({ id: 'internet', monto: 150_000, fechaLimite: new Date(2026, 10, 20) })];
    const sueldo = { nombre: 'Entra tu pago', fecha: new Date(2026, 10, 20), monto: 1_000_000 };
    const eventos = proyeccionDeCaja(100_000, pendientes, hoy, sueldo);
    expect(eventos.map((e) => e.id)).toEqual(['ingreso-esperado', 'internet']);
  });

  it('los vencidos van primero y se marcan', () => {
    const pendientes = [
      pago({ id: 'luz', monto: 80_000, fechaLimite: new Date(2026, 10, 15) }),
      pago({ id: 'agua', monto: 40_000, fechaLimite: new Date(2026, 10, 6) }),
    ];
    const eventos = proyeccionDeCaja(500_000, pendientes, hoy, null);
    expect(eventos[0]).toMatchObject({ id: 'agua', vencido: true });
    expect(eventos[1]).toMatchObject({ id: 'luz', vencido: false });
  });

  it('deja fuera lo pagado y lo que queda más allá del horizonte', () => {
    const pendientes = [
      pago({ id: 'pagado', monto: 10_000, fechaLimite: new Date(2026, 10, 10), pagado: true }),
      pago({ id: 'lejos', monto: 20_000, fechaLimite: new Date(2026, 11, 20) }),
      pago({ id: 'cerca', monto: 30_000, fechaLimite: new Date(2026, 10, 30) }),
    ];
    expect(proyeccionDeCaja(100_000, pendientes, hoy, null).map((e) => e.id)).toEqual(['cerca']);
  });

  it('sin sueldo esperado no inventa un ingreso', () => {
    const pendientes = [pago({ id: 'a', monto: 10_000, fechaLimite: new Date(2026, 10, 10) })];
    expect(proyeccionDeCaja(100_000, pendientes, hoy, null).some((e) => e.esIngreso)).toBe(false);
  });
});

describe('ultimoSueldo', () => {
  it('devuelve el sueldo más reciente', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_875_687, categoriaId: 'cat-salario', fecha: '2026-09-18' }),
      mov({ tipo: 'INGRESO', monto: 2_876_134, categoriaId: 'cat-salario', fecha: '2026-10-20' }),
      mov({ tipo: 'INGRESO', monto: 510_000, categoriaId: 'cat-reembolso', fecha: '2026-11-03' }),
    ];
    expect(ultimoSueldo(movimientos)).toBe(2_876_134);
  });

  it('es null si nunca se registró un sueldo', () => {
    expect(ultimoSueldo([mov({ tipo: 'GASTO', monto: 1 })])).toBeNull();
  });
});

describe('ingresoMensualDeReferencia', () => {
  const HOY = new Date(2026, 10, 10); // 10 de noviembre de 2026

  it('promedia los meses completos con ingreso, sin contar el mes en curso', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_000_000, categoriaId: 'cat-salario', fecha: '2026-09-18' }),
      mov({ tipo: 'INGRESO', monto: 3_000_000, categoriaId: 'cat-salario', fecha: '2026-10-20' }),
      mov({ tipo: 'INGRESO', monto: 9_000_000, categoriaId: 'cat-salario', fecha: '2026-11-03' }),
    ];
    expect(ingresoMensualDeReferencia(movimientos, null, HOY)).toBe(2_500_000);
  });

  it('suma varias categorías en el mismo mes', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_000_000, categoriaId: 'cat-salario', fecha: '2026-10-20' }),
      mov({ tipo: 'INGRESO', monto: 500_000, categoriaId: 'cat-freelance', fecha: '2026-10-25' }),
    ];
    expect(ingresoMensualDeReferencia(movimientos, null, HOY)).toBe(2_500_000);
  });

  it('por defecto no cuenta los reembolsos, pero sí si se eligen', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_000_000, categoriaId: 'cat-salario', fecha: '2026-10-20' }),
      mov({ tipo: 'INGRESO', monto: 510_000, categoriaId: 'cat-reembolso', fecha: '2026-10-22' }),
    ];
    expect(ingresoMensualDeReferencia(movimientos, null, HOY)).toBe(2_000_000);
    expect(ingresoMensualDeReferencia(movimientos, ['cat-salario', 'cat-reembolso'], HOY)).toBe(
      2_510_000,
    );
  });

  it('solo cuenta las categorías elegidas', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 2_000_000, categoriaId: 'cat-salario', fecha: '2026-10-20' }),
      mov({ tipo: 'INGRESO', monto: 500_000, categoriaId: 'cat-freelance', fecha: '2026-10-25' }),
    ];
    expect(ingresoMensualDeReferencia(movimientos, ['cat-salario'], HOY)).toBe(2_000_000);
    expect(ingresoMensualDeReferencia(movimientos, [], HOY)).toBeNull();
  });

  it('un mes sin ingreso entre dos con ingreso cuenta como cero', () => {
    const movimientos = [
      mov({ tipo: 'INGRESO', monto: 900_000, categoriaId: 'cat-freelance', fecha: '2026-08-10' }),
      mov({ tipo: 'INGRESO', monto: 900_000, categoriaId: 'cat-freelance', fecha: '2026-10-10' }),
    ];
    expect(ingresoMensualDeReferencia(movimientos, null, HOY)).toBe(600_000);
  });

  it('sin meses completos usa el último mes con ingreso', () => {
    const solo = [
      mov({ tipo: 'INGRESO', monto: 2_000_000, categoriaId: 'cat-salario', fecha: '2026-11-03' }),
    ];
    expect(ingresoMensualDeReferencia(solo, null, HOY)).toBe(2_000_000);
    const viejo = [
      mov({ tipo: 'INGRESO', monto: 1_800_000, categoriaId: 'cat-salario', fecha: '2026-03-20' }),
    ];
    expect(ingresoMensualDeReferencia(viejo, null, HOY)).toBe(1_800_000);
  });

  it('es null si nunca entró nada', () => {
    expect(ingresoMensualDeReferencia([mov({ tipo: 'GASTO', monto: 1 })], null, HOY)).toBeNull();
  });
});

describe('cuotas comprometidas', () => {
  it('suma solo las cuotas de créditos, pagadas o no', () => {
    const items = [
      pago({ id: 'vehiculo', monto: 937_697, fechaLimite: new Date(2026, 10, 5), esCredito: true, pagado: true }),
      pago({ id: 'zerog', monto: 236_447, fechaLimite: new Date(2026, 10, 25), esCredito: true }),
      pago({ id: 'internet', monto: 151_000, fechaLimite: new Date(2026, 10, 19) }),
    ];
    expect(totalCuotasDelMes(items)).toBe(937_697 + 236_447);
  });

  it('la proporción es cuotas sobre sueldo', () => {
    expect(proporcionComprometida(1_800_000, 2_880_000)).toBeCloseTo(0.625);
  });

  it('sin sueldo de referencia no hay proporción', () => {
    expect(proporcionComprometida(1_800_000, null)).toBeNull();
    expect(proporcionComprometida(1_800_000, 0)).toBeNull();
  });

  it('el color pasa de bien a cerca a pasado según cuánto sueldo se va', () => {
    expect(estadoDeComprometido(0.2)).toBe('bien');
    expect(estadoDeComprometido(0.35)).toBe('cerca');
    expect(estadoDeComprometido(0.5)).toBe('cerca');
    expect(estadoDeComprometido(0.64)).toBe('pasado');
  });
});

describe('excesoSobreTopeCuotas', () => {
  it('es lo que las cuotas pasan del 35 % del sueldo', () => {
    // 35 % de 2.876.134 = 1.006.647: con 1.875.023 en cuotas se pasan por 868.376.
    expect(excesoSobreTopeCuotas(1_875_023, 2_876_134)).toBe(868_376);
  });

  it('es negativo cuando todavía hay margen', () => {
    expect(excesoSobreTopeCuotas(500_000, 2_000_000)).toBe(-200_000);
  });

  it('no hay con qué comparar sin un sueldo de referencia', () => {
    expect(excesoSobreTopeCuotas(500_000, null)).toBeNull();
    expect(excesoSobreTopeCuotas(500_000, 0)).toBeNull();
  });
});
