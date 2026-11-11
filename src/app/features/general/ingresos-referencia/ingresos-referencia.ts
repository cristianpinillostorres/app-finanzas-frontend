import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CATEGORIAS_API } from '../../../core/api/categorias/categorias-api';
import { MOVIMIENTOS_API } from '../../../core/api/movimientos/movimientos-api';
import { PREFERENCIAS_API } from '../../../core/api/preferencias/preferencias-api';
import { CATEGORIA_REEMBOLSO, ingresoMensualDeReferencia } from '../../../core/domain';
import { type Categoria, type Movimiento, PREFERENCIAS_INICIALES } from '../../../core/models';
import { Amount } from '../../../shared/amount/amount';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

/**
 * Qué ingresos cuentan para medir lo que se paga en cuotas: las categorías de
 * ingreso se prenden o apagan. De entrada cuentan todas menos los reembolsos
 * (plata que te devuelven, no plata que ganas). Mientras la lista sea esa,
 * se guarda `null`, así las categorías que se creen después cuentan solas.
 */
@Component({
  selector: 'app-ingresos-referencia',
  imports: [HojaCabecera, Amount],
  templateUrl: './ingresos-referencia.html',
  styleUrl: './ingresos-referencia.scss',
})
export class IngresosReferencia {
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<IngresosReferencia, boolean>);

  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  /** Las categorías de ingreso, incluida alguna archivada que ya esté elegida. */
  protected readonly opciones = computed(() => {
    const elegidas = this.preferencias().categoriasDeIngreso ?? [];
    return this.categorias().filter(
      (c) => c.tipo === 'INGRESO' && (!c.archivada || elegidas.includes(c.id)),
    );
  });

  private readonly porDefecto = computed(() =>
    this.opciones()
      .filter((c) => c.id !== CATEGORIA_REEMBOLSO)
      .map((c) => c.id),
  );

  /** Lo que está prendido ahora; arranca con lo guardado (o con "todas menos reembolsos"). */
  protected readonly seleccion = linkedSignal<string[]>(
    () => this.preferencias().categoriasDeIngreso ?? this.porDefecto(),
  );

  protected readonly hayReembolso = computed(() =>
    this.opciones().some((c) => c.id === CATEGORIA_REEMBOLSO),
  );

  /** Lo que daría con lo que está prendido, para ver el efecto antes de guardar. */
  protected readonly ingreso = computed(() =>
    ingresoMensualDeReferencia(this.movimientos(), this.seleccion(), new Date()),
  );

  protected activa(id: string): boolean {
    return this.seleccion().includes(id);
  }

  protected alternar(id: string, activa: boolean): void {
    this.seleccion.update((ids) => (activa ? [...ids, id] : ids.filter((i) => i !== id)));
  }

  protected cerrar(): void {
    this.dialogRef.close(false);
  }

  protected guardar(): void {
    const ids = this.seleccion();
    if (ids.length === 0) return;
    const base = this.porDefecto();
    const esPorDefecto = ids.length === base.length && base.every((id) => ids.includes(id));
    this.preferenciasApi.actualizar({ categoriasDeIngreso: esPorDefecto ? null : ids }).subscribe({
      next: () => {
        this.snackBar.open('Guardado', undefined, { duration: 2000 });
        this.dialogRef.close(true);
      },
      error: () =>
        this.snackBar.open('No se pudo guardar. Intenta de nuevo.', undefined, { duration: 4000 }),
    });
  }
}
