import type { Movimiento } from '../models';
import type { AnioMes } from './fechas';
import { diasEntre, fechaLocalDesdeIso, inicioDelDia, perteneceAlMes } from './fechas';
import type { ItemPagoFijoMes } from './pagos-fijos-agrupados';
import type { EstadoPresupuesto } from './presupuestos';

/** Ids del catálogo base (ver `categorias-catalogo.ts`) que cambian cómo se lee un ingreso. */
export const CATEGORIA_REEMBOLSO = 'cat-reembolso';
export const CATEGORIA_SALARIO = 'cat-salario';

/**
 * Lo que entró y salió en un mes, sin que una cosa tape a la otra.
 *
 * - `ingresos`: lo que entró y es tuyo (sueldo y similares). Los reembolsos
 *   no cuentan: es plata que alguien te devuelve, no plata que ganaste, y
 *   mezclada con los ingresos hacía ver un mes más holgado de lo que era.
 * - `reembolsos`: lo que te devolvieron. Se muestra aparte y no se resta del
 *   gasto: puede devolverte en noviembre algo que gastaste en septiembre.
 * - `gastos`: lo que se gastó (compras, servicios, comida…).
 * - `pagosDeuda`: lo que se pagó a créditos. Una transferencia a un crédito
 *   no es un gasto —no hay una compra nueva—, pero sí es plata que salió, y
 *   dejarla fuera hacía parecer que el mes salía mucho más barato.
 * - `salidas`: gastos más pagos de deuda: lo que realmente salió.
 */
export interface SalidasYEntradasMes {
  ingresos: number;
  reembolsos: number;
  gastos: number;
  pagosDeuda: number;
  salidas: number;
}

export function salidasYEntradasDelMes(
  movimientos: readonly Movimiento[],
  mes: AnioMes,
): SalidasYEntradasMes {
  let ingresos = 0;
  let reembolsos = 0;
  let gastos = 0;
  let pagosDeuda = 0;

  for (const m of movimientos) {
    if (!perteneceAlMes(m.fecha, mes)) continue;
    if (m.tipo === 'INGRESO') {
      if (m.categoriaId === CATEGORIA_REEMBOLSO) reembolsos += m.monto;
      else ingresos += m.monto;
    } else if (m.tipo === 'GASTO') {
      gastos += m.monto;
    } else if (m.tipo === 'TRANSFERENCIA' && m.creditoDestinoId !== undefined) {
      pagosDeuda += m.monto;
    }
  }

  return { ingresos, reembolsos, gastos, pagosDeuda, salidas: gastos + pagosDeuda };
}

/**
 * Cuánto se puede gastar por día hasta el próximo pago sin quedarse corto:
 * lo libre repartido en los días que faltan. Hoy cuenta como un día, así que
 * el día antes del pago todavía se reparte entre uno. Sin plata libre da 0.
 */
export function gastoDiarioPermitido(libre: number, diasHastaPago: number): number {
  if (libre <= 0) return 0;
  return Math.floor(libre / Math.max(diasHastaPago, 1));
}

/**
 * Cuánto se ha gastado por día en promedio en los últimos `dias` días, hoy
 * incluido. Solo gastos: los pagos de deuda ya están descontados de lo libre.
 */
export function ritmoDeGasto(movimientos: readonly Movimiento[], hoy: Date, dias = 7): number {
  const hasta = inicioDelDia(hoy);
  const total = movimientos
    .filter((m) => m.tipo === 'GASTO')
    .filter((m) => {
      const atras = diasEntre(fechaLocalDesdeIso(m.fecha), hasta);
      return atras >= 0 && atras < dias;
    })
    .reduce((acc, m) => acc + m.monto, 0);
  return total / dias;
}

/**
 * El ritmo contra lo permitido, con la misma regla de los presupuestos: por
 * debajo del 80 % va bien, hasta el 100 % está cerca y más allá se pasó.
 */
export function estadoDelRitmo(ritmo: number, permitido: number): EstadoPresupuesto {
  if (permitido <= 0) return ritmo > 0 ? 'pasado' : 'bien';
  const proporcion = ritmo / permitido;
  if (proporcion > 1) return 'pasado';
  if (proporcion >= 0.8) return 'cerca';
  return 'bien';
}

