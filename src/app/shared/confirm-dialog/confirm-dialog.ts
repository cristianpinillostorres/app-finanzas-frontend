import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import type { ConfirmDialogData } from './confirm-dialog-data';

/**
 * Confirmación genérica (ej. "Archivar cuenta"). Se abre con
 * `MatDialog.open(ConfirmDialog, { data: {...} })` y devuelve `true`/`false`
 * según el botón que se pulse.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected readonly datos = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialog, boolean>);

  protected confirmar(): void {
    this.dialogRef.close(true);
  }

  protected cancelar(): void {
    this.dialogRef.close(false);
  }
}
