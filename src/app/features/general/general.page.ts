import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { AsistenteIa, type TextoDeIa } from '../../core/api/asistente/asistente-ia';
import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { cambiosTasaDeBancos } from '../../core/api/creditos/cambios-tasa.util';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import {
  type AccionAsistente,
  alertaDelAsistente,
  claveDeAlerta,
  type EvidenciaAsistente,
  agruparCreditosPorTipo,
  agruparPagosFijosDelMes,
  anioMesDe,
  avanceDelCiclo,
  avanceDelMes,
  disponible,
  estadoDeComprometido,
  estadoDelRitmo,
  excesoSobreTopeCuotas,
  fechaIsoDesdeLocal,
  gastoDiarioPermitido,
  aporteFaltanteTotal,
  gastosPorCategoriaDelMes,
  ingresoMensualDeReferencia,
  inicioDelCiclo,
  libreDelMes,
  libreDespuesDeAhorrar,
  libreHastaProximoPago,
  lineaDelMes,
  periodoDelCiclo,
  perteneceAlPeriodo,
  presupuestosDelMes,
  progresoDeMeta,
  proporcionComprometida,
  proximoPago,
  proyeccionDeCaja,
  ritmoDeGasto,
  TOPE_CUOTAS_CRITICO,
  TOPE_CUOTAS_SALUDABLE,
  salidasYEntradasDelMes,
  separarComprasACuotas,
  sumarMesesAnioMes,
  totalCuotasDelMes,
  ultimoSueldo,
  vistaDelHeroe,
} from '../../core/domain';
import { PREFERENCIAS_INICIALES, cambiosDeObjetivo } from '../../core/models';
import type {
  Categoria,
  CompraCuotas,
  Credito,
  Cuenta,
  ExtractoTarjeta,
  Movimiento,
  Objetivo,
  PagoFijo,
} from '../../core/models';
import { OPCIONES_OBJETIVO } from '../../shared/bienvenida/pasos-bienvenida';
import { Amount } from '../../shared/amount/amount';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { formatearCop } from '../../shared/format/moneda';
import { DonutCategorias } from '../../shared/charts/donut-categorias/donut-categorias';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PageHead } from '../../shared/page-head/page-head';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';
import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { AutoAnimar } from '../../shared/motion/auto-animar';
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
import { IngresosReferencia } from './ingresos-referencia/ingresos-referencia';
import { TopesPresupuesto } from './topes-presupuesto/topes-presupuesto';

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
    MatTooltipModule,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    Amount,
    EmptyState,
    SemaforoBadge,
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly asistenteIa = inject(AsistenteIa);

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

  // Qué tarjetas se dibujan. Mientras carga van todas (en esqueleto).
  protected readonly mostrarDetalle = computed(() => !this.datosListos() || this.hayMovimientos());
  protected readonly mostrarComprometido = computed(
    () => !this.datosListos() || (this.comprometido() !== null && this.cuotasDelMes() > 0),
  );

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

  private readonly progresosAhorro = computed(() => {
    const inicio = inicioDelCiclo(new Date(), this.preferencias().diaDePago);
    return this.preferencias().metasAhorro.map((meta) =>
      progresoDeMeta(meta, this.cuentas(), this.movimientos(), inicio),
    );
  });
  /** Lo que falta apartar este ciclo para las metas de ahorro. */
  private readonly ahorroPendiente = computed(() => aporteFaltanteTotal(this.progresosAhorro()));
  /** Lo que ya hay en los bolsillos de las metas: la cifra del héroe para quien quiere ahorrar. */
  protected readonly totalAhorrado = computed(() =>
    this.progresosAhorro().reduce((acc, p) => acc + p.ahorrado, 0),
  );
  /** Lo apartado en lo que va del ciclo, de lo que se pensaba apartar. */
  protected readonly apartadoEnCiclo = computed(() =>
    this.progresosAhorro().reduce((acc, p) => acc + p.aportadoEnCiclo, 0),
  );
  protected readonly aportePlaneado = computed(() =>
    this.progresosAhorro().reduce((acc, p) => acc + (p.cumplida ? 0 : p.meta.aporteMensual), 0),
  );

  // ── Héroe según el objetivo principal ───────────────────────────────

  protected readonly objetivoPrincipal = computed(() => this.preferencias().objetivoPrincipal);
  private readonly gruposCreditos = computed(() =>
    agruparCreditosPorTipo(this.creditos(), {
      compras: this.compras(),
      movimientos: this.movimientos(),
      extractos: this.extractos(),
      cambiosTasa: this.cambiosTasa(),
    }),
  );
  /** Lo que se debe en total, en todos los créditos activos. */
  protected readonly deudaTotal = computed(() =>
    this.gruposCreditos()
      .flatMap((g) => g.creditos)
      .reduce((acc, c) => acc + c.deuda, 0),
  );
  /** Cuántos créditos tienen deuda: la línea del héroe de "salir de deudas". */
  protected readonly creditosConDeuda = computed(
    () =>
      this.gruposCreditos()
        .flatMap((g) => g.creditos)
        .filter((c) => c.deuda > 0).length,
  );
  /**
   * La tarjeta que sube al primer lugar según lo que más le importa a la
   * persona; el resto queda en su orden de siempre (ver `.tablero` en el scss).
   */
  protected readonly tarjetaLider = computed<'deudas' | 'gastos' | null>(() => {
    if (this.vista() === 'deudas') return 'deudas';
    return this.objetivoPrincipal() === 'gastos' ? 'gastos' : null;
  });
  /** Lo primero que vence antes del próximo pago, para el héroe de "no olvidar pagos". */
  protected readonly primerPagoPendiente = computed(() => this.hastaPago()?.antes[0] ?? null);

  protected readonly vista = computed(() =>
    vistaDelHeroe(this.objetivoPrincipal(), {
      hayMetas: this.progresosAhorro().length > 0,
      hayDeudas: this.deudaTotal() > 0,
      hayPagosPendientes: this.primerPagoPendiente() !== null,
    }),
  );

  /** "Ahora no" en la tarjeta de elegir prioridad: vale hasta recargar. */
  private readonly prioridadOmitida = signal(false);
  // ── Guía de endeudamiento (ícono de info de "Tu sueldo y las cuotas") ──
  protected readonly infoAbierta = signal(false);
  /** Arriba del ícono y, si no cabe, abajo. */
  protected readonly posicionesInfo: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
  private temporizadorInfo: ReturnType<typeof setTimeout> | undefined;

  protected abrirInfo(): void {
    this.cancelarCierreInfo();
    this.infoAbierta.set(true);
  }

  /** Con un respiro, para poder llevar el mouse del ícono a la guía sin que se cierre. */
  protected cerrarInfoConRetraso(): void {
    this.cancelarCierreInfo();
    this.temporizadorInfo = setTimeout(() => this.infoAbierta.set(false), 150);
  }

  protected cerrarInfo(): void {
    this.cancelarCierreInfo();
    this.infoAbierta.set(false);
  }

  protected cancelarCierreInfo(): void {
    clearTimeout(this.temporizadorInfo);
  }

  /** Hasta cuánto se recomienda llevar en cuotas, en pesos; `null` sin ingreso de referencia. */
  protected readonly topeCuotasPesos = computed(() => {
    const ingreso = this.ingresoDeReferencia();
    return ingreso === null ? null : Math.round(ingreso * TOPE_CUOTAS_SALUDABLE);
  });
  protected readonly opcionesObjetivo = OPCIONES_OBJETIVO;
  /** Quien no ha dicho qué le importa más: se le pregunta una vez, sin bloquear nada. */
  protected readonly preguntarPrioridad = computed(
    () =>
      this.datosListos() &&
      !this.cuentaNueva() &&
      this.objetivoPrincipal() === null &&
      !this.prioridadOmitida(),
  );

  /** "vence en 3 días", en minúscula para ir dentro de una frase. */
  protected textoPrimerPago(): string {
    const pago = this.primerPagoPendiente();
    return pago ? textoVencimiento(pago.fechaLimite, false).toLowerCase() : '';
  }

  protected elegirPrioridad(objetivo: Objetivo): void {
    this.preferenciasApi.actualizar(cambiosDeObjetivo(objetivo)).subscribe();
  }

  protected omitirPrioridad(): void {
    this.prioridadOmitida.set(true);
  }
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
  /** "Martes 10 de noviembre": el mes ya está en el título, así que va el día completo. */
  protected readonly detalleHoy = (() => {
    const hoy = new Date();
    const semana = hoy.toLocaleDateString('es-CO', { weekday: 'long' });
    const mes = hoy.toLocaleDateString('es-CO', { month: 'long' });
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${hoy.getDate()} de ${mes}`;
  })();


  protected readonly nombreMesActual = formatearNombreMes(
    new Date(this.mesActual.anio, this.mesActual.mes - 1, 1),
  );

  /**
   * Lo que miden Resumen, categorías y presupuestos: el ciclo de pago (desde
   * el día que te pagan, así el sueldo ya cuenta) o, sin día de pago, el mes.
   */
  private readonly periodo = computed(() =>
    periodoDelCiclo(new Date(), this.preferencias().diaDePago),
  );
  /** Cómo se llama ese periodo en los rótulos: "Desde el 20 de octubre" o "Noviembre". */
  protected readonly rotuloPeriodo = computed(() => {
    const p = this.periodo();
    return 'desde' in p
      ? `Desde el ${formatearDiaMes(p.desde)}`
      : this.nombreMesActual;
  });
  /** Para frases: "este ciclo" o "este mes". */
  protected readonly nombrePeriodo = computed(() =>
    'desde' in this.periodo() ? 'este ciclo' : 'este mes',
  );

  /** Lo que entró y salió en el periodo, con los pagos de deuda aparte de los gastos. */
  protected readonly entradasSalidas = computed(() =>
    salidasYEntradasDelMes(this.movimientos(), this.periodo()),
  );

  /**
   * Los gastos del mes sin las compras a cuotas, que van en su propia fila:
   * de esas solo sale cada mes la cuota (ya cuenta en "Pagos de deuda") y
   * así este número coincide con el de la dona de categorías.
   */
  protected readonly gastosDelDia = computed(
    () => this.entradasSalidas().gastos - this.comprasACuotasDelMes(),
  );

  /** El último sueldo registrado: lo que se espera que entre en el próximo pago. */
  protected readonly sueldoDeReferencia = computed(() => ultimoSueldo(this.movimientos()));
  /**
   * Lo que entra al mes con las categorías de ingreso que la persona eligió
   * (por defecto todas menos reembolsos): con qué se compara lo que se paga
   * en cuotas.
   */
  protected readonly ingresoDeReferencia = computed(() =>
    ingresoMensualDeReferencia(
      this.movimientos(),
      this.preferencias().categoriasDeIngreso,
      new Date(),
    ),
  );
  protected readonly cuotasDelMes = computed(() => {
    const resumen = this.resumenPagosFijos();
    return totalCuotasDelMes([...resumen.pagados, ...resumen.porPagar]);
  });
  /** Qué parte de los ingresos se va en cuotas (0-1+), o `null` si no hay ingresos registrados. */
  protected readonly comprometido = computed(() =>
    proporcionComprometida(this.cuotasDelMes(), this.ingresoDeReferencia()),
  );
  protected readonly porcentajeComprometido = computed(() =>
    Math.round((this.comprometido() ?? 0) * 100),
  );
  protected readonly estadoComprometido = computed(() =>
    estadoDeComprometido(this.comprometido() ?? 0),
  );
  /** Los topes, en porcentaje, para rotular la barra. */
  protected readonly topeSaludablePct = TOPE_CUOTAS_SALUDABLE * 100;
  protected readonly topeCriticoPct = TOPE_CUOTAS_CRITICO * 100;
  /** Cuánto pasan las cuotas del tope saludable (negativo si queda margen); `null` sin ingresos. */
  protected readonly excesoCuotas = computed(() =>
    excesoSobreTopeCuotas(this.cuotasDelMes(), this.ingresoDeReferencia()),
  );

  /** Abre la lista de categorías de ingreso que cuentan para medir las cuotas. */
  protected configurarIngresos(): void {
    this.dialog.open(IngresosReferencia, { width: '480px', maxHeight: '90vh' });
  }
  /** Los topes de las categorías que ya tienen uno, sin salir de General. */
  protected ajustarPresupuestos(topes: Record<string, number> = {}): void {
    this.dialog.open(TopesPresupuesto, {
      width: '480px',
      maxHeight: '90vh',
      data: { topes },
    });
  }

  // ── Asistente ───────────────────────────────────────────────────────

  /**
   * Lo más importante según el objetivo de la persona. Las cifras salen de
   * las mismas cuentas que pintan el resto de General; el texto, de reglas
   * (ver `alertaDelAsistente`).
   */
  protected readonly alertaAsistente = computed(() => {
    const pago = this.hastaPago();
    return alertaDelAsistente(
      this.objetivoPrincipal(),
      {
        disponible: this.disponible(),
        porPagar: this.faltaMostrada(),
        pagosPendientes: pago ? pago.antes.length : this.resumenPagosFijos().porPagar.length,
        hasta: pago ? 'tu pago' : 'fin de mes',
        libreParaGastar: this.libreParaGastar(),
        libreAntesDeMetas: this.libreMostrado(),
        presupuestos: this.presupuestos(),
        cuotasDelMes: this.cuotasDelMes(),
        comprometido: this.comprometido(),
        estadoComprometido: this.estadoComprometido(),
        comprasACuotas: this.comprasACuotasDelMes(),
        pagosDeuda: this.entradasSalidas().pagosDeuda,
        metas: this.progresosAhorro(),
      },
      formatearCop,
    );
  });

  /**
   * El texto con IA, si ya llegó y describe las cifras de ahora (la clave
   * guarda de cuáles era). Mientras no, o si algo falla, la tarjeta usa el
   * titular y el consejo de plantilla.
   */
  private readonly textoIa = signal<(TextoDeIa & { clave: string }) | null>(null);
  protected readonly textoIaVigente = computed(() => {
    const alerta = this.alertaAsistente();
    const ia = this.textoIa();
    return alerta && ia && ia.clave === claveDeAlerta(alerta) ? ia : null;
  });
  private readonly clavesPedidas = new Set<string>();
  /**
   * Pide el texto a la IA cuando las cifras de la alerta se quedan quietas un
   * momento (los extractos llegan después y las mueven un poco: pedirlo antes
   * gastaría el análisis del día en cifras provisionales). Una vez por cifras.
   */
  private readonly pedirTextoIa = effect((alAcabar) => {
    const alerta = this.alertaAsistente();
    if (!alerta || !this.datosListos()) return;
    const clave = claveDeAlerta(alerta);
    const espera = setTimeout(() => {
      untracked(() => {
        if (this.clavesPedidas.has(clave)) return;
        this.clavesPedidas.add(clave);
        const dia = fechaIsoDesdeLocal(new Date());
        void this.asistenteIa
          .analizar(alerta, this.objetivoPrincipal(), dia)
          .then((texto) => texto && this.textoIa.set({ ...texto, clave }));
      });
    }, 1500);
    alAcabar(() => clearTimeout(espera));
  });

  /** Qué parte de la cifra más grande es esta: el largo de la barra de la evidencia. */
  protected progresoEvidencia(e: EvidenciaAsistente, todas: readonly EvidenciaAsistente[]): number {
    const mayor = Math.max(...todas.map((x) => x.valor), 0);
    return mayor > 0 ? Math.min(e.valor / mayor, 1) : 0;
  }

  /** El botón de la tarjeta. Ninguna acción cambia datos sin que la persona confirme. */
  protected ejecutarAccion(accion: AccionAsistente): void {
    switch (accion.tipo) {
      case 'IR_A':
        void this.router.navigateByUrl(accion.ruta);
        break;
      case 'AJUSTAR_TOPES':
        this.ajustarPresupuestos(accion.topes);
        break;
      case 'PAUSAR_METAS':
        this.pausarMetas(accion.metasIds);
        break;
    }
  }

  /** Pone en 0 el aporte de esas metas, con confirmación y un "Deshacer" a mano. */
  private pausarMetas(ids: readonly string[]): void {
    const antes = this.preferencias().metasAhorro;
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: 'Pausar tus metas',
          mensaje:
            'Dejarán de pedirte aporte cada ciclo hasta que vuelvas a ponerles uno en Ahorro. Lo que ya ahorraste no se toca.',
          textoConfirmar: 'Pausar',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        const metasAhorro = antes.map((m) => (ids.includes(m.id) ? { ...m, aporteMensual: 0 } : m));
        this.preferenciasApi.actualizar({ metasAhorro }).subscribe(() => {
          this.snackBar
            .open('Metas en pausa', 'Deshacer', { duration: 6000 })
            .onAction()
            .subscribe(() => this.preferenciasApi.actualizar({ metasAhorro: antes }).subscribe());
        });
      });
  }

  /** Presupuestos: solo los tres más cerca de agotarse, o todos si la persona lo pide. */
  protected readonly verTodosLosPresupuestos = signal(false);
  protected readonly presupuestosVisibles = computed(() =>
    this.verTodosLosPresupuestos() ? this.presupuestos() : this.presupuestos().slice(0, 3),
  );
  /** Tramo de la barra hasta el tope saludable, en % de ancho (gris). */
  protected readonly tramoSano = computed(() =>
    Math.min((this.comprometido() ?? 0) * 100, this.topeSaludablePct),
  );
  /** Tramo que pasa del tope saludable, en % de ancho (en el color del estado). */
  protected readonly tramoExceso = computed(() =>
    Math.max(0, Math.min((this.comprometido() ?? 0) * 100, 100) - this.topeSaludablePct),
  );
  /** El estado de las cuotas en dos palabras, junto al porcentaje. */
  protected readonly etiquetaMargen = computed(() => {
    switch (this.estadoComprometido()) {
      case 'pasado':
        return 'Margen crítico';
      case 'cerca':
        return 'Margen justo';
      default:
        return 'Margen sano';
    }
  });

  /**
   * Lo que viene, con el saldo que quedaría después de cada paso: la plata
   * de hoy, los pagos que vencen y el sueldo cuando llega.
   */
  private readonly proyeccionCompleta = computed(() => {
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
    return proyeccionDeCaja(this.disponible(), pendientes, hoy, ingreso);
  });

  protected readonly proyeccion = computed(() => this.proyeccionCompleta().slice(0, 6));

  // Los primeros: son un resumen, no la lista completa (que ya vive en su
  // propia tab, con el enlace "Ver todos"/"Ver créditos").
  /** El mes de pagos como línea de tiempo, para la franja de "Pagos del mes". */
  protected readonly lineaMes = computed(() => lineaDelMes(this.resumenPagosFijos()));
  /**
   * Las compras en cuotas van aparte: entran de golpe como un gasto enorme y
   * aplastarían las categorías y los topes, cuando lo que pesa cada mes es
   * su cuota (que ya cuenta en "Tus cuotas").
   */
  private readonly gastosSeparados = computed(() =>
    separarComprasACuotas(this.movimientos(), this.compras()),
  );
  protected readonly comprasACuotasDelMes = computed(() =>
    this.gastosSeparados()
      .aCuotas.filter((m) => perteneceAlPeriodo(m.fecha, this.periodo()))
      .reduce((suma, m) => suma + m.monto, 0),
  );
  protected readonly gastosPorCategoria = computed(() =>
    gastosPorCategoriaDelMes(this.gastosSeparados().diaADia, this.categorias(), this.periodo()),
  );
  /** Qué parte del periodo ya pasó (0-1), para avisar si se gasta más rápido que él. */
  private readonly avancePeriodo = computed(() => {
    const dia = this.preferencias().diaDePago;
    if (dia === null) return avanceDelMes(new Date());
    const ciclo = avanceDelCiclo(new Date(), dia);
    return ciclo.dia / ciclo.duracion;
  });
  /** Categorías con tope, de la más cerca de pasarse a la más lejos. */
  protected readonly presupuestos = computed(() =>
    presupuestosDelMes(
      this.categorias(),
      this.gastosSeparados().diaADia,
      this.periodo(),
      this.avancePeriodo(),
    ),
  );
  /**
   * Los más recientes, con margen de sobra: en escritorio la tarjeta muestra
   * solo las filas que caben en el alto de la torta (ver `.g-ultimos` en el
   * scss) y en el celular solo las tres primeras.
   */
  protected readonly ultimosMovimientos = computed(() =>
    [...this.movimientos()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, 8),
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
