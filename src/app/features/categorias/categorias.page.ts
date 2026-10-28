import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import type { Categoria, TipoCategoria } from '../../core/models';
import { Amount } from '../../shared/amount/amount';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { PageHead } from '../../shared/page-head/page-head';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';
import { CategoriaForm, type CategoriaFormData } from './categoria-form/categoria-form';

interface GrupoCategorias {
  tipo: TipoCategoria;
  titulo: string;
  activas: Categoria[];
  ocultas: Categoria[];
}

/**
 * Categorías: renombrar, cambiar el ícono u ocultar las del catálogo, y
 * crear las propias. Vive en el bloque "Cuenta" del menú y no como tab:
 * se visita pocas veces, no a diario.
 *
 * "Ocultar" en vez de "Eliminar": los movimientos viejos siguen apuntando a
 * la categoría y necesitan su nombre; oculta, solo deja de ofrecerse en
 * los formularios. Se puede volver a mostrar.
 */
@Component({
  selector: 'app-categorias-page',
  imports: [MatIconModule, Amount, PageHead, SkeletonRows],
  templateUrl: './categorias.page.html',
  styleUrl: './categorias.page.scss',
})
export class CategoriasPage {
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });
  protected readonly listo = primeraCarga(this.categoriasApi.listar());

  protected readonly grupos = computed<GrupoCategorias[]>(() =>
    (
      [
        ['GASTO', 'Gastos'],
        ['INGRESO', 'Ingresos'],
      ] as const
    ).map(([tipo, titulo]) => {
      const delTipo = this.categorias().filter((c) => c.tipo === tipo);
      return {
        tipo,
        titulo,
        activas: delTipo.filter((c) => !c.archivada),
        ocultas: delTipo.filter((c) => c.archivada),
      };
    }),
  );

  protected readonly detalle = computed(() => {
    const propias = this.categorias().filter((c) => c.personalizada).length;
    if (propias === 0) return 'Ajusta las categorías a tu forma de gastar';
    return propias === 1 ? '1 creada por ti' : `${propias} creadas por ti`;
  });

  protected nueva(tipo?: TipoCategoria): void {
    this.abrirForm({ tipo });
  }

  protected editar(categoria: Categoria): void {
    this.abrirForm({ categoria });
  }

  protected alternarOculta(categoria: Categoria): void {
    const archivada = !categoria.archivada;
    this.categoriasApi.actualizar(categoria.id, { archivada }).subscribe({
      next: () =>
        this.snackBar.open(
          archivada
            ? `"${categoria.nombre}" ya no aparece al registrar`
            : `"${categoria.nombre}" vuelve a aparecer`,
          undefined,
          { duration: 3000 },
        ),
      error: () =>
        this.snackBar.open('No se pudo guardar. Intenta de nuevo.', undefined, { duration: 4000 }),
    });
  }

  private abrirForm(data: CategoriaFormData): void {
    this.dialog.open(CategoriaForm, { width: '480px', maxHeight: '90vh', data });
  }
}
