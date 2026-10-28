import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { BienvenidaService, PARAM_GUIA } from './bienvenida.service';
import { PASOS_BIENVENIDA, type PasoBienvenida } from './pasos-bienvenida';

/**
 * Franja guía del recorrido de bienvenida, arriba de la pantalla a la que
 * lleva un paso del checklist (`?guia=<id>` en la URL). Convierte el
 * checklist en un recorrido: dice en qué paso va la persona y qué hacer
 * en esta pantalla; si el paso se puede saltar, la decisión se toma acá,
 * viendo la pantalla; y en cuanto el paso se cumple, ofrece el siguiente.
 *
 * Vive en el `Shell`, sobre el `router-outlet`, para no repetirla en cada
 * pantalla. Salir a otra sección por el menú quita el parámetro y, con
 * él, la franja: el recorrido nunca encierra a nadie.
 */
@Component({
  selector: 'app-guia-paso',
  imports: [MatIconModule, RouterLink],
  templateUrl: './guia-paso.html',
  styleUrl: './guia-paso.scss',
})
export class GuiaPaso {
  protected readonly bienvenida = inject(BienvenidaService);
  private readonly router = inject(Router);

  private readonly guiaId = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get(PARAM_GUIA))),
    { initialValue: null },
  );

  protected readonly paso = computed(() => {
    const id = this.guiaId();
    return (id && PASOS_BIENVENIDA.find((p) => p.id === id)) || null;
  });

  /** "Paso 2 de 5", contando solo los pasos que aplican en su bloque. */
  protected readonly posicion = computed(() => {
    const paso = this.paso();
    if (!paso) return '';
    const contexto = this.bienvenida.contexto();
    const delBloque = PASOS_BIENVENIDA.filter(
      (p) => p.bloque === paso.bloque && (p.aplica?.(contexto) ?? true),
    );
    return `Paso ${delBloque.indexOf(paso) + 1} de ${delBloque.length}`;
  });

  protected readonly resuelto = computed(() => {
    const paso = this.paso();
    return !!paso && this.bienvenida.resuelto(paso);
  });

  protected readonly siguiente = computed(() =>
    this.resuelto() ? this.bienvenida.siguientePendiente() : null,
  );

  protected omitir(paso: PasoBienvenida): void {
    this.bienvenida.omitir(paso);
  }

  protected irA(paso: PasoBienvenida): void {
    this.bienvenida.irA(paso);
    // El "+" no cambia de pantalla: sin esto, la franja del paso anterior
    // quedaría abierta detrás del formulario.
    if (paso.destino === 'nuevo-movimiento') this.cerrar();
  }

  protected cerrar(): void {
    void this.router.navigate([], {
      queryParams: { [PARAM_GUIA]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
