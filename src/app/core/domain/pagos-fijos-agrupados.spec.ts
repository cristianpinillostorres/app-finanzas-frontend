import type {
  CambioTasa,
  CreditoBanco,
  CreditoPersona,
  CreditoTarjeta,
  Movimiento,
  PagoFijo,
} from '../models';
import { agruparPagosFijosDelMes, type ContextoPagosFijosMes } from './pagos-fijos-agrupados';

const MES = { anio: 2026, mes: 9 };

function pagoFijo(datos: Partial<PagoFijo> & Pick<PagoFijo, 'id' | 'nombre'>): PagoFijo {
  return {
    categoriaId: 'cat-servicios',
    diaLimite: 15,
    monto: 100_000,
    esVariable: false,
    frecuencia: 'MENSUAL',
    mesInicio: 1,
    cuentaDefaultId: 'bancolombia',
    activo: true,
    ...datos,
  };
}

function movimiento(datos: Partial<Movimiento> & Pick<Movimiento, 'id'>): Movimiento {
  return {
    fecha: '2026-09-10',
    tipo: 'GASTO',
    monto: 0,
    descripcion: '',
    creadoEn: '2026-09-10T00:00:00.000Z',
    ...datos,
  };
}

const SIN_CREDITOS: ContextoPagosFijosMes = {
  creditos: [],
  compras: [],
  extractos: [],
  movimientos: [],
  hoy: new Date(2026, 8, 11),
};

