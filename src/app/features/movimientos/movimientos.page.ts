import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { AutoAnimar } from '../../shared/motion/auto-animar';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import {
  agruparMovimientosPorDia,
  anioMesDe,
  categoriasConMovimientos,
  contarFiltrosActivos,
  fechaIsoDesdeLocal,
  filtrarMovimientos,
  opcionesFiltroMovimientos,
  perteneceAlMes,
  primerDiaDelMes,
  resumenMovimientos,
  sumarMesesAnioMes,
  ultimoDiaDelMes,
  FILTROS_MOVIMIENTOS_DEFECTO,
  type AnioMes,
  type FiltrosMovimientos,
  type FiltroTipoMovimiento,
} from '../../core/domain';
import type {
  Categoria,
  CompraCuotas,
  Credito,
  Cuenta,
  Movimiento,
  PagoFijo,
  TipoMovimiento,
} from '../../core/models';
import { HeaderActionService } from '../../layout/header-action.service';
import { HeaderSearchService } from '../../layout/header-search.service';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { ViewportService } from '../../layout/services/viewport.service';
import { Amount } from '../../shared/amount/amount';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';
import {
  etiquetaDia,
  formatearFechaCompleta,
  formatearMesAnioCapitalizado,
  formatearNombreMes,
} from '../../shared/format/fecha';
import { claseIconoDeMovimiento, iconoDeMovimiento } from '../../shared/format/icono-categoria';
import { MonthSelector } from '../../shared/month-selector/month-selector';
import { PageHead } from '../../shared/page-head/page-head';
import { MovimientosFiltrosSheet } from './movimientos-filtros-sheet/movimientos-filtros-sheet';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';
import { Selector } from '../../shared/forms/selector';

const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  GASTO: 'Gasto',
  INGRESO: 'Ingreso',
  TRANSFERENCIA: 'Transferencia',
  INTERNO: 'Movimiento interno',
  AJUSTE: 'Ajuste de saldo',
};

/**
 * Tab Movimientos: historial completo, agrupado por día, con selector de
 * mes, resumen (ingresos/gastos/balance) y filtros (tipo, cuenta o crédito,
 * categoría, texto, mostrar internos) — ver `notas-app-finanzas.md`,
 * "Tab Movimientos". Cada fila se expande igual que en Cuentas/Créditos
 * (patrón `.stack`/`.detalle`) mostrando fecha completa, tipo y, si aplica,
 * el pago fijo de origen, con acciones Editar/Eliminar. "Editar" reutiliza
 * el formulario de movimiento en modo edición (`MovimientoFormData.movimiento`).
 */
