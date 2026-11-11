import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CATEGORIAS_API } from '../../../core/api/categorias/categorias-api';
import type { Categoria } from '../../../core/models';
import { MontoInput } from '../../../shared/forms/monto-input';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

/**
 * Ajustar de un tirón los topes de las categorías que ya tienen uno, sin ir
 * a Categorías (donde salen todas, también las que no tienen presupuesto).
 * Aquí no se agregan ni se quitan topes: eso se hace en cada categoría.
 */
@Component({
  selector: 'app-topes-presupuesto',
  imports: [HojaCabecera, FormsModule, MontoInput],
  templateUrl: './topes-presupuesto.html',
  styleUrl: './topes-presupuesto.scss',
})
export class TopesPresupuesto {
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<TopesPresupuesto, boolean>);
  /** Topes que propone el asistente, por categoría; sin él, los actuales. Nada se guarda sin pulsar "Guardar". */
  private readonly sugeridos =
    inject<{ topes?: Record<string, number> } | null>(MAT_DIALOG_DATA, { optional: true })?.topes ??
    {};
  protected readonly haySugerencia = Object.keys(this.sugeridos).length > 0;

  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });

  /** Las de gasto que ya tienen tope, en el orden del catálogo. */
  protected readonly conTope = computed(() =>
    this.categorias().filter((c) => c.tipo === 'GASTO' && !c.archivada && (c.topeMensual ?? 0) > 0),
  );

  /** Lo que se está escribiendo en cada fila; arranca con el tope actual. */
  protected readonly valores = linkedSignal<Record<string, number | null>>(() =>
    Object.fromEntries(this.conTope().map((c) => [c.id, this.sugeridos[c.id] ?? c.topeMensual])),
  );

  protected readonly guardando = signal(false);

  private readonly cambios = computed(() =>
    this.conTope().filter((c) => this.valores()[c.id] !== c.topeMensual),
  );

  /** Todas las filas necesitan un monto mayor que cero. */
  protected readonly invalido = computed(() =>
    this.conTope().some((c) => {
      const valor = this.valores()[c.id];
      return valor === null || valor === undefined || !(valor > 0);
    }),
  );

  protected escribir(id: string, monto: number | null): void {
    this.valores.update((v) => ({ ...v, [id]: monto }));
  }

  protected cerrar(): void {
    this.dialogRef.close(false);
  }

  protected verCategorias(): void {
    this.dialogRef.close(false);
    void this.router.navigateByUrl('/categorias');
  }

  protected guardar(): void {
    if (this.invalido() || this.guardando()) return;
    const cambiadas = this.cambios();
    if (cambiadas.length === 0) {
      this.dialogRef.close(false);
      return;
    }
    const guardados$ = forkJoin(
      cambiadas.map((c) =>
        this.categoriasApi.actualizar(c.id, { topeMensual: Math.round(this.valores()[c.id]!) }),
      ),
    );
    guardarConFeedback(this.snackBar, this.guardando, guardados$, 'Guardado', () =>
      this.dialogRef.close(true),
    );
  }
}