/** Un movimiento de plata que viene: un pago que vence o el ingreso esperado. */
export interface EventoDeCaja {
  id: string;
  nombre: string;
  fecha: Date;
  /** Positivo si entra plata, negativo si sale. */
  monto: number;
  /** Lo que quedaría en cuentas justo después de este evento. */
  saldoDespues: number;
  esIngreso: boolean;
  /** El pago ya venció: va primero, y `fecha` es hoy para ordenarlo; ver `vence`. */
  vencido: boolean;
  /** La fecha límite real del pago, aunque ya haya pasado. */
  vence?: Date;
  /** Solo en pagos: para pintar su semáforo. */
  estado?: ItemPagoFijoMes['estado'];
  esEstimado?: boolean;
}

/** El sueldo que se espera, para proyectar: cuánto y cuándo. */
export interface IngresoEsperado {
  nombre: string;
  fecha: Date;
  monto: number;
}

/**
 * La plata de los próximos días como una sola línea de tiempo: lo que tienes
 * hoy, cada pago que vence y el sueldo cuando llega, con lo que quedaría en
 * cuentas después de cada paso. Sirve para ver de una el golpe que viene
 * —cuándo la plata se acaba, o cuánto se necesita reservar— en vez de mirar
 * una lista de pagos sin saber qué saldo hay detrás.
 *
 * Los pagos vencidos van primero (ya hay que pagarlos). El día del pago, el
 * sueldo va antes que los pagos de ese día: es con ese ingreso que se pagan,
 * igual que en `libreHastaProximoPago`.
 */
export function proyeccionDeCaja(
  disponible: number,
  pendientes: readonly ItemPagoFijoMes[],
  hoy: Date,
  ingreso: IngresoEsperado | null,
  horizonteDias = 30,
): EventoDeCaja[] {
  const inicio = inicioDelDia(hoy);
  const dentro = (fecha: Date) => diasEntre(inicio, fecha) <= horizonteDias;

  const eventos: Omit<EventoDeCaja, 'saldoDespues'>[] = pendientes
    .filter((p) => !p.pagado && dentro(p.fechaLimite))
    .map((p) => {
      const vencido = inicioDelDia(p.fechaLimite) < inicio;
      return {
        id: p.id,
        nombre: p.nombre,
        fecha: vencido ? inicio : inicioDelDia(p.fechaLimite),
        monto: -p.monto,
        esIngreso: false,
        vencido,
        vence: p.fechaLimite,
        estado: p.estado,
        esEstimado: p.esEstimado,
      };
    });

  if (ingreso && diasEntre(inicio, ingreso.fecha) > 0 && dentro(ingreso.fecha)) {
    eventos.push({
      id: 'ingreso-esperado',
      nombre: ingreso.nombre,
      fecha: inicioDelDia(ingreso.fecha),
      monto: ingreso.monto,
      esIngreso: true,
      vencido: false,
    });
  }

  eventos.sort(
    (a, b) =>
      a.fecha.getTime() - b.fecha.getTime() ||
      Number(b.vencido) - Number(a.vencido) ||
      Number(b.esIngreso) - Number(a.esIngreso),
  );

  let saldo = disponible;
  return eventos.map((e) => {
    saldo += e.monto;
    return { ...e, saldoDespues: saldo };
  });
}

/**
 * El último sueldo registrado, como referencia de lo que entra cada mes.
 * `null` si nunca se registró uno.
 */
export function ultimoSueldo(movimientos: readonly Movimiento[]): number | null {
  const sueldos = movimientos
    .filter((m) => m.tipo === 'INGRESO' && m.categoriaId === CATEGORIA_SALARIO)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));
  return sueldos[0]?.monto ?? null;
}

/** Lo que se paga en cuotas de créditos en un mes (pagadas y por pagar). */
export function totalCuotasDelMes(items: readonly ItemPagoFijoMes[]): number {
  return items.filter((i) => i.esCredito).reduce((acc, i) => acc + i.monto, 0);
}

/**
 * El color de la barra de "comprometido". Una regla corriente de
 * presupuesto personal es no pasar de ~35-40 % del ingreso en cuotas: por
 * debajo del 35 % va bien, hasta la mitad está cerca de apretar y más
 * allá ya no queda margen para vivir.
 */
export function estadoDeComprometido(proporcion: number): EstadoPresupuesto {
  if (proporcion > 0.5) return 'pasado';
  if (proporcion >= 0.35) return 'cerca';
  return 'bien';
}

/**
 * Qué parte del sueldo ya está comprometida en cuotas (0.65 = 65 %). Sin
 * sueldo de referencia no hay con qué comparar, así que da `null`.
 */
export function proporcionComprometida(
  cuotasDelMes: number,
  sueldo: number | null,
): number | null {
  if (sueldo === null || sueldo <= 0) return null;
  return cuotasDelMes / sueldo;
}
