import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { AutoAnimar } from '../../shared/motion/auto-animar';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import {
  agruparCuentasPorTipo,
  disponible as disponibleTotal,
  reservado as reservadoTotal,
} from '../../core/domain';
import type { Cuenta, Movimiento, TipoCuenta } from '../../core/models';
import { HeaderActionService } from '../../layout/header-action.service';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { Amount } from '../../shared/amount/amount';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';
import { PageHead } from '../../shared/page-head/page-head';
import { AjustarSaldoForm } from './ajustar-saldo-form/ajustar-saldo-form';
import { BolsilloForm } from './bolsillo-form/bolsillo-form';
import { CuentaForm } from './cuenta-form/cuenta-form';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';

const ICONO_TIPO: Record<TipoCuenta, string> = {
  BANCO: 'account_balance',
  BILLETERA: 'wallet',
  EFECTIVO: 'payments',
  OTRO: 'category',
};

/**
 * Tab Cuentas: disponible/reservado, cuentas agrupadas por tipo con
 * subtotal, bolsillos desplegables y acciones por cuenta (ver
 * `notas-app-finanzas.md`, "Tab Cuentas"). Sin formularios de gasto/
 * ingreso: "Mover dinero" reutiliza el formulario de movimiento en modo
 * transferencia (ver `MovimientoForm`).
 */
@Component({
  selector: 'app-cuentas-page',
  imports: [
    PantallaVacia,
    MatIconModule,
    Amount,
    EmptyState,
    PageHead,
    SkeletonRows,
    AutoAnimar,
    AparicionEscalonada,
  ],
  templateUrl: './cuentas.page.html',
  styleUrl: './cuentas.page.scss',
})
export class CuentasPage {
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly dialog = inject(MatDialog);
  private readonly headerAction = inject(HeaderActionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  /** Si ya llegó lo que pinta la pantalla; mientras tanto, esqueletos (ver `primeraCarga`). */
  protected readonly listo = primeraCarga(this.cuentasApi.listar(), this.movimientosApi.listar());

  /** Sin ninguna cuenta: la pantalla muestra solo su presentación (ver `PantallaVacia`). */
  protected readonly sinDatos = computed(() => this.cuentas().length === 0);

  constructor() {
    // La misma acción que en escritorio ofrece `app-page-head`, que en
    // móvil no se dibuja: acá vive en el header, junto al botón de ocultar
    // montos (ver `Shell`).
    this.headerAction.establecer({
      icono: 'add',
      etiqueta: 'Agregar cuenta',
      accion: () => this.agregarCuenta(),
    });
    inject(DestroyRef).onDestroy(() => this.headerAction.limpiar());
  }

  protected readonly disponible = computed(() =>
    disponibleTotal(this.cuentas(), this.movimientos()),
  );
  protected readonly reservado = computed(() => reservadoTotal(this.cuentas(), this.movimientos()));
  private readonly grupos = computed(() =>
    agruparCuentasPorTipo(this.cuentas(), this.movimientos()),
  );

  /**
   * Solo los tipos de cuenta que tienen al menos una cuenta.
   * `agruparCuentasPorTipo` devuelve los cuatro tipos siempre (es lo
   * correcto para el dominio: el conjunto de tipos no depende de los
   * datos), pero pintar "Billetera digital · sin cuentas" a quien solo usa
   * efectivo es ruido que tapa lo que sí tiene. El filtro es de
   * presentación y por eso vive acá, no en `core/domain`.
   */
  protected readonly gruposConCuentas = computed(() =>
    this.grupos().filter((grupo) => grupo.cuentas.length > 0),
  );
  /**
   * Lo que hay en total repartido entre cuentas: disponible más reservado.
   * No es un dato nuevo — es la suma de los dos que ya se muestran — pero
   * como cifra que encabeza la pantalla responde antes la pregunta
   * "¿cuánto tengo?" que dos tarjetas que hay que sumar mentalmente.
   */
  protected readonly totalEnCuentas = computed(() => this.disponible() + this.reservado());

  /** Reparto del héroe, en porcentaje: los dos tramos de la barra. */
  protected readonly porcentajeDisponible = computed(() => this.porcentajeDe(this.disponible()));
  protected readonly porcentajeReservado = computed(() => this.porcentajeDe(this.reservado()));

  /**
   * Dónde está el dinero, por tipo de cuenta. Reusa el subtotal que ya trae
   * cada grupo; el porcentaje es solo ese subtotal contra el total.
   */
  protected readonly reparto = computed(() =>
    this.gruposConCuentas().map((grupo) => {
      const porcentaje = this.porcentajeDe(grupo.subtotal);
      return {
        etiqueta: grupo.etiqueta,
        subtotal: grupo.subtotal,
        porcentaje,
        // Un decimal solo por debajo del 10%: "0,5%" dice algo, "88,5%" no
        // más que "88%" y alarga la línea.
        porcentajeTexto: `${porcentaje.toFixed(porcentaje < 10 ? 1 : 0)}%`,
      };
    }),
  );

  private porcentajeDe(valor: number): number {
    const total = this.totalEnCuentas();
    return total > 0 ? (valor / total) * 100 : 0;
  }

  protected readonly totalCuentasActivas = computed(
    () => this.cuentas().filter((c) => c.cuentaPadreId === null && !c.archivada).length,
  );
  private readonly totalBolsillos = computed(
    () => this.cuentas().filter((c) => c.cuentaPadreId !== null && !c.archivada).length,
  );
  /** "4 cuentas activas · 2 bolsillos" — los bolsillos solo si hay. */
  protected readonly detalleCuentas = computed(() => {
    // Mientras carga, sin conteo: un "0" se leería como dato real.
    if (!this.listo()) return '';
    const cuentas = `${this.totalCuentasActivas()} cuentas activas`;
    const bolsillos = this.totalBolsillos();
    return bolsillos > 0 ? `${cuentas} · ${bolsillos} bolsillos` : cuentas;
  });

  private readonly expandidas = signal<ReadonlySet<string>>(new Set());

  protected iconoTipo(tipo: TipoCuenta): string {
    return ICONO_TIPO[tipo];
  }

  protected expandida(cuentaId: string): boolean {
    return this.expandidas().has(cuentaId);
  }

  protected alternarExpandida(cuentaId: string): void {
    this.expandidas.update((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(cuentaId)) siguiente.delete(cuentaId);
      else siguiente.add(cuentaId);
      return siguiente;
    });
  }

