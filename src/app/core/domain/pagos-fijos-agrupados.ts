import type {
  CambioTasa,
  CompraCuotas,
  Credito,
  ExtractoTarjeta,
  Movimiento,
  PagoFijo,
} from '../models';
import { cuotaMensual, cuotasCubiertas, estadoPagoCreditoEnMes } from './creditos';
import type { AnioMes } from './fechas';
import { periodoIso } from './fechas';
import { aplicaEnMes, fechaLimiteEnMes } from './pagos-fijos';
import type { EstadoSemaforo } from './semaforo';
import { semaforo } from './semaforo';

/** Datos que necesita `agruparPagosFijosDelMes`, además de los pagos fijos propios. */
export interface ContextoPagosFijosMes {
  creditos: Credito[];
  compras: CompraCuotas[];
  extractos: ExtractoTarjeta[];
  movimientos: Movimiento[];
  /**
   * Historial de cambios de tasa, para los créditos de banco con tasa
   * variable. Sin esto, `cuotaMensual` cae a la tasa base del crédito
   * (ver `tasaEaVigente`) y la cuota sale calculada con una tasa vieja: el
   * mismo crédito muestra una cuota en Créditos y otra distinta acá.
   */
  cambiosTasa?: CambioTasa[];
  /** Para pruebas; por defecto la fecha real. */
  hoy?: Date;
}

/**
 * Un pago fijo propio o una cuota de crédito, ya resuelto para un mes
 * concreto. `pagoFijoId`/`cuentaDefaultId`/`categoriaId` solo vienen en los
 * propios; `creditoId` solo en las cuotas de crédito — sirven para
 * preseleccionar el formulario de movimiento al pulsar "Pagar".
 */
export interface ItemPagoFijoMes {
  id: string;
  nombre: string;
  esCredito: boolean;
  pagado: boolean;
  /** Pagado con "Ya lo pagué" (sin movimiento): se puede desmarcar. */
  marcadoSinMovimiento: boolean;
  fechaLimite: Date;
  /** Monto pagado si `pagado`; si no, el fijo/estimado o la cuota del crédito. */
  monto: number;
  /** El monto es un estimado (pago variable aún no pagado este mes). */
  esEstimado: boolean;
  estado: EstadoSemaforo;
  periodo: string;
  pagoFijoId?: string;
  creditoId?: string;
  cuentaDefaultId?: string;
  categoriaId?: string;
}

export interface ResumenPagosFijosMes {
  mes: AnioMes;
  /** Por fecha límite, la más próxima primero. */
  porPagar: ItemPagoFijoMes[];
  pagados: ItemPagoFijoMes[];
  totalMes: number;
  totalPagado: number;
  totalPorPagar: number;
  /** Porcentaje pagado del total del mes (0-100), para la barra de progreso. */
  progreso: number;
}

function itemsPropios(
  pagosFijos: PagoFijo[],
  movimientos: Movimiento[],
  mes: AnioMes,
): ItemPagoFijoMes[] {
  const periodo = periodoIso(mes);

  return pagosFijos
    .filter((p) => aplicaEnMes(p, mes))
    .map((p) => {
      const movimientoPago = movimientos.find(
        (m) => m.pagoFijoId === p.id && m.periodo === periodo,
      );
      // "Ya lo pagué": pagado sin movimiento que lo respalde, así que el
      // monto que se muestra es el del pago fijo (el estimado, si varía).
      const marcadoSinMovimiento =
        movimientoPago === undefined && (p.periodosPagadosSinMovimiento ?? []).includes(periodo);
      const pagado = movimientoPago !== undefined || marcadoSinMovimiento;
      const fechaLimite = fechaLimiteEnMes(p, mes);
      return {
        id: p.id,
        nombre: p.nombre,
        esCredito: false,
        pagado,
        marcadoSinMovimiento,
        fechaLimite,
        monto: movimientoPago ? movimientoPago.monto : p.monto,
        esEstimado: p.esVariable && !pagado,
        estado: semaforo(fechaLimite, new Date(), pagado),
        periodo,
        pagoFijoId: p.id,
        cuentaDefaultId: p.cuentaDefaultId,
        categoriaId: p.categoriaId,
      };
    });
}

function itemsCreditos(contexto: ContextoPagosFijosMes, mes: AnioMes): ItemPagoFijoMes[] {
  const periodo = periodoIso(mes);
  const referencia = {
    compras: contexto.compras,
    movimientos: contexto.movimientos,
    extractos: contexto.extractos,
    cambiosTasa: contexto.cambiosTasa,
  };

  const items: ItemPagoFijoMes[] = [];
  for (const credito of contexto.creditos) {
    if (credito.archivado) continue;
    const estadoPago = estadoPagoCreditoEnMes(credito, contexto.movimientos, mes, contexto.hoy);
    if (!estadoPago) continue; // personas: sin cuota mensual, no aparecen aquí

    // Pagada: el monto real del movimiento que la pagó (la cuota "siguiente"
    // que da `cuotaMensual` ya no corresponde a este mes, sino al que sigue).
    const pago = estadoPago.pagadoEsteMes
      ? cuotasCubiertas(credito, contexto.movimientos).get(periodo)
      : undefined;
    const monto = pago
      ? pago.monto
      : cuotaMensual(credito, { ...referencia, hoy: new Date(mes.anio, mes.mes - 1, 1) });
    if (monto <= 0) continue; // sin cuota este mes (ej. crédito ya pagado por completo)

    items.push({
      id: credito.id,
      nombre: credito.nombre,
      esCredito: true,
      pagado: estadoPago.pagadoEsteMes,
      marcadoSinMovimiento: false,
      fechaLimite: estadoPago.fechaLimite,
      monto,
      esEstimado: false,
      estado: semaforo(estadoPago.fechaLimite, new Date(), estadoPago.pagadoEsteMes),
      periodo,
      creditoId: credito.id,
    });
  }
  return items;
}

/**
 * Todo lo que aparece en Pagos fijos para un mes: pagos fijos propios que
 * apliquen ese mes más las cuotas de créditos con cuota mensual (tarjeta,
 * banco, plataforma — no personas, que solo manejan abonos). Ver
 * `notas-app-finanzas.md`, "Tab Pagos fijos".
 */
export function agruparPagosFijosDelMes(
  pagosFijos: PagoFijo[],
  contexto: ContextoPagosFijosMes,
  mes: AnioMes,
): ResumenPagosFijosMes {
  const todos = [
    ...itemsPropios(pagosFijos, contexto.movimientos, mes),
    ...itemsCreditos(contexto, mes),
  ];

  const porPagar = todos
    .filter((i) => !i.pagado)
    .sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime());
  const pagados = todos.filter((i) => i.pagado);

  const totalPagado = pagados.reduce((acc, i) => acc + i.monto, 0);
  const totalPorPagar = porPagar.reduce((acc, i) => acc + i.monto, 0);
  const totalMes = totalPagado + totalPorPagar;

  return {
    mes,
    porPagar,
    pagados,
    totalMes,
    totalPagado,
    totalPorPagar,
    progreso: totalMes > 0 ? Math.round((totalPagado / totalMes) * 100) : 0,
  };
}
