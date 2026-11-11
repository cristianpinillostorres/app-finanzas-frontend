import { Injectable, inject } from '@angular/core';

import { type AlertaAsistente, textoDeIaValido } from '../../domain/asistente';
import type { Objetivo } from '../../models';
import { SUPABASE } from '../../supabase/supabase.tokens';

/** Lo que escribe la IA para reemplazar el titular y el consejo de plantilla. */
export interface TextoDeIa {
  titular: string;
  consejo: string;
}

/**
 * El texto con IA del asistente de General (ver `supabase/functions/asistente`).
 *
 * La IA solo redacta: las cifras, la urgencia y el botón salen de las reglas
 * (`alertaDelAsistente`). La función guarda un análisis por persona y por día;
 * si ya lo hay, lo devuelve sin llamar a la IA otra vez. Cualquier problema
 * (sin sesión real, sin cupo, la IA no contestó, texto con cifras inventadas)
 * da `null` y la tarjeta se queda con su texto de plantilla.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteIa {
  private readonly supabase = inject(SUPABASE);
  /** Si la función no responde (aún no publicada, sin red), no se insiste en esta visita. */
  private caida = false;

  async analizar(
    alerta: AlertaAsistente,
    objetivo: Objetivo | null,
    dia: string,
  ): Promise<TextoDeIa | null> {
    if (this.caida) return null;
    try {
      const { data, error } = await this.supabase.functions.invoke('asistente', {
        body: {
          dia,
          tema: alerta.tema,
          objetivo,
          gravedad: alerta.gravedad,
          hechos: alerta.hechos,
          accion: alerta.accion.etiqueta,
        },
      });
      if (error) {
        this.caida = true;
        return null;
      }
      if (data?.estado !== 'listo') return null;
      const { titular, consejo } = data as TextoDeIa;
      if (typeof titular !== 'string' || typeof consejo !== 'string') return null;
      return textoDeIaValido(`${titular} ${consejo}`, alerta) ? { titular, consejo } : null;
    } catch {
      this.caida = true;
      return null;
    }
  }
}
