import { esCuotaCredito, type CompraCuotas, type Credito, type Movimiento } from '../models';
import { cuotasFaltantes, cuotasFaltantesCompra } from './creditos';

/** Un crédito con cuotas por delante, listo para su barra de progreso. */
export interface CreditoConProgreso {
  credito: Credito;
  /** Cuotas que le faltan. */
  faltan: number;
  /** Cuotas totales (el plazo del banco, o el de la compra con más cuotas por delante). */
  total: number;
  /** 0-100: cuotas ya pagadas del total. */
  progreso: number;
}

function compraDominante(
  compras: CompraCuotas[],
  creditoId: string,
  hoy: Date,
): CompraCuotas | undefined {
  return compras
    .filter((c) => c.creditoId === creditoId && cuotasFaltantesCompra(c, hoy) > 0)
    .reduce<CompraCuotas | undefined>(
      (dominante, c) =>
        !dominante || cuotasFaltantesCompra(c, hoy) > cuotasFaltantesCompra(dominante, hoy)
          ? c
          : dominante,
      undefined,
    );
}

/**
 * Créditos con un total de cuotas claro, para el panel "Cuotas que faltan"
 * de General: bancos, con su plazo fijo; tarjetas y plataformas, según la
 * compra con más cuotas por delante (la misma que usa `cuotasFaltantes()`
 * para decidir cuántas le faltan al crédito). Las personas no manejan
 * cuotas (solo abonos) y no aparecen; tampoco los créditos ya sin cuotas
 * pendientes.
 */
export function creditosConCuotasPendientes(
  creditos: Credito[],
  compras: CompraCuotas[],
  movimientos: Movimiento[],
  hoy: Date = new Date(),
): CreditoConProgreso[] {
  const resultado: CreditoConProgreso[] = [];

  for (const credito of creditos) {
    if (credito.archivado) continue;

    if (credito.grupo === 'BANCO') {
      const faltan = cuotasFaltantes(credito, { movimientos, hoy });
      if (!faltan) continue;
      resultado.push({
        credito,
        faltan,
        total: credito.plazoMeses,
        progreso: Math.round(((credito.plazoMeses - faltan) / credito.plazoMeses) * 100),
      });
    } else if (esCuotaCredito(credito)) {
      const dominante = compraDominante(compras, credito.id, hoy);
      if (!dominante) continue;
      const faltan = cuotasFaltantesCompra(dominante, hoy);
      resultado.push({
        credito,
        faltan,
        total: dominante.numCuotas,
        progreso: Math.round(((dominante.numCuotas - faltan) / dominante.numCuotas) * 100),
      });
    }
  }

  return resultado;
}
