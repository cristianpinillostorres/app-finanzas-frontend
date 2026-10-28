import { Injectable, signal, TemplateRef } from '@angular/core';

/**
 * Los botones globales de escritorio (ocultar montos y la cuenta),
 * declarados en el `Shell` y dibujados por `PageHead` al final de la
 * tarjeta de título. Así título y botones comparten una sola
 * fila arriba del contenido, en vez de una barra para los botones y otra
 * franja para el título. La plantilla conserva el contexto del `Shell`, así
 * que sus enlaces y menús siguen funcionando igual.
 */
@Injectable({ providedIn: 'root' })
export class AccionesEscritorioService {
  private readonly _plantilla = signal<TemplateRef<unknown> | null>(null);
  readonly plantilla = this._plantilla.asReadonly();

  establecer(plantilla: TemplateRef<unknown> | null): void {
    this._plantilla.set(plantilla);
  }
}
