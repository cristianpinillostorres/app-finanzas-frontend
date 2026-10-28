import type { Credito, GrupoCredito } from '../models';
import {
  type ContextoCredito,
  type EstadoPagoCredito,
  cuotaMensual,
  cuotasFaltantes,
  deudaCredito,
  estadoPagoCredito,
} from './creditos';

export interface CreditoConEstado {
  credito: Credito;
  deuda: number;
  cuota: number;
  cuotasFaltantes: number | null;
  /** `null` en personas: no tienen cuota fija ni fecha límite recurrente. */
  estadoPago: EstadoPagoCredito | null;
}

export interface GrupoCreditos {
  grupo: GrupoCredito;
  etiqueta: string;
  creditos: CreditoConEstado[];
}

const ETIQUETA_GRUPO: Record<GrupoCredito, string> = {
  TARJETA: 'Tarjetas',
  BANCO: 'Bancos',
  PLATAFORMA: 'Plataformas',
  PERSONA: 'Personas',
};

/** Orden fijo de los grupos en pantalla, igual al prototipo. */
const ORDEN_GRUPOS: GrupoCredito[] = ['TARJETA', 'BANCO', 'PLATAFORMA', 'PERSONA'];

/**
 * Créditos sin archivar, agrupados por tipo en el orden del prototipo, cada
 * uno con su deuda/cuota/cuotas faltantes/estado de pago ya calculados y
 * ordenados por fecha límite más cercana primero ("Dentro de cada grupo,
 * los créditos se ordenan por fecha límite más cercana", notas
 * funcionales). Las personas no tienen fecha límite: quedan al final, en su
 * orden original. Los grupos sin créditos no se devuelven.
 */
export function agruparCreditosPorTipo(
  creditos: Credito[],
  contexto: ContextoCredito = {},
): GrupoCreditos[] {
  const hoy = contexto.hoy ?? new Date();
  const activos = creditos.filter((c) => !c.archivado);

  return ORDEN_GRUPOS.map((grupo) => {
    const delGrupo: CreditoConEstado[] = activos
      .filter((c) => c.grupo === grupo)
      .map((credito) => ({
        credito,
        deuda: deudaCredito(credito, contexto),
        cuota: cuotaMensual(credito, contexto),
        cuotasFaltantes: cuotasFaltantes(credito, contexto),
        estadoPago: estadoPagoCredito(credito, contexto.movimientos ?? [], hoy),
      }));

    delGrupo.sort((a, b) => {
      const fechaA = a.estadoPago?.fechaLimite.getTime() ?? Infinity;
      const fechaB = b.estadoPago?.fechaLimite.getTime() ?? Infinity;
      return fechaA - fechaB;
    });

    return { grupo, etiqueta: ETIQUETA_GRUPO[grupo], creditos: delGrupo };
  }).filter((g) => g.creditos.length > 0);
}
