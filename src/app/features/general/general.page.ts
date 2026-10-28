import { Component, computed, effect, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { cambiosTasaDeBancos } from '../../core/api/creditos/cambios-tasa.util';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import {
  agruparCreditosPorTipo,
  agruparPagosFijosDelMes,
  anioMesDe,
  creditosConCuotasPendientes,
  disponible,
  gastosPorCategoriaDelMes,
  libreDelMes,
  lineaDelMes,
  perteneceAlMes,
  presupuestosDelMes,
  reservado,
  resumenMovimientos,
  tendenciaDelMes,
} from '../../core/domain';
import type {
  Categoria,
  CompraCuotas,
  Credito,
  Cuenta,
  ExtractoTarjeta,
  Movimiento,
  PagoFijo,
} from '../../core/models';
import { Amount } from '../../shared/amount/amount';
import { DonutCategorias } from '../../shared/charts/donut-categorias/donut-categorias';
import { TendenciaMesChart } from '../../shared/charts/tendencia-mes-chart/tendencia-mes-chart';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { FranjaMes } from '../../shared/franja-mes/franja-mes';
import { PageHead } from '../../shared/page-head/page-head';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';
import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { AutoAnimar } from '../../shared/motion/auto-animar';
import { StatCard } from '../../shared/stat-card/stat-card';
import {
  etiquetaDia,
  formatearDiaSemana,
  formatearMesAnioCapitalizado,
  formatearNombreMes,
} from '../../shared/format/fecha';
import { textoVencimiento } from '../../shared/format/texto-vencimiento';
import { SemaforoBadge } from '../../shared/semaforo-badge/semaforo-badge';
import { BienvenidaService } from '../../shared/bienvenida/bienvenida.service';
import { PrimerosPasos } from '../../shared/bienvenida/primeros-pasos';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';

/**
 * Tab General: foto rápida de las demás tabs, sin datos propios (ver
 * `notas-app-finanzas.md`, "Tab General"). Cada panel enlaza a su tab
 * completa.
 *
 * Los íconos de "Últimos movimientos" salen del tipo del movimiento
 * (ingreso/gasto/transferencia/ajuste), no de un catálogo decorativo: dicen
 * algo que el monto solo insinúa por el signo, y le dan a la fila un ancla
 * visual a la izquierda para leerla de un vistazo.
 */
@Component({
  selector: 'app-general-page',
  imports: [
    RouterLink,
    MatIconModule,
    Amount,
    EmptyState,
    SemaforoBadge,
    FranjaMes,
    StatCard,
    SkeletonRows,
    PageHead,
    DonutCategorias,
    TendenciaMesChart,
    AutoAnimar,
    AparicionEscalonada,
    PrimerosPasos,
    PantallaVacia,
  ],
  templateUrl: './general.page.html',
  styleUrl: './general.page.scss',
})
export class GeneralPage {
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  protected readonly bienvenida = inject(BienvenidaService);
  private readonly router = inject(Router);

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  private readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly pagosFijos = toSignal(this.pagosFijosApi.listar(), {
    initialValue: [] as PagoFijo[],
  });
  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });

  // Extractos por tarjeta, mismo patrón reactivo que Créditos/Pagos fijos.
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

  // Sin esto, `tasaEaVigente` cae a la tasa base del crédito y tanto la
  // deuda como la cuota de un banco con tasa variable salen calculadas con
  // una tasa vieja — plausibles, pero distintas de las que muestra
  // Créditos. Esta pantalla no edita tasas, así que no necesita refresco.
  private readonly cambiosTasa = cambiosTasaDeBancos(this.creditos);

  private readonly mesActual = anioMesDe(new Date());

  private readonly resumenPagosFijos = computed(() =>
    agruparPagosFijosDelMes(
      this.pagosFijos(),
      {
        creditos: this.creditos(),
        compras: this.compras(),
        extractos: this.extractos(),
        movimientos: this.movimientos(),
        cambiosTasa: this.cambiosTasa(),
      },
      this.mesActual,
    ),
  );

  /** Nada registrado todavía: General muestra solo la bienvenida. */
  protected readonly cuentaNueva = computed(
    () =>
      this.cuentas().length === 0 &&
      this.creditos().length === 0 &&
      this.pagosFijos().length === 0 &&
      this.movimientos().length === 0,
  );
  /**
   * Una cuenta nueva que no ha saltado el recorrido entra por la
   * bienvenida de pantalla completa, no por un General vacío.
   */
  private readonly irABienvenida = effect(() => {
    if (
      this.datosListos() &&
      this.cuentaNueva() &&
      this.bienvenida.listo() &&
      !this.bienvenida.oculto()
    ) {
      void this.router.navigate(['/bienvenida'], { replaceUrl: true });
    }
  });
  protected readonly hayMovimientos = computed(() => this.movimientos().length > 0);
  protected readonly hayCreditos = computed(() => this.creditos().length > 0);
  /** Pagos fijos o cuotas de crédito en el mes: lo que llena "Pagos del mes". */
  protected readonly hayPagosDelMes = computed(() => this.lineaMes().dias.length > 0);

  protected readonly disponible = computed(() => disponible(this.cuentas(), this.movimientos()));
  protected readonly reservado = computed(() => reservado(this.cuentas(), this.movimientos()));
  protected readonly faltaPorPagarMes = computed(() => this.resumenPagosFijos().totalPorPagar);
  protected readonly libreDelMes = computed(() =>
    libreDelMes(this.disponible(), this.faltaPorPagarMes()),
  );
  /**
   * El mes es el título de la pantalla: General siempre muestra el mes en
   * curso, así que no hay selector que ponga — el encabezado dice de qué
   * mes se está hablando y el subtítulo, en qué día va.
   */
  protected readonly tituloMes = formatearMesAnioCapitalizado(
    new Date(this.mesActual.anio, this.mesActual.mes - 1, 1),
  );
  protected readonly detalleHoy = (() => {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const quedan = ultimoDia - hoy.getDate();
    if (quedan === 0) return `${formatearDiaSemana(hoy)} · último día del mes`;
    return `${formatearDiaSemana(hoy)} · ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`} del mes`;
  })();

  protected readonly nombreMesActual = formatearNombreMes(
    new Date(this.mesActual.anio, this.mesActual.mes - 1, 1),
  );

  private readonly movimientosDelMes = computed(() =>
    this.movimientos().filter((m) => perteneceAlMes(m.fecha, this.mesActual)),
  );
  protected readonly resumenMes = computed(() => resumenMovimientos(this.movimientosDelMes()));

  private readonly gruposCreditos = computed(() =>
    agruparCreditosPorTipo(this.creditos(), {
      compras: this.compras(),
      movimientos: this.movimientos(),
      extractos: this.extractos(),
      cambiosTasa: this.cambiosTasa(),
    }),
  );
  protected readonly deudaTotal = computed(() =>
    this.gruposCreditos()
      .flatMap((g) => g.creditos)
      .reduce((acc, c) => acc + c.deuda, 0),
  );

  // Las tres primeras: son un resumen, no la lista completa (que ya vive en
  // su propia tab, con el enlace "Ver todos"/"Ver créditos").
  /** Lo pendiente del mes en orden de fecha: los vencidos quedan primero. */
  protected readonly proximosPagos = computed(() => this.resumenPagosFijos().porPagar.slice(0, 3));
  /** El mes de pagos como línea de tiempo, para la franja de "Pagos del mes". */
  protected readonly lineaMes = computed(() => lineaDelMes(this.resumenPagosFijos()));
  protected readonly cuotasQueFaltan = computed(() =>
    creditosConCuotasPendientes(this.creditos(), this.compras(), this.movimientos()).slice(0, 3),
  );
  protected readonly gastosPorCategoria = computed(() =>
    gastosPorCategoriaDelMes(this.movimientos(), this.categorias(), this.mesActual),
  );
  /** Categorías con tope, de la más cerca de pasarse a la más lejos. */
  protected readonly presupuestos = computed(() =>
    presupuestosDelMes(this.categorias(), this.movimientos(), this.mesActual),
  );
  protected readonly tendencia = computed(() =>
    tendenciaDelMes(this.movimientos(), this.mesActual),
  );
  protected readonly ultimosMovimientos = computed(() =>
    [...this.movimientos()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, 3),
  );

  /**
   * Si ya llegó la primera respuesta de todo lo que pinta la pantalla
   * (ver `primeraCarga`): mientras tanto, esqueletos en vez de $0 y de
   * estados vacíos. Los extractos no cuentan: dependen de los créditos y
   * solo afinan el monto de la tarjeta.
   */
  protected readonly datosListos = primeraCarga(
    this.cuentasApi.listar(),
    this.creditosApi.listar(),
    this.comprasApi.listar(),
    this.movimientosApi.listar(),
    this.pagosFijosApi.listar(),
    this.categoriasApi.listar(),
  );

  /** La barra se llena hasta el tope; pasarse lo dice el color, no el largo. */
  protected progresoDe(proporcion: number): number {
    return Math.min(proporcion, 1);
  }

  protected absoluto(valor: number): number {
    return Math.abs(valor);
  }

  protected textoVencimientoDe(fechaLimite: Date): string {
    return textoVencimiento(fechaLimite, false);
  }

  protected etiquetaDiaDe(fechaIso: string): string {
    return etiquetaDia(fechaIso);
  }

  protected cuentaDe(movimiento: Movimiento): string {
    const cuentaId =
      movimiento.tipo === 'INGRESO' ? movimiento.cuentaDestinoId : movimiento.cuentaOrigenId;
    return this.cuentas().find((c) => c.id === cuentaId)?.nombre ?? '';
  }

  protected signoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return '+';
    if (movimiento.tipo === 'GASTO') return '−';
    return '';
  }

  protected iconoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return 'arrow_downward';
    if (movimiento.tipo === 'GASTO') return 'arrow_upward';
    if (movimiento.tipo === 'AJUSTE') return 'tune';
    return 'swap_horiz';
  }

  protected claseIconoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return 'ico--ingreso';
    if (movimiento.tipo === 'GASTO') return 'ico--gasto';
    if (movimiento.tipo === 'AJUSTE') return 'ico--deuda';
    return '';
  }

  protected claseMontoDe(movimiento: Movimiento): string {
    if (movimiento.tipo === 'INGRESO') return 'mon-in';
    if (movimiento.tipo === 'GASTO') return 'mon-out';
    if (movimiento.tipo === 'AJUSTE') return 'mon-aj';
    return 'mon-tr';
  }
}
