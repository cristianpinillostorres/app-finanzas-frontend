import { Component, input } from '@angular/core';

/**
 * Cortina que bloquea toda la interacción mientras se guarda (incluido el
 * botón de cerrar): `position: fixed`, cubre la pantalla completa sin
 * depender de que quien la use tenga un ancestro con `position: relative`
 * (frágil combinado con el `display: contents` del host, ver
 * `guardando-overlay.scss`). Mismo componente para escritorio y móvil: los
 * formularios se abren en `MatDialog` o `MatBottomSheet` según el tamaño
 * de pantalla, pero es la misma plantilla en los dos casos.
 */
@Component({
  selector: 'app-guardando-overlay',
  templateUrl: './guardando-overlay.html',
  styleUrl: './guardando-overlay.scss',
})
export class GuardandoOverlay {
  visible = input.required<boolean>();
}
