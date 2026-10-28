import type {
  CambioTasa,
  CompraCuotas,
  Credito,
  CreditoBanco,
  ExtractoTarjeta,
  Movimiento,
} from '../models';
import type { AnioMes } from './fechas';
import {
  anioMesDe,
  diasEntre,
  fechaLocalDesdeIso,
  mesesEntre,
  periodoIso as periodoDeMes,
  sumarMesesAnioMes,
  ultimoDiaDelMes,
} from './fechas';
import { tablaAmortizacion, tasaMensual } from './tasas';

/** Valor de cada cuota de una compra: el dado por la plataforma, o monto / cuotas en tarjetas. */
export function valorCuotaCompra(compra: CompraCuotas): number {
  return compra.valorCuota ?? Math.round(compra.monto / compra.numCuotas);
}

/**
 * Cuotas que le faltan a una compra puntual, a partir de los meses
 * transcurridos desde la fecha de compra (la compra en sí ya cuenta como la
 * primera cuota del periodo en que se hizo).
 */
export function cuotasFaltantesCompra(compra: CompraCuotas, hoy: Date = new Date()): number {
  const transcurridos = mesesEntre(fechaLocalDesdeIso(compra.fecha), hoy);
  return Math.max(0, Math.min(compra.numCuotas, compra.numCuotas - transcurridos));
}

/** Datos externos que necesita `deudaCredito` y `cuotasFaltantes` según el grupo del crédito. */
export interface ContextoCredito {
  /** Compras del crédito, para TARJETA y PLATAFORMA. */
  compras?: CompraCuotas[];
  /** Movimientos con `creditoDestinoId` en este crédito: pagos (BANCO) o abonos (PERSONA). */
  movimientos?: Movimiento[];
  /** Extractos anotados, para TARJETA (ver `cuotaMensual`). */
  extractos?: ExtractoTarjeta[];
  /** Historial de cambios de tasa, para BANCO de tasa variable (ver `tasaEaVigente`). */
  cambiosTasa?: CambioTasa[];
  hoy?: Date;
}

/**
 * Tasa E.A. vigente de un crédito con banco: la del cambio de tasa más
 * reciente con `fechaDesde` ya cumplida, o si no hay ninguno, la tasa base
 * del crédito. Se usa una sola tasa para toda la tabla de amortización (no
 * una por cuota histórica) porque el crédito no guarda su fecha de inicio,
 * así que no hay forma de ubicar cada fila en el calendario.
 */
export function tasaEaVigente(
  credito: CreditoBanco,
  cambiosTasa: CambioTasa[],
  hoy: Date = new Date(),
): number {
  const vigentes = cambiosTasa
    .filter((c) => c.creditoId === credito.id && fechaLocalDesdeIso(c.fechaDesde) <= hoy)
    .sort((a, b) => b.fechaDesde.localeCompare(a.fechaDesde));
  return vigentes[0]?.tasaEa ?? credito.tasaEa;
}

/** Cuotas ya pagadas de un crédito con banco: las iniciales más los pagos registrados. */
export function cuotasPagadasBanco(
  credito: Credito & { grupo: 'BANCO' },
  movimientos: Movimiento[],
): number {
  const pagos = movimientos.filter((m) => m.creditoDestinoId === credito.id).length;
  return credito.cuotasPagadasIniciales + pagos;
}

/**
 * Deuda actual de un crédito, según su grupo:
 * - Tarjeta y plataforma: suma de las cuotas pendientes de sus compras.
 * - Banco: saldo restante según la tabla de amortización.
 * - Persona: monto acordado menos los abonos hechos.
 */
export function deudaCredito(credito: Credito, contexto: ContextoCredito = {}): number {
  const hoy = contexto.hoy ?? new Date();

  switch (credito.grupo) {
    case 'TARJETA':
    case 'PLATAFORMA': {
      const compras = (contexto.compras ?? []).filter((c) => c.creditoId === credito.id);
      return compras.reduce(
        (acc, compra) => acc + cuotasFaltantesCompra(compra, hoy) * valorCuotaCompra(compra),
        0,
      );
    }
    case 'BANCO': {
      const pagadas = cuotasPagadasBanco(credito, contexto.movimientos ?? []);
      if (pagadas <= 0) return credito.monto;
      if (pagadas >= credito.plazoMeses) return 0;
      const tasaEa = tasaEaVigente(credito, contexto.cambiosTasa ?? [], hoy);
      const tabla = tablaAmortizacion(
        credito.monto,
        tasaMensual(tasaEa),
        credito.plazoMeses,
        credito.seguroMensual,
      );
      return tabla[pagadas - 1].saldoFinal;
    }
    case 'PERSONA': {
      const abonos = (contexto.movimientos ?? [])
        .filter((m) => m.creditoDestinoId === credito.id)
        .reduce((acc, m) => acc + m.monto, 0);
      return Math.max(0, credito.monto - abonos);
    }
  }
}

