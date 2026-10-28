import { Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  FILTROS_MOVIMIENTOS_DEFECTO,
  type FiltroFecha,
  type FiltroTipoMovimiento,
  type FiltrosMovimientos,
  type OpcionMovimiento,
} from '../../../core/domain';
import type { Categoria } from '../../../core/models';

export interface MovimientosFiltrosSheetData {
  filtros: FiltrosMovimientos;
  opcionesCuentaOCredito: OpcionMovimiento[];
  /** Ya acotadas a las que tienen movimientos en el mes seleccionado. */
  categorias: Categoria[];
  /** Bordes del mes seleccionado ("YYYY-MM-DD"), min/max del campo "Rango". */
  minFecha: string;
  maxFecha: string;
}

/**
 * Hoja "Filtros" de Movimientos (móvil) — handoff de diseño 2026-09-21.
 * Estado en borrador: los cambios solo se escriben en los filtros reales de
 * la página con "Aplicar" (`dismiss(draft)`); la X y el fondo descartan
 * (`dismiss()` sin argumento, comportamiento por defecto de
 * `MatBottomSheet`). "Limpiar" reinicia el borrador pero no cierra la hoja
 * ni toca `texto` — el buscador no es parte de esta hoja.
 */
@Component({
  selector: 'app-movimientos-filtros-sheet',
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './movimientos-filtros-sheet.html',
  styleUrl: './movimientos-filtros-sheet.scss',
})
export class MovimientosFiltrosSheet {
  private readonly sheetRef = inject(
    MatBottomSheetRef<MovimientosFiltrosSheet, FiltrosMovimientos>,
  );
  protected readonly data = inject<MovimientosFiltrosSheetData>(MAT_BOTTOM_SHEET_DATA);

  protected readonly draft = signal<FiltrosMovimientos>({ ...this.data.filtros });

  protected fijarTipo(tipo: FiltroTipoMovimiento): void {
    this.draft.update((f) => ({ ...f, tipo }));
  }

  protected fijarFecha(fecha: FiltroFecha): void {
    this.draft.update((f) => ({
      ...f,
      fecha,
      desde: fecha === 'rango' ? (f.desde ?? this.data.minFecha) : null,
      hasta: fecha === 'rango' ? (f.hasta ?? this.data.maxFecha) : null,
    }));
  }

  protected fijarDesde(valor: string): void {
    this.draft.update((f) => ({ ...f, desde: valor }));
  }

  protected fijarHasta(valor: string): void {
    this.draft.update((f) => ({ ...f, hasta: valor }));
  }

  protected fijarCuentaOCredito(id: string | null): void {
    this.draft.update((f) => ({ ...f, cuentaOCreditoId: id }));
  }

  protected fijarCategoria(id: string | null): void {
    this.draft.update((f) => ({ ...f, categoriaId: id }));
  }

  protected fijarInternos(valor: boolean): void {
    this.draft.update((f) => ({ ...f, mostrarInternos: valor }));
  }

  protected limpiar(): void {
    this.draft.set({ ...FILTROS_MOVIMIENTOS_DEFECTO, texto: this.data.filtros.texto });
  }

  protected aplicar(): void {
    this.sheetRef.dismiss(this.draft());
  }

  protected cerrar(): void {
    this.sheetRef.dismiss();
  }
}
