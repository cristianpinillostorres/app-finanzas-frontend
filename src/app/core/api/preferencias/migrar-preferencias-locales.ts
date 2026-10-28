import type { CambiosPreferencias, Preferencias } from '../../models';

/**
 * Antes estas preferencias vivían en el `localStorage` de cada navegador
 * (y en otro navegador había que decidir todo de nuevo). Lo que encuentre
 * acá sube a la cuenta sin pisar lo que ya esté en ella, y se borra del
 * navegador: después de la primera vez no queda nada que migrar.
 *
 * Devuelve los cambios a escribir, o `null` si no hay nada.
 */
export function migrarPreferenciasLocales(
  uid: string | undefined,
  actuales: Preferencias,
): CambiosPreferencias | null {
  if (!uid) return null;
  const claves = {
    oculto: `finanzas.primerosPasos.oculto.${uid}`,
    omitidos: `finanzas.primerosPasos.omitidos.${uid}`,
    gasto: 'finanzas.ultimaCuentaGasto',
    ingreso: 'finanzas.ultimaCuentaIngreso',
  };
  const cambios: CambiosPreferencias = {};
  try {
    if (localStorage.getItem(claves.oculto) === '1' && !actuales.recorrido.oculto) {
      cambios.recorrido = { oculto: true };
    }
    const omitidos = leerLista(localStorage.getItem(claves.omitidos));
    const nuevos = omitidos.filter((id) => !actuales.recorrido.omitidos.includes(id));
    if (nuevos.length > 0) {
      cambios.recorrido = {
        ...cambios.recorrido,
        omitidos: [...actuales.recorrido.omitidos, ...nuevos],
      };
    }
    const gasto = localStorage.getItem(claves.gasto);
    const ingreso = localStorage.getItem(claves.ingreso);
    if (gasto && !actuales.ultimaCuenta.gasto) cambios.ultimaCuenta = { gasto };
    if (ingreso && !actuales.ultimaCuenta.ingreso) {
      cambios.ultimaCuenta = { ...cambios.ultimaCuenta, ingreso };
    }
    for (const clave of Object.values(claves)) localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento: no hay nada que migrar.
    return null;
  }
  return cambios.recorrido || cambios.ultimaCuenta ? cambios : null;
}

function leerLista(valor: string | null): string[] {
  try {
    const lista: unknown = JSON.parse(valor ?? '[]');
    return Array.isArray(lista) ? lista.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