/**
 * Cuotas que le faltan a un crédito, según su grupo:
 * - Tarjeta y plataforma: la de su compra más larga (la que más cuotas tiene por delante).
 * - Banco: plazo total menos las cuotas ya pagadas.
 * - Persona: `null`, porque no maneja cuotas, solo abonos.
 */
export function cuotasFaltantes(credito: Credito, contexto: ContextoCredito = {}): number | null {
  const hoy = contexto.hoy ?? new Date();

  switch (credito.grupo) {
    case 'TARJETA':
    case 'PLATAFORMA': {
      const compras = (contexto.compras ?? []).filter((c) => c.creditoId === credito.id);
      if (compras.length === 0) return 0;
      return Math.max(...compras.map((c) => cuotasFaltantesCompra(c, hoy)));
    }
    case 'BANCO': {
      const pagadas = cuotasPagadasBanco(credito, contexto.movimientos ?? []);
      return Math.max(0, credito.plazoMeses - pagadas);
    }
    case 'PERSONA':
      return null;
  }
}

/** Fecha límite de pago de un crédito y si ya se pagó este mes, ver `estadoPagoCredito`. */
export interface EstadoPagoCredito {
  fechaLimite: Date;
  pagadoEsteMes: boolean;
}

function fechaLimiteEnMes(credito: Credito, mes: AnioMes): Date {
  const dia = Math.min(credito.diaPago, ultimoDiaDelMes(mes.anio, mes.mes));
  return new Date(mes.anio, mes.mes - 1, dia);
}

function pagosDelCredito(creditoId: string, movimientos: Movimiento[]): Movimiento[] {
  return movimientos
    .filter((m) => m.creditoDestinoId === creditoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn));
}

/** Mes de la primera cuota que vence en `fecha` o después. */
function mesDelProximoVencimiento(credito: Credito, fecha: Date): AnioMes {
  const mes = anioMesDe(fecha);
  return fechaLimiteEnMes(credito, mes) < fecha ? sumarMesesAnioMes(mes, 1) : mes;
}

/**
 * Mes de la primera cuota que lleva la app. Las anteriores se pagaron por
 * fuera de la app y no se cobran.
 * - Con `creadoEn`: la primera cuota que vence desde que se registró el crédito.
 * - Créditos viejos, sin `creadoEn`: la cuota con vencimiento más cercano a
 *   su primer pago. Un pago el 30 de septiembre en un crédito que vence los
 *   5 cubre el 5 de octubre (5 días antes), no el 5 de septiembre (25 días
 *   después); uno el 8 de septiembre cubre el 5 de septiembre.
 * `null` si no hay ni `creadoEn` ni pagos.
 */
export function primerMesLlevado(credito: Credito, movimientos: Movimiento[]): AnioMes | null {
  if (credito.creadoEn) {
    return mesDelProximoVencimiento(credito, fechaLocalDesdeIso(credito.creadoEn.slice(0, 10)));
  }
  const primerPago = pagosDelCredito(credito.id, movimientos)[0];
  if (!primerPago) return null;
  const fecha = fechaLocalDesdeIso(primerPago.fecha);
  const siguiente = mesDelProximoVencimiento(credito, fecha);
  const anterior = sumarMesesAnioMes(siguiente, -1);
  const diasDesdeAnterior = diasEntre(fechaLimiteEnMes(credito, anterior), fecha);
  const diasHastaSiguiente = diasEntre(fecha, fechaLimiteEnMes(credito, siguiente));
  return diasDesdeAnterior <= diasHastaSiguiente ? anterior : siguiente;
}

/**
 * Qué cuota cubre cada pago, por periodo "YYYY-MM": los pagos, en orden de
 * fecha, cubren las cuotas en orden de vencimiento desde `primerMesLlevado`.
 * Así un pago adelantado (30 de septiembre) cubre la cuota siguiente (5 de
 * octubre), y uno atrasado cubre la que estaba pendiente.
 */
export function cuotasCubiertas(
  credito: Credito,
  movimientos: Movimiento[],
): Map<string, Movimiento> {
  const cubiertas = new Map<string, Movimiento>();
  let mes = primerMesLlevado(credito, movimientos);
  if (!mes) return cubiertas;
  for (const pago of pagosDelCredito(credito.id, movimientos)) {
    cubiertas.set(periodoDeMes(mes), pago);
    mes = sumarMesesAnioMes(mes, 1);
  }
  return cubiertas;
}

