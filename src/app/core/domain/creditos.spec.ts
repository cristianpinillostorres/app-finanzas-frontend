import type {
  CambioTasa,
  CompraCuotas,
  CreditoBanco,
  CreditoPersona,
  CreditoPlataforma,
  CreditoTarjeta,
  ExtractoTarjeta,
  Movimiento,
} from '../models';
import {
  cuotaMensual,
  cuotasFaltantes,
  cuotasFaltantesCompra,
  deudaCredito,
  estadoPagoCredito,
  estadoPagoCreditoEnMes,
  cuotasCubiertas,
  primerMesLlevado,
  tasaEaVigente,
  valorCuotaCompra,
} from './creditos';

const HOY = new Date(2026, 8, 11); // 11 de septiembre de 2026

function compra(
  datos: Partial<CompraCuotas> &
    Pick<CompraCuotas, 'id' | 'creditoId' | 'fecha' | 'monto' | 'numCuotas'>,
): CompraCuotas {
  return { movimientoId: `${datos.id}-mov`, descripcion: 'Compra', ...datos };
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

describe('valorCuotaCompra', () => {
  it('usa el valor de la plataforma cuando está dado', () => {
    const c = compra({
      id: 'p1',
      creditoId: 'addi',
      fecha: '2026-07-01',
      monto: 900_000,
      numCuotas: 6,
      valorCuota: 165_000,
    });
    expect(valorCuotaCompra(c)).toBe(165_000);
  });

  it('en tarjetas se calcula como monto / cuotas, redondeado', () => {
    const c = compra({
      id: 't1',
      creditoId: 'visa',
      fecha: '2026-08-01',
      monto: 600_000,
      numCuotas: 3,
    });
    expect(valorCuotaCompra(c)).toBe(200_000);
  });
});

describe('cuotasFaltantesCompra', () => {
  it('cuenta la cuota del mes de compra como la primera', () => {
    const c = compra({
      id: 't1',
      creditoId: 'visa',
      fecha: '2026-08-01',
      monto: 600_000,
      numCuotas: 3,
    });
    expect(cuotasFaltantesCompra(c, HOY)).toBe(2);
  });

  it('no baja de 0 cuando ya se cumplió el plazo', () => {
    const c = compra({
      id: 't2',
      creditoId: 'visa',
      fecha: '2026-01-01',
      monto: 400_000,
      numCuotas: 2,
    });
    expect(cuotasFaltantesCompra(c, HOY)).toBe(0);
  });
});

describe('deudaCredito', () => {
  const visa: CreditoTarjeta = {
    id: 'visa',
    grupo: 'TARJETA',
    nombre: 'Visa Bancolombia',
    diaPago: 15,
    diaCorte: 5,
    cupo: 5_000_000,
    archivado: false,
  };

  it('tarjeta: suma las cuotas pendientes de todas sus compras', () => {
    const compras = [
      compra({ id: 't1', creditoId: 'visa', fecha: '2026-08-01', monto: 600_000, numCuotas: 3 }), // faltan 2 * 200.000
      compra({ id: 't2', creditoId: 'visa', fecha: '2026-01-01', monto: 400_000, numCuotas: 2 }), // ya pagada
    ];
    expect(deudaCredito(visa, { compras, hoy: HOY })).toBe(400_000);
  });

  const addi: CreditoPlataforma = {
    id: 'addi',
    grupo: 'PLATAFORMA',
    nombre: 'Addi',
    diaPago: 20,
    cupo: 2_000_000,
    archivado: false,
  };

  it('plataforma: usa el valor de cuota fijo del plan', () => {
    const compras = [
      compra({
        id: 'p1',
        creditoId: 'addi',
        fecha: '2026-07-01',
        monto: 900_000,
        numCuotas: 6,
        valorCuota: 165_000,
      }),
    ];
    expect(deudaCredito(addi, { compras, hoy: HOY })).toBe(4 * 165_000);
  });

  const libreInversion: CreditoBanco = {
    id: 'libre-inversion',
    grupo: 'BANCO',
    nombre: 'Libre inversión',
    entidad: 'Bancolombia',
    diaPago: 5,
    monto: 10_000_000,
    tasaEa: 0.24,
    tipoTasa: 'FIJA',
    plazoMeses: 24,
    cuotasPagadasIniciales: 0,
    seguroMensual: 25_000,
    archivado: false,
  };

  it('banco: sin pagos registrados, la deuda es el monto prestado', () => {
    expect(deudaCredito(libreInversion, {})).toBe(10_000_000);
  });

  it('banco: baja según el saldo de la tabla de amortización tras los pagos hechos', () => {
    const movimientos = [
      movimiento({ id: 'm1', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm2', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm3', creditoDestinoId: 'libre-inversion' }),
    ];
    expect(deudaCredito(libreInversion, { movimientos })).toBe(8_972_283);
  });

  it('banco de tasa variable: usa la tasa del último cambio vigente, no la tasa base', () => {
    const variable: CreditoBanco = { ...libreInversion, tipoTasa: 'VARIABLE' };
    const movimientos = [
      movimiento({ id: 'm1', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm2', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm3', creditoDestinoId: 'libre-inversion' }),
    ];
    const cambiosTasa: CambioTasa[] = [
      { id: 'c1', creditoId: 'libre-inversion', fechaDesde: '2026-01-01', tasaEa: 0.2 },
    ];
    expect(deudaCredito(variable, { movimientos, cambiosTasa, hoy: HOY })).toBe(8_940_112);
  });

  it('banco de tasa variable: ignora un cambio que todavía no entra en vigencia', () => {
    const variable: CreditoBanco = { ...libreInversion, tipoTasa: 'VARIABLE' };
    const movimientos = [
      movimiento({ id: 'm1', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm2', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm3', creditoDestinoId: 'libre-inversion' }),
    ];
    const cambiosTasa: CambioTasa[] = [
      { id: 'c1', creditoId: 'libre-inversion', fechaDesde: '2026-12-01', tasaEa: 0.2 },
    ];
    expect(deudaCredito(variable, { movimientos, cambiosTasa, hoy: HOY })).toBe(8_972_283);
  });

  const prestamoPersona: CreditoPersona = {
    id: 'prestamo-juan',
    grupo: 'PERSONA',
    nombre: 'Préstamo de Juan',
    diaPago: 30,
    monto: 500_000,
    archivado: false,
  };

  it('persona: monto acordado menos los abonos', () => {
    const movimientos = [
      movimiento({ id: 'a1', creditoDestinoId: 'prestamo-juan', monto: 150_000 }),
    ];
    expect(deudaCredito(prestamoPersona, { movimientos })).toBe(350_000);
  });

  it('persona: nunca queda negativa aunque se abone de más', () => {
    const movimientos = [
      movimiento({ id: 'a1', creditoDestinoId: 'prestamo-juan', monto: 600_000 }),
    ];
    expect(deudaCredito(prestamoPersona, { movimientos })).toBe(0);
  });
});

describe('tasaEaVigente', () => {
  const vehiculo: CreditoBanco = {
    id: 'vehiculo',
    grupo: 'BANCO',
    nombre: 'Crédito de vehículo',
    diaPago: 12,
    monto: 45_000_000,
    tasaEa: 0.195,
    tipoTasa: 'VARIABLE',
    plazoMeses: 60,
    cuotasPagadasIniciales: 14,
    seguroMensual: 65_000,
    archivado: false,
  };

  it('sin cambios registrados, usa la tasa base del crédito', () => {
    expect(tasaEaVigente(vehiculo, [], HOY)).toBe(0.195);
  });

  it('usa el cambio más reciente cuya fecha ya se cumplió', () => {
    const cambios: CambioTasa[] = [
      { id: 'c1', creditoId: 'vehiculo', fechaDesde: '2025-08-01', tasaEa: 0.195 },
      { id: 'c2', creditoId: 'vehiculo', fechaDesde: '2026-06-01', tasaEa: 0.212 },
    ];
    expect(tasaEaVigente(vehiculo, cambios, HOY)).toBe(0.212);
  });

  it('ignora cambios de otros créditos y los que aún no entran en vigencia', () => {
    const cambios: CambioTasa[] = [
      { id: 'c1', creditoId: 'otro-credito', fechaDesde: '2025-08-01', tasaEa: 0.3 },
      { id: 'c2', creditoId: 'vehiculo', fechaDesde: '2026-12-01', tasaEa: 0.212 },
    ];
    expect(tasaEaVigente(vehiculo, cambios, HOY)).toBe(0.195);
  });
});

describe('cuotasFaltantes', () => {
  it('tarjeta y plataforma: la de la compra más larga', () => {
    const visa: CreditoTarjeta = {
      id: 'visa',
      grupo: 'TARJETA',
      nombre: 'Visa',
      diaPago: 15,
      diaCorte: 5,
      cupo: 5_000_000,
      archivado: false,
    };
    const compras = [
      compra({ id: 't1', creditoId: 'visa', fecha: '2026-08-01', monto: 600_000, numCuotas: 3 }), // faltan 2
      compra({ id: 't2', creditoId: 'visa', fecha: '2026-09-01', monto: 1_200_000, numCuotas: 12 }), // faltan 12
    ];
    expect(cuotasFaltantes(visa, { compras, hoy: HOY })).toBe(12);
  });

  it('banco: plazo total menos cuotas pagadas', () => {
    const credito: CreditoBanco = {
      id: 'vehiculo',
      grupo: 'BANCO',
      nombre: 'Crédito de vehículo',
      diaPago: 10,
      monto: 40_000_000,
      tasaEa: 0.18,
      tipoTasa: 'FIJA',
      plazoMeses: 60,
      cuotasPagadasIniciales: 10,
      seguroMensual: 45_000,
      archivado: false,
    };
    expect(cuotasFaltantes(credito, {})).toBe(50);
  });

  it('persona: null porque no maneja cuotas', () => {
    const credito: CreditoPersona = {
      id: 'prestamo-juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    expect(cuotasFaltantes(credito, {})).toBeNull();
  });
});

describe('estadoPagoCredito', () => {
  const visa: CreditoTarjeta = {
    id: 'visa',
    grupo: 'TARJETA',
    nombre: 'Visa',
    diaPago: 5,
    diaCorte: 20,
    cupo: 5_000_000,
    archivado: false,
  };

  it('si no se ha pagado este mes, la fecha límite es este mes (puede ya haber vencido)', () => {
    const estado = estadoPagoCredito(visa, [], HOY); // día 5 ya pasó (hoy 11)
    expect(estado?.pagadoEsteMes).toBe(false);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 8, 5));
  });

  it('si ya se pagó este mes, la fecha límite pasa al mes siguiente', () => {
    const movimientos = [movimiento({ id: 'pago', creditoDestinoId: 'visa', fecha: '2026-09-08' })];
    const estado = estadoPagoCredito(visa, movimientos, HOY);
    expect(estado?.pagadoEsteMes).toBe(true);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 9, 5));
  });

  it('personas: null, no tienen cuota fija', () => {
    const persona: CreditoPersona = {
      id: 'prestamo-juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    expect(estadoPagoCredito(persona, [], HOY)).toBeNull();
  });
});