  // Sin `maxWidth`: Angular Material ya lo acota solo por debajo de 599px
  // (`calc(100vw - 32px)`, ver su CSS de `.mat-mdc-dialog-panel`) — un
  // `maxWidth` propio en el config se aplica como estilo inline y le
  // gana a esa regla, y `90vw` da menos margen que el que Material ya
  // trae por defecto. `maxHeight: '90vh'` sí hace falta: sin un tope
  // numérico, un diálogo más alto que la pantalla (típico con el teclado
  // abierto en el celular) no scrollea solo, se desborda sin forma de
  // llegar al botón de guardar.
  protected agregarCuenta(): void {
    this.dialog.open(CuentaForm, { width: '480px', maxHeight: '90vh', data: {} });
  }

  protected editar(cuenta: Cuenta): void {
    this.dialog.open(CuentaForm, { width: '480px', maxHeight: '90vh', data: { cuenta } });
  }

  protected agregarBolsillo(cuentaPadre: Cuenta): void {
    this.dialog.open(BolsilloForm, { width: '420px', maxHeight: '90vh', data: { cuentaPadre } });
  }

  protected ajustarSaldo(cuentaRaiz: Cuenta): void {
    const bolsillos = this.cuentas().filter(
      (c) => c.cuentaPadreId === cuentaRaiz.id && !c.archivada,
    );
    this.dialog.open(AjustarSaldoForm, {
      width: '420px',
      maxHeight: '90vh',
      data: { cuentaRaiz, bolsillos },
    });
  }

  protected moverDinero(cuenta: Cuenta): void {
    this.nuevoMovimiento.abrir({ tipo: 'transferencia', cuentaOrigenId: cuenta.id });
  }

  protected archivar(cuenta: Cuenta): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: 'Archivar cuenta',
          mensaje: `${cuenta.nombre} deja de verse en Cuentas, pero su historial de movimientos se conserva.`,
          textoConfirmar: 'Archivar',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.cuentasApi.archivar(cuenta.id).subscribe(() => {
          this.snackBar.open('Cuenta archivada', undefined, { duration: 3000 });
        });
      });
  }
}
