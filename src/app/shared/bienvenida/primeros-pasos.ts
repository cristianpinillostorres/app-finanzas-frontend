import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { BienvenidaService } from './bienvenida.service';

const TEXTOS = {
  esencial: {
    titulo: 'Primeros pasos',
    intro: (pasos: number) =>
      `Arma tu foto financiera en ${pasos} pasos y sabrás cuánto te queda libre de verdad.`,
  },
  extra: {
    titulo: 'Sácale más provecho',
    intro: () =>
      'Ya tienes lo básico. Esto es lo que la app puede hacer además de llevar la cuenta.',
  },
} as const;

/**
 * Checklist de bienvenida en General: el mapa del recorrido. Cada paso
 * lleva a su pantalla, donde la franja guía (`GuiaPaso`) explica qué hacer
 * y, si el paso se puede saltar, ofrece hacerlo — esa decisión se toma
 * viendo la pantalla, no desde acá. Qué pasos hay y cuándo se marcan vive
 * en `PASOS_BIENVENIDA`; el estado, en `BienvenidaService`.
 */
@Component({
  selector: 'app-primeros-pasos',
  imports: [MatIconModule],
  templateUrl: './primeros-pasos.html',
  styleUrl: './primeros-pasos.scss',
})
export class PrimerosPasos {
  protected readonly bienvenida = inject(BienvenidaService);

  protected readonly estado = computed(() =>
    this.bienvenida.oculto() ? null : this.bienvenida.estado(),
  );
  protected readonly textos = computed(() => TEXTOS[this.estado()?.bloque ?? 'esencial']);
}