describe('estadoPagoCreditoEnMes', () => {
  const visa: CreditoTarjeta = {
    id: 'visa',
    grupo: 'TARJETA',
    nombre: 'Visa',
    diaPago: 5,
    diaCorte: 20,
    cupo: 5_000_000,
    archivado: false,
  };

  it('a diferencia de estadoPagoCredito, no rueda al mes siguiente si ya se pagó ese mes', () => {
    const movimientos = [movimiento({ id: 'pago', creditoDestinoId: 'visa', fecha: '2026-09-08' })];
    const estado = estadoPagoCreditoEnMes(visa, movimientos, { anio: 2026, mes: 9 });
    expect(estado?.pagadoEsteMes).toBe(true);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 8, 5));
  });

  it('un mes sin pago registrado queda como no pagado', () => {
    const movimientos = [movimiento({ id: 'pago', creditoDestinoId: 'visa', fecha: '2026-09-08' })];
    const estado = estadoPagoCreditoEnMes(visa, movimientos, { anio: 2026, mes: 10 });
    expect(estado?.pagadoEsteMes).toBe(false);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 9, 5));
  });

  it('personas: null, no tienen cuota fija', () => {
    const persona: CreditoPersona = {
      id: 'prestamo-juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    expect(estadoPagoCreditoEnMes(persona, [], { anio: 2026, mes: 9 })).toBeNull();
  });
});

