import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Observable } from 'rxjs';

import { CATEGORIAS_API } from '../../../core/api/categorias/categorias-api';
import { ICONOS_CATEGORIA } from '../../../core/api/categorias/categorias-catalogo';
import type { Categoria, TipoCategoria } from '../../../core/models';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

export interface CategoriaFormData {
  /** Sin categoría: crear una nueva. */
  categoria?: Categoria;
  /** Tipo con el que arranca una categoría nueva. */
  tipo?: TipoCategoria;
}

/**
 * Crear una categoría propia o editar cualquiera (también las del catálogo
 * base: renombrar "Mercado" a "Supermercado" es de lo primero que alguien
 * quiere). El tipo solo se elige al crear: cambiarlo después dejaría
 * gastos viejos en una categoría de ingresos.
 */
@Component({
  selector: 'app-categoria-form',
  imports: [HojaCabecera, ReactiveFormsModule, MatIconModule, MatButtonModule],
  templateUrl: './categoria-form.html',
  styleUrl: './categoria-form.scss',
})
export class CategoriaForm {
  private readonly fb = inject(FormBuilder);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<CategoriaForm>);
  private readonly datos = inject<CategoriaFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly editandoCategoria = this.datos?.categoria;

  protected readonly editando = this.editandoCategoria !== undefined;
  protected readonly guardando = signal(false);
  protected readonly iconos = ICONOS_CATEGORIA;

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control(this.editandoCategoria?.nombre ?? '', [
      Validators.required,
      Validators.maxLength(40),
    ]),
    tipo: this.fb.nonNullable.control<TipoCategoria>(
      this.editandoCategoria?.tipo ?? this.datos?.tipo ?? 'GASTO',
    ),
    icono: this.fb.nonNullable.control(this.editandoCategoria?.icono ?? 'sell'),
    /** Presupuesto mensual; vacío es "sin tope". Solo se pide en las de gasto. */
    topeMensual: this.fb.control<number | null>(
      this.editandoCategoria?.topeMensual ?? null,
      Validators.min(0),
    ),
  });

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected elegirIcono(icono: string): void {
    this.form.controls.icono.setValue(icono);
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const v = this.form.getRawValue();
    const nombre = v.nombre.trim();
    // 0 o vacío: sin tope. Un tope en una de ingreso no tiene sentido.
    const topeMensual = v.tipo === 'GASTO' && v.topeMensual ? v.topeMensual : null;
    const guardar$: Observable<unknown> = this.editandoCategoria
      ? this.categoriasApi.actualizar(this.editandoCategoria.id, {
          nombre,
          icono: v.icono,
          topeMensual,
        })
      : this.categoriasApi.crear({ nombre, tipo: v.tipo, icono: v.icono, topeMensual });
    const mensaje = this.editando ? 'Cambios guardados' : 'Categoría creada';

    guardarConFeedback(this.snackBar, this.guardando, guardar$, mensaje, () =>
      this.dialogRef.close(true),
    );
  }
}