@Component({
  selector: 'app-movimientos-page',
  imports: [
    Selector,
    PantallaVacia,
    MatIconModule,
    Amount,
    EmptyState,
    MonthSelector,
    PageHead,
    SkeletonRows,
    AutoAnimar,
    AparicionEscalonada,
  ],
  templateUrl: './movimientos.page.html',
  styleUrl: './movimientos.page.scss',
})
export class MovimientosPage {
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly snackBar = inject(MatSnackBar);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);
  private readonly headerAction = inject(HeaderActionService);
  private readonly headerSearch = inject(HeaderSearchService);
  protected readonly viewport = inject(ViewportService);

  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  protected readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });
  private readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  private readonly pagosFijos = toSignal(this.pagosFijosApi.listar(), {
    initialValue: [] as PagoFijo[],
  });
  /**
   * Si ya llegaron los movimientos y lo que da nombre a cada fila (cuentas
   * y créditos); mientras tanto, esqueletos (ver `primeraCarga`).
   */
  protected readonly listo = primeraCarga(
    this.movimientosApi.listar(),
    this.cuentasApi.listar(),
    this.creditosApi.listar(),
  );

  /** Sin ningún movimiento, en ningún mes: la pantalla muestra solo su presentación. */
  protected readonly sinDatos = computed(() => this.movimientos().length === 0);

  protected registrarMovimiento(): void {
    this.nuevoMovimiento.abrir();
  }

  protected readonly mesSeleccionado = signal<AnioMes>(anioMesDe(new Date()));
  protected readonly etiquetaMes = computed(() =>
    formatearMesAnioCapitalizado(primerDiaDelMes(this.mesSeleccionado())),
  );
  /** "octubre", para el rótulo de la tarjeta: en el celular el selector queda debajo. */
  protected readonly nombreMes = computed(() =>
    formatearNombreMes(primerDiaDelMes(this.mesSeleccionado())),
  );

  protected readonly primerDiaMesIso = computed(() =>
    fechaIsoDesdeLocal(primerDiaDelMes(this.mesSeleccionado())),
  );
  protected readonly ultimoDiaMesIso = computed(() => {
    const mes = this.mesSeleccionado();
    return fechaIsoDesdeLocal(new Date(mes.anio, mes.mes - 1, ultimoDiaDelMes(mes.anio, mes.mes)));
  });

  // `texto` vive fuera de `filtros`: en escritorio lo escribe el campo
  // propio de la página, en móvil la barra de búsqueda del header
  // (`HeaderSearchService`) — nunca los dos a la vez, según el viewport
  // activo (ver `textoBusqueda`). El resto de los grupos sí vive en
  // `filtros`, porque la hoja de filtros los actualiza todos de una vez
  // con "Aplicar".
  protected readonly filtros = signal<FiltrosMovimientos>({
    ...FILTROS_MOVIMIENTOS_DEFECTO,
    texto: '',
  });
  protected readonly textoEscritorio = signal('');
  protected readonly textoBusqueda = computed(() =>
    this.viewport.esMovil() ? this.headerSearch.termino() : this.textoEscritorio(),
  );

  protected readonly contadorFiltros = computed(() => contarFiltrosActivos(this.filtros()));

  /**
   * Panel de filtros avanzados en escritorio. Arranca cerrado: de los siete
   * controles que había siempre a la vista, solo el buscador y los chips de
   * tipo se usan a diario — el resto llenaba media pantalla antes de llegar
   * a la lista, que es lo que se vino a ver. En móvil no se usa: ahí el
   * mismo grupo de filtros vive en la hoja inferior (`abrirFiltros`).
   */
  protected readonly filtrosAbiertos = signal(false);

  protected readonly opcionesCuentaOCredito = computed(() =>
    opcionesFiltroMovimientos(this.cuentas(), this.creditos()),
  );

  private readonly movimientosDelMes = computed(() =>
    this.movimientos().filter((m) => perteneceAlMes(m.fecha, this.mesSeleccionado())),
  );

  protected readonly categoriasDisponibles = computed(() =>
    categoriasConMovimientos(this.categorias(), this.movimientosDelMes()),
  );

  protected readonly resumen = computed(() => resumenMovimientos(this.movimientosDelMes()));
  protected readonly detalleMovimientos = computed(() => {
    // Mientras carga, sin conteo: un "0" se leería como dato real.
    if (!this.listo()) return '';
    const total = this.movimientosDelMes().length;
    if (total === 0) return 'No has registrado movimientos este mes';
    return `Has realizado ${total} ${total === 1 ? 'movimiento' : 'movimientos'} este mes`;
  });

  protected readonly grupos = computed(() => {
    const filtrados = filtrarMovimientos(
      this.movimientosDelMes(),
      { ...this.filtros(), texto: this.textoBusqueda() },
      this.cuentas(),
      this.categorias(),
      new Date(),
    );
    return agruparMovimientosPorDia(filtrados);
  });

  private readonly expandidos = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.headerAction.establecer({
      icono: 'search',
      etiqueta: 'Buscar movimientos',
      accion: () => this.headerSearch.abrir(),
    });
    this.headerSearch.registrar('Buscar Movimientos');
    inject(DestroyRef).onDestroy(() => {
      this.headerAction.limpiar();
      this.headerSearch.limpiar();
    });
  }

  protected actualizarTextoEscritorio(valor: string): void {
    this.textoEscritorio.set(valor);
  }

  protected alternarFiltros(): void {
    this.filtrosAbiertos.update((abierto) => !abierto);
  }

  /** Igual que "Limpiar" de la hoja inferior: no toca el texto buscado. */
  protected limpiarFiltros(): void {
    this.filtros.update((f) => ({ ...FILTROS_MOVIMIENTOS_DEFECTO, texto: f.texto }));
  }

  protected abrirFiltros(): void {
    this.bottomSheet
      .open(MovimientosFiltrosSheet, {
        data: {
          filtros: this.filtros(),
          opcionesCuentaOCredito: this.opcionesCuentaOCredito(),
          categorias: this.categoriasDisponibles(),
          minFecha: this.primerDiaMesIso(),
          maxFecha: this.ultimoDiaMesIso(),
        },
      })
      .afterDismissed()
      .subscribe((resultado) => {
        if (resultado) this.filtros.set(resultado);
      });
  }

  protected actualizarDesde(valor: string): void {
    this.filtros.update((f) => ({ ...f, fecha: 'rango', desde: valor }));
  }

  protected actualizarHasta(valor: string): void {
    this.filtros.update((f) => ({ ...f, fecha: 'rango', hasta: valor }));
  }

  protected fijarTipo(tipo: FiltroTipoMovimiento): void {
    this.filtros.update((f) => ({ ...f, tipo }));
  }

  protected fijarCuentaOCredito(id: string | null): void {
    this.filtros.update((f) => ({ ...f, cuentaOCreditoId: id }));
  }

  protected fijarCategoria(id: string | null): void {
    this.filtros.update((f) => ({ ...f, categoriaId: id }));
  }

  protected fijarInternos(valor: boolean): void {
    this.filtros.update((f) => ({ ...f, mostrarInternos: valor }));
  }

  protected mesAnterior(): void {
    this.cambiarMes(sumarMesesAnioMes(this.mesSeleccionado(), -1));
  }

  protected mesSiguiente(): void {
    this.cambiarMes(sumarMesesAnioMes(this.mesSeleccionado(), 1));
  }

  /** Cambiar de mes reinicia fecha/búsqueda: "Hoy"/"Rango" de otro mes no
   * tiene sentido, y el buscador tampoco persiste al navegar (ver
   * `HeaderSearchService`). El resto de los filtros (tipo, cuenta,
   * categoría, internos) sí se conservan. */
  private cambiarMes(mes: AnioMes): void {
    this.mesSeleccionado.set(mes);
    this.filtros.update((f) => ({ ...f, fecha: 'todo-mes', desde: null, hasta: null }));
    this.textoEscritorio.set('');
    this.headerSearch.cerrar();
  }

  protected expandido(movimientoId: string): boolean {
    return this.expandidos().has(movimientoId);
  }

  protected alternarExpandido(movimientoId: string): void {
    this.expandidos.update((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(movimientoId)) siguiente.delete(movimientoId);
      else siguiente.add(movimientoId);
      return siguiente;
    });
  }

  /**
   * Saldo neto de un día: ingresos menos gastos, con la misma regla que el
   * resumen del mes — `resumenMovimientos` ya la implementa, así que se
   * reusa sobre los movimientos de ese día. Transferencias, internos y
   * ajustes no cuentan: mover plata entre cuentas propias no cambia el
   * saldo del día, y sumarlos daría un número que no significa nada.
   */
  protected totalDelDia(movimientos: Movimiento[]): number {
    return resumenMovimientos(movimientos).balance;
  }

  protected etiquetaDiaDe(fechaIso: string): string {
    return etiquetaDia(fechaIso);
  }

  protected fechaCompletaDe(movimiento: Movimiento): string {
    return formatearFechaCompleta(movimiento.fecha);
  }

  protected etiquetaTipoDe(movimiento: Movimiento): string {
    return ETIQUETA_TIPO[movimiento.tipo];
  }

  protected nombrePagoFijoDe(movimiento: Movimiento): string | null {
    if (!movimiento.pagoFijoId) return null;
    return this.pagosFijos().find((p) => p.id === movimiento.pagoFijoId)?.nombre ?? null;
  }

  protected signoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return '+';
    if (movimiento.tipo === 'GASTO') return '−';
    return '';
  }

  protected iconoDe(movimiento: Movimiento): string {
    return iconoDeMovimiento(movimiento.tipo, movimiento.categoriaId, this.categorias());
  }

  protected claseIconoDe(movimiento: Movimiento): string {
    return claseIconoDeMovimiento(movimiento.tipo);
  }

  protected claseMontoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return 'mon-in';
    if (movimiento.tipo === 'GASTO') return 'mon-out';
    if (movimiento.tipo === 'AJUSTE') return 'mon-aj';
    return 'mon-tr'; // TRANSFERENCIA e INTERNO comparten color (ver notas-app-finanzas.md).
  }

  /**
   * La línea de abajo sin repetir el título: un gasto sin descripción se
   * llama como su categoría, y una transferencia sin descripción se llama
   * "Transferencia"; decirlo dos veces en la misma fila era ruido.
   */
  protected metaTextoDe(movimiento: Movimiento): string {
    const partes = this.partesMetaDe(movimiento);
    const sinTitulo = partes[0] === movimiento.descripcion ? partes.slice(1) : partes;
    return sinTitulo.join(' · ');
  }

  private partesMetaDe(movimiento: Movimiento): string[] {
    const categoria = movimiento.categoriaId
      ? this.categorias().find((c) => c.id === movimiento.categoriaId)?.nombre
      : undefined;

    if (movimiento.tipo === 'GASTO') {
      const conCredito = movimiento.creditoOrigenId
        ? this.creditos().find((c) => c.id === movimiento.creditoOrigenId)?.nombre
        : undefined;
      const origen = conCredito ?? this.nombreCuenta(movimiento.cuentaOrigenId);
      const cuotas = this.compras().find((c) => c.movimientoId === movimiento.id)?.numCuotas;
      const partes = [categoria, origen];
      if (cuotas) partes.push(`${cuotas} cuotas`);
      return partes.filter((p): p is string => !!p);
    }

    if (movimiento.tipo === 'INGRESO') {
      return [categoria, this.nombreCuenta(movimiento.cuentaDestinoId)].filter(
        (p): p is string => !!p,
      );
    }

    if (movimiento.tipo === 'AJUSTE') {
      const cuenta = this.nombreCuenta(movimiento.cuentaDestinoId ?? movimiento.cuentaOrigenId);
      return ['Ajuste', cuenta].filter(Boolean);
    }

    // TRANSFERENCIA / INTERNO: "Transferencia · origen → destino".
    const origen = this.nombreCuenta(movimiento.cuentaOrigenId);
    const destino = movimiento.creditoDestinoId
      ? this.creditos().find((c) => c.id === movimiento.creditoDestinoId)?.nombre
      : this.nombreCuenta(movimiento.cuentaDestinoId);
    const etiquetaTipo = movimiento.tipo === 'INTERNO' ? 'Interno' : 'Transferencia';
    return [etiquetaTipo, `${origen} → ${destino}`];
  }

  private nombreCuenta(cuentaId: string | undefined): string {
    return this.cuentas().find((c) => c.id === cuentaId)?.nombre ?? '';
  }

  protected editar(movimiento: Movimiento): void {
    this.nuevoMovimiento.abrir({ movimiento });
  }

  protected eliminar(movimiento: Movimiento): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: 'Eliminar movimiento',
          mensaje:
            'Los saldos se recalculan. Si venía de un pago fijo o una cuota de crédito, vuelve a quedar pendiente.',
          textoConfirmar: 'Eliminar',
          peligro: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.eliminarDeVerdad(movimiento);
      });
  }

  private eliminarDeVerdad(movimiento: Movimiento): void {
    const compra = this.compras().find((c) => c.movimientoId === movimiento.id);
    this.movimientosApi.eliminar(movimiento.id).subscribe(() => {
      if (compra) {
        this.comprasApi.eliminar(compra.id).subscribe();
      }
      this.snackBar.open('Movimiento eliminado', undefined, { duration: 3000 });
    });
  }
}
