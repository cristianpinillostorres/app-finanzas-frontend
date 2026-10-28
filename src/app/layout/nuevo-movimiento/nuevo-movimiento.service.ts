import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';

import type { MovimientoFormData } from '../../movimiento-form/movimiento-form-data';
import { MovimientoForm } from '../../movimiento-form/movimiento-form';
import { ViewportService } from '../services/viewport.service';

/**
 * Abre el formulario de movimiento: `MatDialog` en escritorio,
 * `MatBottomSheet` en móvil. Un solo punto de entrada para el botón "+" de
 * todas las tabs, el atajo "Agregar compra" de tarjetas y plataformas, el
 * botón "Pagar" de un pago fijo, y "Editar" desde Movimientos.
 */
@Injectable({ providedIn: 'root' })
export class NuevoMovimientoService {
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly viewport = inject(ViewportService);

  /**
   * `disableClose`: tocar fuera ya no descarta lo escrito. El formulario
   * decide — cierra si no se tocó nada, y la X y Escape cierran siempre
   * (ver el constructor de `MovimientoForm`).
   *
   * El foco arranca en el monto, no en "Cancelar": es lo primero que se
   * escribe, y en el celular abre de una el teclado numérico.
   */
  abrir(datos: MovimientoFormData = {}): void {
    if (this.viewport.esMovil()) {
      this.bottomSheet.open(MovimientoForm, {
        data: datos,
        disableClose: true,
        autoFocus: '#m-monto',
        panelClass: 'hoja-movimiento',
      });
    } else {
      this.dialog.open(MovimientoForm, {
        width: '520px',
        maxHeight: '90vh',
        data: datos,
        disableClose: true,
        autoFocus: '#m-monto',
        panelClass: 'hoja-movimiento',
      });
    }
  }
}
