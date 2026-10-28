import type { Credito, Cuenta, GrupoCredito } from '../models';

/** Una opción seleccionable en el formulario de movimiento: una cuenta/bolsillo o un crédito. */
export interface OpcionMovimiento {
  id: string;
  tipo: 'cuenta' | 'credito';
  etiqueta: string;
}

export interface GrupoOpcionesMovimiento {
  etiqueta: string;
  opciones: OpcionMovimiento[];
}

/**
 * Cuentas y sus bolsillos como una sola lista plana: cada cuenta raíz
 * seguida de sus bolsillos, con el formato "Bancolombia › Viaje".
 */
export function opcionesCuentasYBolsillos(cuentas: Cuenta[]): OpcionMovimiento[] {
  const activas = cuentas.filter((c) => !c.archivada);
  const raices = activas.filter((c) => c.cuentaPadreId === null);
  const opciones: OpcionMovimiento[] = [];

  for (const raiz of raices) {
    opciones.push({ id: raiz.id, tipo: 'cuenta', etiqueta: raiz.nombre });
    const bolsillos = activas.filter((c) => c.cuentaPadreId === raiz.id);
    for (const bolsillo of bolsillos) {
      opciones.push({
        id: bolsillo.id,
        tipo: 'cuenta',
        etiqueta: `${raiz.nombre} › ${bolsillo.nombre}`,
      });
    }
  }

  return opciones;
}

/** Créditos de un grupo puntual (tarjetas, plataformas...), sin archivar. */
export function opcionesCreditosPorGrupo(
  creditos: Credito[],
  grupo: GrupoCredito,
): OpcionMovimiento[] {
  return creditos
    .filter((c) => !c.archivado && c.grupo === grupo)
    .map((c) => ({ id: c.id, tipo: 'credito' as const, etiqueta: c.nombre }));
}

/** Todos los créditos sin archivar, de cualquier grupo. */
export function opcionesTodosLosCreditos(creditos: Credito[]): OpcionMovimiento[] {
  return creditos
    .filter((c) => !c.archivado)
    .map((c) => ({ id: c.id, tipo: 'credito' as const, etiqueta: c.nombre }));
}

/** "Pagar con" de un gasto: cuentas y bolsillos, tarjetas y plataformas. */
export function gruposPagarCon(cuentas: Cuenta[], creditos: Credito[]): GrupoOpcionesMovimiento[] {
  const grupos: GrupoOpcionesMovimiento[] = [
    { etiqueta: 'Cuentas y bolsillos', opciones: opcionesCuentasYBolsillos(cuentas) },
  ];
  const tarjetas = opcionesCreditosPorGrupo(creditos, 'TARJETA');
  if (tarjetas.length > 0) grupos.push({ etiqueta: 'Tarjetas', opciones: tarjetas });
  const plataformas = opcionesCreditosPorGrupo(creditos, 'PLATAFORMA');
  if (plataformas.length > 0) grupos.push({ etiqueta: 'Plataformas', opciones: plataformas });
  return grupos;
}

/** Destino de una transferencia: cuentas y bolsillos, o un crédito (pago/abono). */
export function gruposTransferenciaHacia(
  cuentas: Cuenta[],
  creditos: Credito[],
): GrupoOpcionesMovimiento[] {
  const grupos: GrupoOpcionesMovimiento[] = [
    { etiqueta: 'Cuentas y bolsillos', opciones: opcionesCuentasYBolsillos(cuentas) },
  ];
  const todosCreditos = opcionesTodosLosCreditos(creditos);
  if (todosCreditos.length > 0) grupos.push({ etiqueta: 'Créditos', opciones: todosCreditos });
  return grupos;
}

/**
 * Filtro "Cuenta o crédito" de Movimientos: cuentas raíz (sin sus bolsillos —
 * filtrar por la raíz ya incluye sus bolsillos, ver `filtrarMovimientos`) más
 * todos los créditos, tal como el prototipo los mezcla en un solo `<select>`.
 */
export function opcionesFiltroMovimientos(
  cuentas: Cuenta[],
  creditos: Credito[],
): OpcionMovimiento[] {
  const raices = cuentas
    .filter((c) => c.cuentaPadreId === null && !c.archivada)
    .map((c) => ({ id: c.id, tipo: 'cuenta' as const, etiqueta: c.nombre }));
  return [...raices, ...opcionesTodosLosCreditos(creditos)];
}