describe('agruparPagosFijosDelMes', () => {
  it('un pago fijo sin pagar queda en "por pagar" con su monto fijo', () => {
    const arriendo = pagoFijo({
      id: 'arriendo',
      nombre: 'Arriendo',
      diaLimite: 5,
      monto: 1_800_000,
    });
    const resumen = agruparPagosFijosDelMes([arriendo], SIN_CREDITOS, MES);

    expect(resumen.porPagar).toHaveLength(1);
    expect(resumen.pagados).toHaveLength(0);
    expect(resumen.porPagar[0].monto).toBe(1_800_000);
    expect(resumen.porPagar[0].esEstimado).toBe(false);
    expect(resumen.porPagar[0].fechaLimite).toEqual(new Date(2026, 8, 5));
  });

  it('un pago fijo pagado queda en "pagados" con el monto real del movimiento', () => {
    const luz = pagoFijo({ id: 'luz', nombre: 'Luz', monto: 140_000, esVariable: true });
    const movimientos = [
      movimiento({ id: 'mov-luz', pagoFijoId: 'luz', periodo: '2026-09', monto: 152_300 }),
    ];
    const resumen = agruparPagosFijosDelMes([luz], { ...SIN_CREDITOS, movimientos }, MES);

    expect(resumen.porPagar).toHaveLength(0);
    expect(resumen.pagados).toHaveLength(1);
    expect(resumen.pagados[0].monto).toBe(152_300);
    expect(resumen.pagados[0].esEstimado).toBe(false);
  });

  it('"Ya lo pagué" lo pasa a pagados solo en ese periodo, sin movimiento', () => {
    const arriendo = pagoFijo({
      id: 'arriendo',
      nombre: 'Arriendo',
      monto: 1_800_000,
      periodosPagadosSinMovimiento: ['2026-09'],
    });
    const septiembre = agruparPagosFijosDelMes([arriendo], SIN_CREDITOS, MES);
    const octubre = agruparPagosFijosDelMes([arriendo], SIN_CREDITOS, { anio: 2026, mes: 10 });

    expect(septiembre.pagados).toHaveLength(1);
    expect(septiembre.pagados[0].marcadoSinMovimiento).toBe(true);
    expect(septiembre.pagados[0].monto).toBe(1_800_000);
    expect(septiembre.totalPorPagar).toBe(0);
    expect(octubre.porPagar).toHaveLength(1);
  });

  it('si además hay un movimiento, manda el movimiento y no se puede desmarcar', () => {
    const luz = pagoFijo({
      id: 'luz',
      nombre: 'Luz',
      monto: 140_000,
      esVariable: true,
      periodosPagadosSinMovimiento: ['2026-09'],
    });
    const movimientos = [
      movimiento({ id: 'mov-luz', pagoFijoId: 'luz', periodo: '2026-09', monto: 152_300 }),
    ];
    const resumen = agruparPagosFijosDelMes([luz], { ...SIN_CREDITOS, movimientos }, MES);

    expect(resumen.pagados[0].monto).toBe(152_300);
    expect(resumen.pagados[0].marcadoSinMovimiento).toBe(false);
  });

  it('un pago variable sin pagar se marca como estimado', () => {
    const gas = pagoFijo({ id: 'gas', nombre: 'Gas', monto: 45_000, esVariable: true });
    const resumen = agruparPagosFijosDelMes([gas], SIN_CREDITOS, MES);
    expect(resumen.porPagar[0].esEstimado).toBe(true);
  });

  it('un pago que no aplica este mes no aparece', () => {
    const soat = pagoFijo({ id: 'soat', nombre: 'SOAT', frecuencia: 'ANUAL', mesInicio: 10 });
    const resumen = agruparPagosFijosDelMes([soat], SIN_CREDITOS, MES);
    expect(resumen.porPagar).toHaveLength(0);
    expect(resumen.pagados).toHaveLength(0);
  });

  it('una cuota de crédito (tarjeta/banco/plataforma) aparece como item con esCredito', () => {
    const visa: CreditoTarjeta = {
      id: 'visa',
      grupo: 'TARJETA',
      nombre: 'Visa',
      diaPago: 5,
      diaCorte: 20,
      cupo: 5_000_000,
      archivado: false,
    };
    const compras = [
      {
        id: 'compra-1',
        creditoId: 'visa',
        movimientoId: 'mov-compra',
        descripcion: 'Tenis',
        monto: 400_000,
        numCuotas: 4,
        fecha: '2026-08-01',
      },
    ];
    const resumen = agruparPagosFijosDelMes(
      [],
      { ...SIN_CREDITOS, creditos: [visa], compras },
      MES,
    );

    expect(resumen.porPagar).toHaveLength(1);
    expect(resumen.porPagar[0].esCredito).toBe(true);
    expect(resumen.porPagar[0].creditoId).toBe('visa');
    expect(resumen.porPagar[0].monto).toBe(100_000); // 400.000 / 4
  });

  it('un crédito con personas (grupo PERSONA) no aparece: no tiene cuota mensual', () => {
    const juan: CreditoPersona = {
      id: 'juan',
      grupo: 'PERSONA',
      nombre: 'Préstamo de Juan',
      diaPago: 30,
      monto: 500_000,
      archivado: false,
    };
    const resumen = agruparPagosFijosDelMes([], { ...SIN_CREDITOS, creditos: [juan] }, MES);
    expect(resumen.porPagar).toHaveLength(0);
  });

  it('un crédito pagado este mes muestra el monto real pagado, no la cuota siguiente', () => {
    const vehiculo: CreditoBanco = {
      id: 'vehiculo',
      grupo: 'BANCO',
      nombre: 'Crédito de vehículo',
      diaPago: 10,
      monto: 10_000_000,
      tasaEa: 0.18,
      tipoTasa: 'FIJA',
      plazoMeses: 24,
      cuotasPagadasIniciales: 0,
      seguroMensual: 20_000,
      archivado: false,
    };
    // Pago registrado en septiembre: cuenta como la cuota #1 pagada, así que
    // `cuotaMensual` ahora apuntaría a la cuota #2 (la de octubre) — pero el
    // monto que debe verse en "Pagados" es el que realmente se pagó.
    const movimientos = [
      movimiento({
        id: 'mov-vehiculo',
        creditoDestinoId: 'vehiculo',
        fecha: '2026-09-08',
        monto: 555_555,
      }),
    ];
    const resumen = agruparPagosFijosDelMes(
      [],
      { ...SIN_CREDITOS, creditos: [vehiculo], movimientos },
      MES,
    );

    expect(resumen.pagados).toHaveLength(1);
    expect(resumen.pagados[0].monto).toBe(555_555);
  });

  it('caso real: pago del 30-sep a un crédito que vence los 5 marca octubre, no septiembre', () => {
    const vehiculo: CreditoBanco = {
      id: 'vehiculo',
      grupo: 'BANCO',
      nombre: 'Crédito de vehículo',
      diaPago: 5,
      monto: 10_000_000,
      tasaEa: 0.18,
      tipoTasa: 'FIJA',
      plazoMeses: 24,
      cuotasPagadasIniciales: 0,
      seguroMensual: 0,
      archivado: false,
    };
    const movimientos = [
      movimiento({
        id: 'adelantado',
        tipo: 'TRANSFERENCIA',
        creditoDestinoId: 'vehiculo',
        fecha: '2026-09-30',
        monto: 951_387,
      }),
    ];
    const contexto = { ...SIN_CREDITOS, creditos: [vehiculo], movimientos };

    const septiembre = agruparPagosFijosDelMes([], contexto, { anio: 2026, mes: 9 });
    const octubre = agruparPagosFijosDelMes([], contexto, { anio: 2026, mes: 10 });

    expect(septiembre.pagados).toHaveLength(0);
    expect(octubre.porPagar).toHaveLength(0);
    expect(octubre.pagados[0].monto).toBe(951_387);
  });

  it('un crédito de banco ya pagado por completo no aparece (cuota 0)', () => {
    const vehiculo: CreditoBanco = {
      id: 'vehiculo',
      grupo: 'BANCO',
      nombre: 'Crédito de vehículo',
      diaPago: 10,
      monto: 10_000_000,
      tasaEa: 0.18,
      tipoTasa: 'FIJA',
      plazoMeses: 3,
      cuotasPagadasIniciales: 3,
      seguroMensual: 0,
      archivado: false,
    };
    const resumen = agruparPagosFijosDelMes([], { ...SIN_CREDITOS, creditos: [vehiculo] }, MES);
    expect(resumen.porPagar).toHaveLength(0);
  });

  it('ordena "por pagar" por fecha límite ascendente', () => {
    const tarde = pagoFijo({ id: 'a', nombre: 'A', diaLimite: 28 });
    const pronto = pagoFijo({ id: 'b', nombre: 'B', diaLimite: 3 });
    const resumen = agruparPagosFijosDelMes([tarde, pronto], SIN_CREDITOS, MES);
    expect(resumen.porPagar.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('calcula totales y progreso a partir de pagados/por pagar', () => {
    const arriendo = pagoFijo({ id: 'arriendo', nombre: 'Arriendo', monto: 1_800_000 });
    const internet = pagoFijo({ id: 'internet', nombre: 'Internet', monto: 95_000 });
    const movimientos = [
      movimiento({ id: 'mov-internet', pagoFijoId: 'internet', periodo: '2026-09', monto: 95_000 }),
    ];
    const resumen = agruparPagosFijosDelMes(
      [arriendo, internet],
      { ...SIN_CREDITOS, movimientos },
      MES,
    );

    expect(resumen.totalPagado).toBe(95_000);
    expect(resumen.totalPorPagar).toBe(1_800_000);
    expect(resumen.totalMes).toBe(1_895_000);
    expect(resumen.progreso).toBe(Math.round((95_000 / 1_895_000) * 100));
  });
  // Regresión: esta pantalla calculaba la cuota de un crédito de tasa
  // variable con la tasa base del crédito, porque su contexto no tenía por
  // dónde recibir el historial de cambios de tasa. `tasaEaVigente` cae a la
  // tasa base en silencio, así que el número salía plausible pero viejo, y
  // el mismo crédito mostraba una cuota en Créditos y otra acá — arrastrando
  // el error hasta "Falta por pagar" y, desde ahí, hasta "Te queda libre
  // este mes" en General.
  it('usa la tasa vigente, no la base, en un crédito de tasa variable', () => {
    const vehiculo: CreditoBanco = {
      id: 'credito-vehiculo',
      grupo: 'BANCO',
      nombre: 'Crédito de vehículo',
      diaPago: 10,
      monto: 45_000_000,
      tasaEa: 0.195,
      tipoTasa: 'VARIABLE',
      plazoMeses: 60,
      cuotasPagadasIniciales: 14,
      seguroMensual: 65_000,
      archivado: false,
    };
    const subidaDeTasa: CambioTasa[] = [
      { id: 'tasa-1', creditoId: 'credito-vehiculo', fechaDesde: '2026-06-01', tasaEa: 0.212 },
    ];
    const contexto: ContextoPagosFijosMes = { ...SIN_CREDITOS, creditos: [vehiculo] };

    const conTasaBase = agruparPagosFijosDelMes([], contexto, MES);
    const conTasaVigente = agruparPagosFijosDelMes(
      [],
      { ...contexto, cambiosTasa: subidaDeTasa },
      MES,
    );

    const cuotaBase = conTasaBase.porPagar[0].monto;
    const cuotaVigente = conTasaVigente.porPagar[0].monto;

    expect(cuotaBase).toBeGreaterThan(0);
    // Una tasa mayor encarece la cuota: si fueran iguales, el historial se
    // estaría ignorando.
    expect(cuotaVigente).toBeGreaterThan(cuotaBase);
    expect(conTasaVigente.totalPorPagar).toBe(cuotaVigente);
  });
});