/**
 * Próxima fecha límite de pago y si ya se pagó la cuota de este mes, para
 * créditos con cuota mensual (tarjeta, banco, plataforma). `null` en
 * personas, que no tienen cuota fija (ver `fechaAcordada`).
 *
 * La fecha límite es la de la primera cuota sin cubrir: puede ser una ya
 * vencida, o una de un mes siguiente si se adelantaron pagos.
 */
export function estadoPagoCredito(
  credito: Credito,
  movimientos: Movimiento[],
  hoy: Date = new Date(),
): EstadoPagoCredito | null {
  if (credito.grupo === 'PERSONA') return null;

  const mesActual = anioMesDe(hoy);
  const cubiertas = cuotasCubiertas(credito, movimientos);
  const pagadoEsteMes = cubiertas.has(periodoDeMes(mesActual));

  let mes = primerMesLlevado(credito, movimientos) ?? mesActual;
  while (cubiertas.has(periodoDeMes(mes))) mes = sumarMesesAnioMes(mes, 1);
  return { fechaLimite: fechaLimiteEnMes(credito, mes), pagadoEsteMes };
}

/**
 * Igual que `estadoPagoCredito`, pero para un mes concreto en vez de "hoy":
 * usa Pagos fijos con su selector de mes. No rueda al mes siguiente: sirve
 * para separar "Por pagar" de "Pagados" en el mes que se está viendo.
 * `null` también si la cuota de ese mes vence antes de que se llevara el
 * crédito en la app (no se debe).
 */
export function estadoPagoCreditoEnMes(
  credito: Credito,
  movimientos: Movimiento[],
  mes: AnioMes,
  hoy: Date = new Date(),
): EstadoPagoCredito | null {
  if (credito.grupo === 'PERSONA') return null;

  // Sin `creadoEn` ni pagos no se sabe desde cuándo se lleva: se cobra desde
  // el mes actual, nunca en meses anteriores.
  const primero = primerMesLlevado(credito, movimientos) ?? anioMesDe(hoy);
  if (periodoDeMes(mes) < periodoDeMes(primero)) return null;

  const pagadoEsteMes = cuotasCubiertas(credito, movimientos).has(periodoDeMes(mes));
  return { fechaLimite: fechaLimiteEnMes(credito, mes), pagadoEsteMes };
}

function periodoIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function cuotaComprasDelMes(creditoId: string, compras: CompraCuotas[], hoy: Date): number {
  return compras
    .filter((c) => c.creditoId === creditoId && cuotasFaltantesCompra(c, hoy) > 0)
    .reduce((acc, c) => acc + valorCuotaCompra(c), 0);
}

/**
 * Cuota a pagar este mes, según el grupo:
 * - Tarjeta: el valor del extracto si ya llegó para este periodo; si no, la
 *   suma de las cuotas de sus compras (notas: "cuando llega el extracto, se
 *   anota el valor a pagar real del mes").
 * - Plataforma: siempre la suma de las cuotas de sus compras (no tiene extracto).
 * - Banco: la cuota de la tabla de amortización que sigue (capital + interés + seguro).
 * - Persona: no aplica, no tiene cuota mensual.
 */
export function cuotaMensual(credito: Credito, contexto: ContextoCredito = {}): number {
  const hoy = contexto.hoy ?? new Date();
  const compras = contexto.compras ?? [];

  switch (credito.grupo) {
    case 'TARJETA': {
      const extracto = (contexto.extractos ?? []).find(
        (e) => e.creditoId === credito.id && e.periodo === periodoIso(hoy),
      );
      return extracto ? extracto.valorAPagar : cuotaComprasDelMes(credito.id, compras, hoy);
    }
    case 'PLATAFORMA':
      return cuotaComprasDelMes(credito.id, compras, hoy);
    case 'BANCO': {
      const pagadas = cuotasPagadasBanco(credito, contexto.movimientos ?? []);
      if (pagadas >= credito.plazoMeses) return 0;
      const tasaEa = tasaEaVigente(credito, contexto.cambiosTasa ?? [], hoy);
      const tabla = tablaAmortizacion(
        credito.monto,
        tasaMensual(tasaEa),
        credito.plazoMeses,
        credito.seguroMensual,
      );
      return tabla[pagadas].cuota;
    }
    case 'PERSONA':
      return 0;
  }
}
