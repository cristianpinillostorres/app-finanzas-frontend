import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { AutoAnimar } from '../../shared/motion/auto-animar';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { cambiosTasaDeBancos } from '../../core/api/creditos/cambios-tasa.util';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import {
  agruparPagosFijosDelMes,
  anioMesDe,
  fechaIsoDesdeLocal,
  lineaDelMes,
  primerDiaDelMes,
  sumarMesesAnioMes,
  type AnioMes,
  type ItemPagoFijoMes,
} from '../../core/domain';
import type {
  CompraCuotas,
  Credito,
  Cuenta,
  ExtractoTarjeta,
  Movimiento,
  PagoFijo,
} from '../../core/models';
import { PREFERENCIAS_INICIALES } from '../../core/models';
import { HeaderActionService } from '../../layout/header-action.service';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { Amount } from '../../shared/amount/amount';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import type { ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog-data';
import { mostrarErrorGuardado } from '../../shared/guardado/guardado.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';
import { PageHead } from '../../shared/page-head/page-head';
import {
  formatearDiaMes,
  formatearMesAnioCapitalizado,
  formatearNombreMes,
} from '../../shared/format/fecha';
import { textoVencimiento } from '../../shared/format/texto-vencimiento';
import { MonthSelector } from '../../shared/month-selector/month-selector';
import { SemaforoBadge } from '../../shared/semaforo-badge/semaforo-badge';
import { PagoFijoForm } from './pago-fijo-form/pago-fijo-form';
import type { PagoFijoFormData } from './pago-fijo-form/pago-fijo-form-data';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';

/**
 * Tab Pagos fijos: cuánto se va al mes sí o sí y qué falta por pagar (ver
 * `notas-app-finanzas.md`, "Tab Pagos fijos"). Junta los pagos fijos propios
 * con las cuotas de créditos con cuota mensual (`agruparPagosFijosDelMes`).
 * Sin formulario propio para pagar: "Pagar" reutiliza el formulario de
 * movimiento (gasto para un pago propio, transferencia para una cuota de
 * crédito), igual que "Agregar compra"/"Registrar abono" en Créditos.
 *
 * Tocar un pago fijo propio despliega su detalle con Editar, "Ya lo pagué"
 * y Eliminar. Las cuotas de crédito no se despliegan: se corrigen desde
 * Créditos, que es donde vive el crédito.
 */
@Component({
  selector: 'app-pagos-fijos-page',
  imports: [
    PantallaVacia,
    NgTemplateOutlet,
    MatIconModule,
    Amount,
    EmptyState,
    MonthSelector,
    SemaforoBadge,
    PageHead,
    SkeletonRows,
    AutoAnimar,
    AparicionEscalonada,
  ],
  templateUrl: './pagos-fijos.page.html',
  styleUrl: './pagos-fijos.page.scss',
})
export class PagosFijosPage {
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly headerAction = inject(HeaderActionService);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);

  private readonly pagosFijos = toSignal(this.pagosFijosApi.listar(), {
    initialValue: [] as PagoFijo[],
  });
  private readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  private readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  /** Si ya llegó lo que pinta la pantalla; mientras tanto, esqueletos (ver `primeraCarga`). */
  protected readonly listo = primeraCarga(
    this.pagosFijosApi.listar(),
    this.creditosApi.listar(),
    this.comprasApi.listar(),
    this.movimientosApi.listar(),
    this.cuentasApi.listar(),
  );

  /**
   * Sin pagos fijos ni créditos (sus cuotas también se listan acá): la
   * pantalla muestra solo su presentación (ver `PantallaVacia`).
   */
  protected readonly sinDatos = computed(
    () => this.pagosFijos().length === 0 && this.creditos().length === 0,
  );

  // Extractos por tarjeta, igual patrón reactivo que Créditos (fase 5): no
  // dependen del mes que se esté viendo, solo del set de tarjetas.
  private readonly tarjetas = computed(() => this.creditos().filter((c) => c.grupo === 'TARJETA'));
  private readonly extractos = toSignal(
    toObservable(this.tarjetas).pipe(
      switchMap((tarjetas) =>
        tarjetas.length === 0
          ? of([] as ExtractoTarjeta[])
          : combineLatest(tarjetas.map((t) => this.creditosApi.listarExtractos(t.id))).pipe(
              map((porTarjeta) => porTarjeta.flat()),
            ),
      ),
    ),
    { initialValue: [] as ExtractoTarjeta[] },
  );

  constructor() {
    // La misma acción que en escritorio ofrece `app-page-head`, que en
    // móvil no se dibuja: acá vive en el header, junto al botón de ocultar
    // montos (ver `Shell`).
    this.headerAction.establecer({
      icono: 'add',
      etiqueta: 'Nuevo pago fijo',
      accion: () => this.agregarPagoFijo(),
    });
    inject(DestroyRef).onDestroy(() => this.headerAction.limpiar());
  }

  protected readonly mesSeleccionado = signal<AnioMes>(anioMesDe(new Date()));
  protected readonly etiquetaMes = computed(() =>
    formatearMesAnioCapitalizado(primerDiaDelMes(this.mesSeleccionado())),
  );
  /** "octubre", para el rótulo de la tarjeta: en el celular el selector queda debajo. */
  protected readonly nombreMes = computed(() =>
    formatearNombreMes(primerDiaDelMes(this.mesSeleccionado())),
  );

  /** Pagos del mes, pagados y no: el denominador de "X de Y pagados". */
  protected readonly totalPagos = computed(
    () => this.resumen().pagados.length + this.resumen().porPagar.length,
  );
  protected readonly detallePagos = computed(() => {
    // Mientras carga, sin conteo: un "0" se leería como dato real.
    if (!this.listo()) return '';
    const total = this.totalPagos();
    if (total === 0) return 'No tienes pagos este mes';
    return `Tienes ${total} ${total === 1 ? 'pago' : 'pagos'} este mes`;
  });

  // Sin esto, la cuota de un banco con tasa variable se calcula con la tasa
  // base del crédito (`tasaEaVigente` cae ahí en silencio) y sale distinta
  // de la que muestra Créditos — arrastrando el error hasta "Falta por
  // pagar". Esta pantalla no edita tasas, así que no necesita refresco.
  private readonly cambiosTasa = cambiosTasaDeBancos(this.creditos);

  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  protected readonly resumen = computed(() =>
    agruparPagosFijosDelMes(
      this.pagosFijos(),
      {
        creditos: this.creditos(),
        compras: this.compras(),
        extractos: this.extractos(),
        movimientos: this.movimientos(),
        cambiosTasa: this.cambiosTasa(),
        umbrales: this.preferencias().avisos,
      },
      this.mesSeleccionado(),
    ),
  );

  protected mesAnterior(): void {
    this.mesSeleccionado.update((mes) => sumarMesesAnioMes(mes, -1));
  }

  protected mesSiguiente(): void {
    this.mesSeleccionado.update((mes) => sumarMesesAnioMes(mes, 1));
  }

  /** Cuántos pagos del mes ya vencieron sin pagarse. */
  protected readonly vencidos = computed(
    () => this.resumen().porPagar.filter((i) => i.estado === 'rojo').length,
  );

  /** Los pagos del mes colgados de su día de vencimiento, con hoy marcado. */
  protected readonly linea = computed(() => lineaDelMes(this.resumen()));

  /** Mes abreviado en mayúsculas para el sello del día: "OCT". */
  protected mesCorto(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase();
  }

  /** "15 de octubre": la marca de hoy y el nombre del día para lectores de pantalla. */
  protected fechaLarga(fecha: Date): string {
    return formatearDiaMes(fechaIsoDesdeLocal(fecha));
  }

  protected textoDe(item: ItemPagoFijoMes): string {
    return textoVencimiento(item.fechaLimite, item.pagado);
  }

  protected agregarPagoFijo(): void {
    this.dialog.open(PagoFijoForm, {
      width: '480px',
      maxHeight: '90vh',
      data: {} satisfies PagoFijoFormData,
    });
  }

  private readonly expandidos = signal<ReadonlySet<string>>(new Set());

  protected expandido(id: string): boolean {
    return this.expandidos().has(id);
  }

  protected alternarExpandido(id: string): void {
    this.expandidos.update((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  private pagoFijoDe(item: ItemPagoFijoMes): PagoFijo | undefined {
    return this.pagosFijos().find((p) => p.id === item.pagoFijoId);
  }

  /** "El día 5 de cada mes", "El día 20, cada 2 meses", "El 15 de marzo, cada año". */
  protected cuandoSePaga(item: ItemPagoFijoMes): string {
    const pago = this.pagoFijoDe(item);
    if (!pago) return '';
    switch (pago.frecuencia) {
      case 'MENSUAL':
        return `El día ${pago.diaLimite} de cada mes`;
      case 'BIMESTRAL':
        return `El día ${pago.diaLimite}, cada 2 meses`;
      case 'ANUAL': {
        const mes = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(
          new Date(2024, pago.mesInicio - 1, 1),
        );
        return `El ${pago.diaLimite} de ${mes}, cada año`;
      }
    }
  }

  protected cuentaDe(item: ItemPagoFijoMes): string {
    return this.cuentas().find((c) => c.id === item.cuentaDefaultId)?.nombre ?? '';
  }

  protected editar(item: ItemPagoFijoMes): void {
    const pagoFijo = this.pagoFijoDe(item);
    if (!pagoFijo) return;
    this.dialog.open(PagoFijoForm, {
      width: '480px',
      maxHeight: '90vh',
      data: { pagoFijo } satisfies PagoFijoFormData,
    });
  }

  /**
   * "Ya lo pagué": para quien empieza a usar la app con pagos del mes que
   * ya hizo. Registrarlos con "Pagar" los contaría dos veces — el saldo
   * inicial de la cuenta ya los descuenta —, así que solo se marca el
   * periodo. Se puede deshacer desde el aviso o con "Desmarcar".
   */
  protected marcarPagado(item: ItemPagoFijoMes): void {
    this.cambiarMarca(item, true);
  }

  protected desmarcar(item: ItemPagoFijoMes): void {
    this.cambiarMarca(item, false);
  }

  private cambiarMarca(item: ItemPagoFijoMes, pagado: boolean): void {
    const pagoFijo = this.pagoFijoDe(item);
    if (!pagoFijo) return;
    const actuales = pagoFijo.periodosPagadosSinMovimiento ?? [];
    const periodos = pagado
      ? [...new Set([...actuales, item.periodo])]
      : actuales.filter((p) => p !== item.periodo);

    this.pagosFijosApi
      .actualizar(pagoFijo.id, { periodosPagadosSinMovimiento: periodos })
      .subscribe({
        next: () => {
          const mensaje = pagado
            ? `${item.nombre} marcado como pagado`
            : `${item.nombre} vuelve a estar por pagar`;
          this.snackBar
            .open(mensaje, 'Deshacer', { duration: 5000 })
            .onAction()
            .subscribe(() =>
              this.pagosFijosApi
                .actualizar(pagoFijo.id, { periodosPagadosSinMovimiento: actuales })
                .subscribe({ error: (error) => mostrarErrorGuardado(this.snackBar, error) }),
            );
        },
        error: (error) => mostrarErrorGuardado(this.snackBar, error),
      });
  }

  /**
   * Eliminar lo desactiva (`activo: false`) en vez de borrar el documento:
   * los movimientos que ya lo pagaron siguen apuntando a él, y el historial
   * de meses pasados no debe cambiar.
   */
  protected eliminar(item: ItemPagoFijoMes): void {
    const pagoFijo = this.pagoFijoDe(item);
    if (!pagoFijo) return;
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: `Eliminar ${pagoFijo.nombre}`,
          mensaje:
            'Deja de aparecer en tus pagos de cada mes. Los pagos que ya registraste no se borran.',
          textoConfirmar: 'Eliminar',
          peligro: true,
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.pagosFijosApi.actualizar(pagoFijo.id, { activo: false }).subscribe({
          next: () =>
            this.snackBar.open(`${pagoFijo.nombre} eliminado`, undefined, { duration: 3000 }),
          error: (error) => mostrarErrorGuardado(this.snackBar, error),
        });
      });
  }

  protected pagar(item: ItemPagoFijoMes): void {
    if (item.esCredito) {
      this.nuevoMovimiento.abrir({
        tipo: 'transferencia',
        cuentaDestinoId: item.creditoId,
        monto: item.monto,
        periodo: item.periodo,
        nombrePagoFijo: item.nombre,
      });
      return;
    }

    this.nuevoMovimiento.abrir({
      tipo: 'gasto',
      cuentaOrigenId: item.cuentaDefaultId,
      categoriaId: item.categoriaId,
      descripcion: item.nombre,
      monto: item.esEstimado ? undefined : item.monto,
      pagoFijoId: item.pagoFijoId,
      periodo: item.periodo,
      nombrePagoFijo: item.nombre,
    });
  }
}