describe('cuotaMensual', () => {
  const visa: CreditoTarjeta = {
    id: 'visa',
    grupo: 'TARJETA',
    nombre: 'Visa',
    diaPago: 5,
    diaCorte: 20,
    cupo: 5_000_000,
    archivado: false,
  };

  it('tarjeta: sin extracto del periodo, suma las cuotas de las compras vigentes', () => {
    const compras = [
      compra({ id: 't1', creditoId: 'visa', fecha: '2026-08-01', monto: 600_000, numCuotas: 3 }), // cuota 200.000, faltan 2
      compra({ id: 't2', creditoId: 'visa', fecha: '2026-01-01', monto: 400_000, numCuotas: 2 }), // ya pagada, no suma
    ];
    expect(cuotaMensual(visa, { compras, hoy: HOY })).toBe(200_000);
  });

  it('tarjeta: si hay extracto del periodo actual, usa ese valor en vez de las cuotas', () => {
    const compras = [
      compra({ id: 't1', creditoId: 'visa', fecha: '2026-08-01', monto: 600_000, numCuotas: 3 }),
    ];
    const extractos: ExtractoTarjeta[] = [
      { id: 'e1', creditoId: 'visa', periodo: '2026-09', valorAPagar: 350_000 },
    ];
    expect(cuotaMensual(visa, { compras, extractos, hoy: HOY })).toBe(350_000);
  });

  it('banco: la cuota de la tabla de amortización que sigue', () => {
    const libreInversion: CreditoBanco = {
      id: 'libre-inversion',
      grupo: 'BANCO',
      nombre: 'Libre inversión',
      diaPago: 5,
      monto: 10_000_000,
      tasaEa: 0.24,
      tipoTasa: 'FIJA',
      plazoMeses: 24,
      cuotasPagadasIniciales: 0,
      seguroMensual: 25_000,
      archivado: false,
    };
    expect(cuotaMensual(libreInversion, {})).toBe(542_326);
  });

  it('banco de tasa variable: la cuota refleja la tasa del último cambio vigente', () => {
    const libreInversion: CreditoBanco = {
      id: 'libre-inversion',
      grupo: 'BANCO',
      nombre: 'Libre inversión',
      diaPago: 5,
      monto: 10_000_000,
      tasaEa: 0.24,
      tipoTasa: 'VARIABLE',
      plazoMeses: 24,
      cuotasPagadasIniciales: 0,
      seguroMensual: 25_000,
      archivado: false,
    };
    const movimientos = [
      movimiento({ id: 'm1', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm2', creditoDestinoId: 'libre-inversion' }),
      movimiento({ id: 'm3', creditoDestinoId: 'libre-inversion' }),
    ];
    const cambiosTasa: CambioTasa[] = [
      { id: 'c1', creditoId: 'libre-inversion', fechaDesde: '2026-01-01', tasaEa: 0.2 },
    ];
    expect(cuotaMensual(libreInversion, { movimientos, cambiosTasa, hoy: HOY })).toBe(526_037);
  });

  it('persona: no tiene cuota mensual', () => {
    const persona: CreditoPersona = {
      id: 'prestamo-juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    expect(cuotaMensual(persona, {})).toBe(0);
  });
});

describe('cuotas cubiertas: desde cuándo se lleva el crédito en la app', () => {
  // Vence los 5. La app empezó a usarse a mitad de septiembre: la cuota del
  // 5 de septiembre se pagó por fuera y no existe para la app.
  const vehiculo: CreditoBanco = {
    id: 'vehiculo',
    grupo: 'BANCO',
    nombre: 'Crédito de vehículo',
    diaPago: 5,
    monto: 40_000_000,
    tasaEa: 0.18,
    tipoTasa: 'FIJA',
    plazoMeses: 60,
    cuotasPagadasIniciales: 10,
    seguroMensual: 0,
    archivado: false,
  };
  const pago30Sep = movimiento({ id: 'p1', creditoDestinoId: 'vehiculo', fecha: '2026-09-30' });
  const OCT = { anio: 2026, mes: 10 };
  const SEP = { anio: 2026, mes: 9 };

  it('caso real: crédito viejo, pagado el 30-sep → cubre el 5 de octubre', () => {
    expect(primerMesLlevado(vehiculo, [pago30Sep])).toEqual(OCT);
    expect(estadoPagoCreditoEnMes(vehiculo, [pago30Sep], OCT)?.pagadoEsteMes).toBe(true);
    // Septiembre no se cobra: era antes de usar la app.
    expect(estadoPagoCreditoEnMes(vehiculo, [pago30Sep], SEP)).toBeNull();
  });

  it('caso real: en Créditos, el 12-oct la próxima fecha es el 5 de noviembre', () => {
    const estado = estadoPagoCredito(vehiculo, [pago30Sep], new Date(2026, 9, 12));
    expect(estado?.pagadoEsteMes).toBe(true);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 10, 5));
  });

  it('crédito viejo con primer pago pocos días después del vencimiento: cubre ese mes', () => {
    const pago8Sep = movimiento({ id: 'p', creditoDestinoId: 'vehiculo', fecha: '2026-09-08' });
    expect(primerMesLlevado(vehiculo, [pago8Sep])).toEqual(SEP);
  });

  it('los pagos siguientes cubren cuotas en orden, también si uno llega tarde', () => {
    const pagos = [
      pago30Sep,
      movimiento({ id: 'p2', creditoDestinoId: 'vehiculo', fecha: '2026-11-08' }),
    ];
    const cubiertas = cuotasCubiertas(vehiculo, pagos);
    expect([...cubiertas.keys()]).toEqual(['2026-10', '2026-11']);
    expect(cubiertas.get('2026-11')?.id).toBe('p2');
  });

  it('un mes sin pagar queda pendiente y vencido en Créditos', () => {
    const estado = estadoPagoCredito(vehiculo, [pago30Sep], new Date(2026, 10, 20));
    expect(estado?.pagadoEsteMes).toBe(false);
    expect(estado?.fechaLimite).toEqual(new Date(2026, 10, 5));
  });

  it('crédito nuevo con creadoEn: la primera cuota es la que vence después de crearlo', () => {
    const nuevo: CreditoBanco = { ...vehiculo, creadoEn: '2026-09-20T15:00:00.000Z' };
    expect(primerMesLlevado(nuevo, [])).toEqual(OCT);
    expect(estadoPagoCreditoEnMes(nuevo, [], SEP)).toBeNull();
    expect(estadoPagoCreditoEnMes(nuevo, [], OCT)?.pagadoEsteMes).toBe(false);
  });

  it('crédito viejo sin pagos ni creadoEn: se cobra el mes actual, como antes', () => {
    expect(primerMesLlevado(vehiculo, [])).toBeNull();
    const hoy = new Date(2026, 9, 12);
    expect(estadoPagoCreditoEnMes(vehiculo, [], OCT, hoy)?.pagadoEsteMes).toBe(false);
    // ...y no aparece en meses anteriores.
    expect(estadoPagoCreditoEnMes(vehiculo, [], { anio: 2026, mes: 3 }, hoy)).toBeNull();
  });
});
