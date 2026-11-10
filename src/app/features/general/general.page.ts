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
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import {
  agruparPagosFijosDelMes,
  anioMesDe,
  disponible,
  estadoDeComprometido,
  estadoDelRitmo,
  fechaIsoDesdeLocal,
  gastoDiarioPermitido,
  aporteFaltanteTotal,
  gastosPorCategoriaDelMes,
  inicioDelCiclo,
  libreDelMes,
  libreDespuesDeAhorrar,
  libreHastaProximoPago,
  lineaDelMes,
  presupuestosDelMes,
  progresoDeMeta,
  proporcionComprometida,
  proximoPago,
  proyeccionDeCaja,
  ritmoDeGasto,
  salidasYEntradasDelMes,
  sumarMesesAnioMes,
  totalCuotasDelMes,
  ultimoSueldo,
} from '../../core/domain';
import { PREFERENCIAS_INICIALES } from '../../core/models';
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
  formatearDiaMes,
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
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
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

  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  private readonly contextoPagos = computed(() => ({
    creditos: this.creditos(),
    compras: this.compras(),
    extractos: this.extractos(),
    movimientos: this.movimientos(),
    cambiosTasa: this.cambiosTasa(),
    umbrales: this.preferencias().avisos,
  }));

  private readonly resumenPagosFijos = computed(() =>
    agruparPagosFijosDelMes(this.pagosFijos(), this.contextoPagos(), this.mesActual),
  );
  /** Lo del mes siguiente: si el próximo pago cae allá, lo que vence antes también se resta. */
  private readonly resumenMesSiguiente = computed(() =>
    agruparPagosFijosDelMes(
      this.pagosFijos(),
      this.contextoPagos(),
      sumarMesesAnioMes(this.mesActual, 1),
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
  /** Pagos fijos o cuotas de crédito en el mes: lo que llena "Pagos del mes". */
  protected readonly hayPagosDelMes = computed(() => this.lineaMes().dias.length > 0);

  // Qué tarjetas se dibujan. Mientras carga van todas (en esqueleto); cada
  // pareja de escritorio mira si está su vecina para saber si llena la fila.
  protected readonly mostrarDetalle = computed(() => !this.datosListos() || this.hayMovimientos());
  protected readonly mostrarPagos = computed(() => !this.datosListos() || this.hayPagosDelMes());
  protected readonly mostrarComprometido = computed(
    () => !this.datosListos() || (this.comprometido() !== null && this.cuotasDelMes() > 0),
  );
  /** La columna de la derecha: cuánto sueldo van las cuotas y los topes por categoría. */
  protected readonly mostrarLateral = computed(
    () => this.mostrarComprometido() || this.presupuestos().length > 0,
  );

  /**
   * Un "$0" en ingresos a mitad de mes asusta sin motivo si el sueldo todavía
   * no llega: se explica con la fecha en que entra.
   */
  protected readonly notaIngresos = computed(() => {
    const dia = this.preferencias().diaDePago;
    if (!this.datosListos() || dia === null || this.entradasSalidas().ingresos > 0) return '';
    return `Tu pago entra el ${formatearDiaMes(fechaIsoDesdeLocal(proximoPago(new Date(), dia)))}`;
  });

  /**
   * Tocar el panel de una sección lleva a su pantalla, igual que el enlace
   * de su cabecera. Es un atajo del mouse; el teclado y los lectores de
   * pantalla usan ese enlace, así que el panel no se vuelve un botón.
   */
  protected abrir(ruta: string): void {
    void this.router.navigateByUrl(ruta);
  }

  protected readonly disponible = computed(() => disponible(this.cuentas(), this.movimientos()));
  protected readonly faltaPorPagarMes = computed(() => this.resumenPagosFijos().totalPorPagar);
  protected readonly libreDelMes = computed(() =>
    libreDelMes(this.disponible(), this.faltaPorPagarMes()),
  );

  /**
   * Con día de pago (ver Configuración) General cuenta lo libre hasta ese
   * día, no hasta fin de mes; sin él, `null` y todo sigue por mes calendario.
   */
  protected readonly hastaPago = computed(() => {
    const dia = this.preferencias().diaDePago;
    if (dia === null) return null;
    return libreHastaProximoPago(
      this.disponible(),
      this.resumenPagosFijos().porPagar,
      this.resumenMesSiguiente().porPagar,
      new Date(),
      dia,
    );
  });
  /** Lo libre hasta el pago, o hasta fin de mes si no hay día de pago. */
  protected readonly libreMostrado = computed(
    () => this.hastaPago()?.libre ?? this.libreDelMes(),
  );
  /**
   * La cifra del héroe cuando hay día de pago y algo de plata libre: cuánto
   * se puede gastar hoy, que es lo que ayuda a decidir. Si lo que vence
   * antes del pago ya es más de lo que hay, no hay cuánto repartir y el
   * héroe muestra el faltante (ver la plantilla).
   */
  protected readonly gastoDiario = computed(() => {
    const pago = this.hastaPago();
    return pago && pago.libre >= 0
      ? gastoDiarioPermitido(this.libreParaGastar(), pago.diasHastaPago)
      : null;
  });

  /** Lo que falta apartar este ciclo para las metas de ahorro. */
  private readonly ahorroPendiente = computed(() => {
    const inicio = inicioDelCiclo(new Date(), this.preferencias().diaDePago);
    return aporteFaltanteTotal(
      this.preferencias().metasAhorro.map((meta) =>
        progresoDeMeta(meta, this.cuentas(), this.movimientos(), inicio),
      ),
    );
  });
  /**
   * Lo libre hasta el pago una vez apartado el ahorro del ciclo: de ahí sale
   * "hoy puedes gastar". Solo con día de pago, que es cuando General reparte
   * lo libre por días.
   */
  protected readonly libreParaGastar = computed(() =>
    this.hastaPago()
      ? libreDespuesDeAhorrar(this.libreMostrado(), this.ahorroPendiente())
      : this.libreMostrado(),
  );
  /** Lo que se descontó para las metas; 0 si no hay metas o ya se aportó todo. */
  protected readonly apartadoParaMetas = computed(() =>
    this.hastaPago() && this.libreMostrado() > 0
      ? this.libreMostrado() - this.libreParaGastar()
      : 0,
  );
  protected readonly diasHastaPago = computed(() => this.hastaPago()?.diasHastaPago ?? 0);
  /** Lo que se ha gastado por día en la última semana, contra lo permitido. */
  protected readonly ritmo = computed(() => ritmoDeGasto(this.movimientos(), new Date()));
  protected readonly estadoRitmo = computed(() =>
    estadoDelRitmo(this.ritmo(), this.gastoDiario() ?? 0),
  );
  protected readonly faltaMostrada = computed(
    () => this.hastaPago()?.totalAntes ?? this.faltaPorPagarMes(),
  );
  protected readonly fechaProximoPago = computed(() => {
    const pago = this.hastaPago()?.proximoPago;
    return pago ? formatearDiaMes(fechaIsoDesdeLocal(pago)) : '';
  });
  /** Lo que vence después del pago, en una frase corta: "Zero G y Crédito Nequi". */
  protected readonly nombresDespuesDelPago = computed(() => {
    const nombres = (this.hastaPago()?.despues ?? []).map((i) => i.nombre);
    if (nombres.length <= 1) return nombres.join('');
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  });
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
    // "Miércoles 28": el mes ya está en el título, no se repite.
    const semana = hoy.toLocaleDateString('es-CO', { weekday: 'long' });
    const fecha = `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${hoy.getDate()}`;
    if (quedan === 0) return `${fecha} · último día del mes`;
    return `${fecha} · ${quedan === 1 ? 'queda 1 día' : `quedan ${quedan} días`} del mes`;
  })();

  protected readonly nombreMesActual = formatearNombreMes(
    new Date(this.mesActual.anio, this.mesActual.mes - 1, 1),
  );

  /** Lo que entró y salió este mes, con los pagos de deuda aparte de los gastos. */
  protected readonly entradasSalidas = computed(() =>
    salidasYEntradasDelMes(this.movimientos(), this.mesActual),
  );

  /** El último sueldo registrado: con qué se compara lo que se paga en cuotas. */
  protected readonly sueldoDeReferencia = computed(() => ultimoSueldo(this.movimientos()));
  protected readonly cuotasDelMes = computed(() => {
    const resumen = this.resumenPagosFijos();
    return totalCuotasDelMes([...resumen.pagados, ...resumen.porPagar]);
  });
  /** Qué parte del sueldo se va en cuotas (0-1+), o `null` si no hay un sueldo registrado. */
  protected readonly comprometido = computed(() =>
    proporcionComprometida(this.cuotasDelMes(), this.sueldoDeReferencia()),
  );
  protected readonly porcentajeComprometido = computed(() =>
    Math.round((this.comprometido() ?? 0) * 100),
  );
  protected readonly estadoComprometido = computed(() =>
    estadoDeComprometido(this.comprometido() ?? 0),
  );

  /**
   * Lo que viene, con el saldo que quedaría después de cada paso: la plata
   * de hoy, los pagos que vencen y el sueldo cuando llega.
   */
  protected readonly proyeccion = computed(() => {
    const hoy = new Date();
    const dia = this.preferencias().diaDePago;
    const sueldo = this.sueldoDeReferencia();
    const ingreso =
      dia !== null && sueldo !== null
        ? { nombre: 'Entra tu pago', fecha: proximoPago(hoy, dia), monto: sueldo }
        : null;
    const pendientes = [
      ...this.resumenPagosFijos().porPagar,
      ...this.resumenMesSiguiente().porPagar,
    ];
    return proyeccionDeCaja(this.disponible(), pendientes, hoy, ingreso).slice(0, 6);
  });

  // Los primeros: son un resumen, no la lista completa (que ya vive en su
  // propia tab, con el enlace "Ver todos"/"Ver créditos").
  /** El mes de pagos como línea de tiempo, para la franja de "Pagos del mes". */
  protected readonly lineaMes = computed(() => lineaDelMes(this.resumenPagosFijos()));
  protected readonly gastosPorCategoria = computed(() =>
    gastosPorCategoriaDelMes(this.movimientos(), this.categorias(), this.mesActual),
  );
  /** Categorías con tope, de la más cerca de pasarse a la más lejos. */
  protected readonly presupuestos = computed(() =>
    presupuestosDelMes(this.categorias(), this.movimientos(), this.mesActual),
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

  /** Fecha corta de un evento de la línea de tiempo: "12 nov". */
  protected diaCortoDe(fecha: Date): string {
    return formatearDiaMes(fechaIsoDesdeLocal(fecha));
  }

  /** Una frase sobre qué tanto sueldo se va en cuotas, según el color de la barra. */
  protected mensajeComprometido(): string {
    switch (this.estadoComprometido()) {
      case 'pasado':
        return 'Es más de la mitad: queda poco margen para el día a día. Evita nuevas cuotas.';
      case 'cerca':
        return 'Está cerca del límite que se recomienda (35 %). Cuidado con sumar cuotas.';
      default:
        return 'Va bien: lo habitual es no pasar del 35 % del sueldo en cuotas.';
    }
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
