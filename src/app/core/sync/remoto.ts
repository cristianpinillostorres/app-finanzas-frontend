import type { SupabaseClient } from '@supabase/supabase-js';

import type { Operacion } from './persistencia';
import { type Fila, type NombreTabla, TABLAS, aFila, desdeFila } from './tablas';

/**
 * Qué pasó al subir una operación:
 * - `ok`: quedó en la base.
 * - `reintentar`: sin red, servidor caído o sesión por renovar. Se intenta
 *   después, en el mismo orden.
 * - `rechazada`: la base no la acepta (restricción, RLS…). Reintentarla
 *   daría el mismo error y frenaría todo lo que viene detrás en la cola.
 */
export type ResultadoRemoto = 'ok' | 'reintentar' | { rechazada: unknown };

/** Lo que el sincronizador necesita del servidor. Aparte para poder probarlo sin Supabase. */
export interface Remoto {
  ejecutar(operacion: Operacion, uid: string): Promise<ResultadoRemoto>;
  /** Todas las filas del usuario en la tabla. Lanza si no se pudo. */
  descargar(tabla: NombreTabla, uid: string): Promise<Fila[]>;
  /**
   * Avisa de las filas creadas o cambiadas desde otro dispositivo, y cada
   * vez que la conexión en vivo (re)queda lista — ahí conviene descargar
   * lo que pasó mientras estuvo caída. Devuelve cómo cancelar.
   */
  escuchar(
    uid: string,
    alCambiar: (tabla: NombreTabla, fila: Fila) => void,
    alConectar: () => void,
  ): () => void;
}

/** PostgREST devuelve hasta 1000 filas por consulta. */
const PAGINA = 1000;

export class RemotoSupabase implements Remoto {
  constructor(private readonly supabase: SupabaseClient) {}

  async ejecutar(operacion: Operacion, uid: string): Promise<ResultadoRemoto> {
    const { tabla, id } = operacion;
    // El id va en la ruta de la fila, nunca como un cambio.
    const { id: _id, ...datos } = operacion.datos ?? {};
    const columnas = aFila(tabla, datos);
    if (operacion.tipo === 'actualizar' && Object.keys(columnas).length === 0) return 'ok';
    try {
      const consulta = this.supabase.from(tabla);
      const { error, status } =
        operacion.tipo === 'guardar'
          ? await consulta.upsert({ ...columnas, id, user_id: uid }, { onConflict: 'user_id,id' })
          : operacion.tipo === 'actualizar'
            ? await consulta.update(columnas).eq('user_id', uid).eq('id', id)
            : await consulta.delete().eq('user_id', uid).eq('id', id);
      if (!error) return 'ok';
      return esDefinitivo(status) ? { rechazada: error } : 'reintentar';
    } catch {
      return 'reintentar';
    }
  }

  async descargar(tabla: NombreTabla, uid: string): Promise<Fila[]> {
    const filas: Fila[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await this.supabase
        .from(tabla)
        .select('*')
        .eq('user_id', uid)
        .order('id')
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      filas.push(...data.map((fila) => desdeFila(tabla, fila)));
      if (data.length < PAGINA) return filas;
    }
  }

  escuchar(
    uid: string,
    alCambiar: (tabla: NombreTabla, fila: Fila) => void,
    alConectar: () => void,
  ): () => void {
    // Solo altas y cambios, filtrados por usuario (RLS además lo exige).
    // Los borrados no se escuchan: Supabase no puede filtrarlos por
    // usuario y los mandaría a todos; se recogen al descargar.
    const canal = this.supabase.channel(`finanzas-${uid}`);
    for (const tabla of TABLAS) {
      for (const evento of ['INSERT', 'UPDATE'] as const) {
        canal.on(
          'postgres_changes',
          { event: evento, schema: 'public', table: tabla, filter: `user_id=eq.${uid}` },
          (cambio) => alCambiar(tabla, desdeFila(tabla, cambio.new as Record<string, unknown>)),
        );
      }
    }
    canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') alConectar();
    });
    return () => void this.supabase.removeChannel(canal);
  }
}

/**
 * Un 4xx es la base diciendo que no, salvo los que se arreglan solos:
 * 401 (token vencido: el cliente lo renueva), 408 y 429. Sin estado (0),
 * la petición ni llegó.
 */
function esDefinitivo(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}
