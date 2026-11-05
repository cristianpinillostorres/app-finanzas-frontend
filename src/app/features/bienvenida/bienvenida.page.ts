import {
  Component,
  DestroyRef,
  type ElementRef,
  type WritableSignal,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { type Observable, combineLatest, map, of, shareReplay, switchMap } from 'rxjs';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { cambiosTasaDeBancos } from '../../core/api/creditos/cambios-tasa.util';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import {
  agruparPagosFijosDelMes,
  anioMesDe,
  disponible,
  fechaIsoDesdeLocal,
  libreDelMes,
} from '../../core/domain';
import type {
  Categoria,
  CompraCuotas,
  Credito,
  Cuenta,
  ExtractoTarjeta,
  GrupoCredito,
  NuevoCredito,
  Objetivo,
  Movimiento,
  PagoFijo,
  TipoCuenta,
} from '../../core/models';
import { Amount } from '../../shared/amount/amount';
import { BienvenidaService } from '../../shared/bienvenida/bienvenida.service';
import { OPCIONES_OBJETIVO, PASOS_BIENVENIDA } from '../../shared/bienvenida/pasos-bienvenida';
import { prefiereMenosMovimiento } from '../../shared/motion/preferencias-movimiento';
import { TransicionLogin } from '../../shared/bienvenida/transicion-login';
import { MuestrasGeneral } from './muestras-general/muestras-general';
import { mostrarErrorGuardado } from '../../shared/guardado/guardado.util';
import { AuthService } from '../../core/auth/auth.service';
import { OPCIONES_TEMA, type Tema, ThemeService } from '../../core/theme.service';

/** 0: presentación · 1-5: los pasos esenciales · 6: resumen. */
type Paso = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface Opcion<T> {
  valor: T;
  nombre: string;
  icono: string;
  /** Lo que dice el segmentado, donde el nombre completo no cabe. */
  corto: string;
  /** Lo que sugiere el campo de nombre al elegirla. */
  ejemplo: string;
}

const TIPOS_CUENTA: Opcion<TipoCuenta>[] = [
  {
    valor: 'BANCO',
    nombre: 'Banco',
    corto: 'Banco',
    icono: 'account_balance',
    ejemplo: 'Mi banco',
  },
  {
    valor: 'BILLETERA',
    nombre: 'Billetera digital',
    corto: 'Billetera',
    icono: 'account_balance_wallet',
    ejemplo: 'Mi billetera',
  },
  {
    valor: 'EFECTIVO',
    nombre: 'Efectivo',
    corto: 'Efectivo',
    icono: 'payments',
    ejemplo: 'Efectivo',
  },
  { valor: 'OTRO', nombre: 'Otro', corto: 'Otro', icono: 'more_horiz', ejemplo: 'Mi cuenta' },
];

/** El color con que nace la cuenta según su tipo; se cambia después en Cuentas. */
const COLOR_POR_TIPO: Record<TipoCuenta, string> = {
  BANCO: '#22545B',
  BILLETERA: '#7B3FA0',
  EFECTIVO: '#2E7D32',
  OTRO: '#5B686C',
};

const TIPOS_CREDITO: Opcion<GrupoCredito>[] = [
  {
    valor: 'TARJETA',
    nombre: 'Tarjeta',
    corto: 'Tarjeta',
    icono: 'credit_card',
    ejemplo: 'Mi tarjeta',
  },
  {
    valor: 'PLATAFORMA',
    nombre: 'Compra a cuotas',
    corto: 'A cuotas',
    icono: 'shopping_bag',
    ejemplo: 'Compra del celular',
  },
  {
    valor: 'BANCO',
    nombre: 'Préstamo de banco',
    corto: 'Préstamo',
    icono: 'account_balance',
    ejemplo: 'Préstamo',
  },
  {
    valor: 'PERSONA',
    nombre: 'Una persona',
    corto: 'Persona',
    icono: 'person',
    ejemplo: 'Préstamo de un amigo',
  },
];

/** Atajos de pago fijo, con la categoría que les corresponde. */
const SUGERENCIAS_PAGO = [
  { nombre: 'Arriendo', icono: 'home', categoriaId: 'cat-hogar' },
  { nombre: 'Servicios', icono: 'bolt', categoriaId: 'cat-servicios' },
  { nombre: 'Suscripciones', icono: 'subscriptions', categoriaId: 'cat-entretenimiento' },
];

const ATAJOS_SALDO = [500_000, 2_000_000, 5_000_000];

/** Una lista compartida: un solo listener aunque la lean varios. */
function compartir<T>(lista$: Observable<T>): Observable<T> {
  return lista$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
}

type PasoConCabeza = 1 | 2 | 3 | 4 | 5 | 6;

/** Título de cada paso del 1 al 6, en el encabezado fijo; `acento` va en verde. */
const CABEZAS: Record<PasoConCabeza, { antes: string; acento: string; texto: string }> = {
  1: {
    antes: 'Cuéntanos de',
    acento: 'ti',
    texto: 'Todo es opcional. Así te mostramos primero lo que más te sirve.',
  },
  2: {
    antes: 'Crea tu primera',
    acento: 'cuenta',
    texto: 'Donde tienes tu plata hoy.',
  },
  3: {
    antes: 'Ajusta tus',
    acento: 'categorías',
    texto: 'Quita las que no usas. Las demás quedan activas.',
  },
  4: {
    antes: 'Tus tarjetas y',
    acento: 'créditos',
    texto: 'Así sabes cuánto pagas de cuotas cada mes.',
  },
  5: {
    antes: 'Tus pagos',
    acento: 'fijos',
    texto: 'Lo que pagas cada mes. Con esto sale cuánto te queda libre.',
  },
  6: {
    antes: 'Tu primer',
    acento: 'movimiento',
    texto: 'Un gasto o un ingreso. Desde ahora, el botón + está en todas las pantallas.',
  },
};

/**
 * Bienvenida de pantalla completa para una cuenta nueva: los cinco pasos
 * esenciales uno tras otro, con formularios cortos que guardan datos de
 * verdad, y a la izquierda (arriba en el celular) "Te queda libre este
 * mes" armándose con cada cosa que se agrega — la razón de ser de la app,
 * vista desde el primer minuto.
 *
 * Comparte el marco del login (panel de marca + contenido) a propósito:
 * entrar y empezar se leen como una sola puerta. El panel cambia de papel:
 * en el login promete, acá muestra el número de la persona.
 *
 * Los cálculos son los de General (`agruparPagosFijosDelMes`, `libreDelMes`),
 * así que el número que se ve al terminar es el mismo que se ve después.
 * Los créditos se agregan con un formulario corto en el mismo paso, que
 * pide según el tipo lo mínimo para que la cuota salga bien (en un banco,
 * monto, plazo y tasa); el resto se completa después en Créditos.
 */
@Component({
  selector: 'app-bienvenida-page',
  imports: [MatIconModule, Amount, MuestrasGeneral],
  templateUrl: './bienvenida.page.html',
  styleUrl: './bienvenida.page.scss',
})
export class BienvenidaPage {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly bienvenida = inject(BienvenidaService);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);

  /** Solo al llegar desde el login el panel se encoge desde su ancho (ver la hoja de estilos). */
  private readonly transicion = inject(TransicionLogin);
  protected readonly desdeLogin = this.transicion.consumir();

  /** "¿Ya tienes cuenta? Entra": sale de la sesión anónima hacia el login, animado. */
  protected readonly saliendo = signal(false);

  protected volverAlLogin(): void {
    // Primero se desvanece la bienvenida; después, sin pintar nada, se
    // cierra la sesión y recarga, y el login entra animado.
    this.saliendo.set(true);
    this.transicion.marcarVuelta();
    setTimeout(
      () => {
        document.documentElement.setAttribute('data-puente', '');
        this.transicion.saliendo.set(true);
        void this.auth.cerrarSesion();
      },
      prefiereMenosMovimiento() ? 0 : 220,
    );
  }

  // ───────────────────────────── datos reales ─────────────────────────────

  // Cada lista se comparte entre su signal y `listo`: sin esto, `listo`
  // abría un segundo listener de Firestore por colección.
  private readonly cuentas$ = compartir(this.cuentasApi.listar());
  private readonly categorias$ = compartir(this.categoriasApi.listar());
  private readonly creditos$ = compartir(this.creditosApi.listar());
  private readonly pagosFijos$ = compartir(this.pagosFijosApi.listar());
  private readonly movimientos$ = compartir(this.movimientosApi.listar());

  private readonly cuentas = toSignal(this.cuentas$, { initialValue: [] as Cuenta[] });
  protected readonly categorias = toSignal(this.categorias$, {
    initialValue: [] as Categoria[],
  });
  private readonly creditos = toSignal(this.creditos$, {
    initialValue: [] as Credito[],
  });
  private readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  private readonly pagosFijos = toSignal(this.pagosFijos$, {
    initialValue: [] as PagoFijo[],
  });
  private readonly movimientos = toSignal(this.movimientos$, {
    initialValue: [] as Movimiento[],
  });
  /**
   * Si ya llegó lo que usan los pasos. Mientras no, cada paso muestra su
   * esqueleto: con las listas vacías por defecto, el paso 2 ofrecía crear
   * una cuenta que ya existía, y las categorías aparecían de golpe.
   */
  protected readonly listo = toSignal(
    combineLatest([
      this.cuentas$,
      this.categorias$,
      this.creditos$,
      this.pagosFijos$,
      this.movimientos$,
    ]).pipe(map(() => true)),
    { initialValue: false },
  );
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
  private readonly cambiosTasa = cambiosTasaDeBancos(this.creditos);
  private readonly mes = anioMesDe(new Date());

  private readonly resumenMes = computed(() =>
    agruparPagosFijosDelMes(
      this.pagosFijos(),
      {
        creditos: this.creditos(),
        compras: this.compras(),
        extractos: this.extractos(),
        movimientos: this.movimientos(),
        cambiosTasa: this.cambiosTasa(),
      },
      this.mes,
    ),
  );
  private readonly itemsMes = computed(() => [
    ...this.resumenMes().porPagar,
    ...this.resumenMes().pagados,
  ]);

  /** La cuenta del paso 2: la primera activa. */
  protected readonly cuenta = computed(() =>
    this.cuentas().find((c) => !c.archivada && c.cuentaPadreId === null),
  );
  protected readonly cuotasCredito = computed(() => this.itemsMes().filter((i) => i.esCredito));
  protected readonly pagosActivos = computed(() => this.pagosFijos().filter((p) => p.activo));

  // ──────────────────────────── panel en vivo ────────────────────────────

  /** Mientras no se ha creado la cuenta, el saldo que se está escribiendo ya cuenta. */
  private readonly enCuentasReal = computed(
    () => disponible(this.cuentas(), this.movimientos()) + (this.cuenta() ? 0 : this.saldo()),
  );
  private readonly totalPagosReal = computed(() =>
    this.resumenMes()
      .porPagar.filter((i) => !i.esCredito)
      .reduce((acc, i) => acc + i.monto, 0),
  );
  private readonly totalCuotasReal = computed(() =>
    this.resumenMes()
      .porPagar.filter((i) => i.esCredito)
      .reduce((acc, i) => acc + i.monto, 0),
  );

  /**
   * En "Crea tu cuenta" sin nada agregado (saltó el recorrido), el panel en
   * cero se veía vacío: muestra un mes de ejemplo, el mismo de la
   * presentación ($1.240.000 libres).
   */
  protected readonly deEjemplo = computed(
    () =>
      this.paso() === 7 &&
      this.enCuentasReal() === 0 &&
      this.totalPagosReal() + this.totalCuotasReal() === 0,
  );

  protected readonly enCuentas = computed(() =>
    this.deEjemplo() ? 3_200_000 : this.enCuentasReal(),
  );
  protected readonly totalPagos = computed(() =>
    this.deEjemplo() ? 1_250_000 : this.totalPagosReal(),
  );
  protected readonly totalCuotas = computed(() =>
    this.deEjemplo() ? 710_000 : this.totalCuotasReal(),
  );
  protected readonly libre = computed(() =>
    libreDelMes(this.enCuentas(), this.totalPagos() + this.totalCuotas()),
  );

  /** Anchos de la barra: libre, pagos y cuotas sobre lo que haya en cuentas. */
  protected readonly barra = computed(() => {
    const pagos = this.totalPagos();
    const cuotas = this.totalCuotas();
    const base = Math.max(this.enCuentas(), pagos + cuotas, 1);
    const wPagos = (Math.min(pagos, base) / base) * 100;
    return {
      libre: (Math.max(0, this.libre()) / base) * 100,
      pagos: wPagos,
      cuotas: (Math.min(cuotas, base - Math.min(pagos, base)) / base) * 100,
    };
  });

  protected readonly frase = computed(() => {
    if (this.deEjemplo()) return 'Ejemplo: así se verá tu mes.';
    const hayAlgo = this.enCuentas() > 0 || this.totalPagos() + this.totalCuotas() > 0;
    if (!hayAlgo) return 'Aún sin datos. Aquí verás tu mes armarse.';
    if (this.libre() < 0) return 'Tus pagos superan lo que tienes hoy.';
    if (this.totalPagos() + this.totalCuotas() > 0) return 'Después de pagos fijos y cuotas.';
    return 'Falta agregar tus pagos fijos y cuotas.';
  });

  // ─────────────────────────────── recorrido ───────────────────────────────

  protected readonly paso = signal<Paso>(0);
  protected readonly guardando = signal(false);
  protected readonly segmentos = [1, 2, 3, 4, 5, 6];
  /** Título del paso actual (solo del 1 al 6: la presentación y el final tienen el suyo). */
  protected readonly cabeza = computed(() => {
    const paso = this.paso();
    return paso >= 1 && paso <= 6 ? CABEZAS[paso as PasoConCabeza] : null;
  });

  /** En escritorio el scroll es de esta columna, no de la página. */
  private readonly contenido = viewChild<ElementRef<HTMLElement>>('contenido');

  constructor() {
    // La bienvenida se ve siempre en modo claro; el tema sí es el elegido.
    this.theme.soloModoClaro();
  }

  protected ir(paso: Paso): void {
    this.paso.set(paso);
    window.scrollTo?.({ top: 0 });
    this.contenido()?.nativeElement.scrollTo?.({ top: 0 });
  }

  protected atras(): void {
    this.ir(Math.max(0, this.paso() - 1) as Paso);
  }

  protected siguiente(): void {
    this.ir(Math.min(7, this.paso() + 1) as Paso);
  }

  /**
   * Si llegó a crear la cuenta saltándose el recorrido: no agregó nada, así
   * que el título es "Crea tu cuenta" y no "Guarda tu información".
   */
  protected readonly saltoRecorrido = signal(false);

  protected saltarRecorrido(): void {
    // Sin cuenta todavía no hay General al cual ir: salta a crearla.
    if (this.auth.anonimo()) {
      this.saltoRecorrido.set(true);
      this.ir(7);
      return;
    }
    this.bienvenida.ocultar();
    void this.router.navigate(['/general']);
  }

  // ───────────────────────────── 1. sobre ti ─────────────────────────────
  // Todo opcional y nada financiero. El nombre y los objetivos van a la
  // cuenta (`preferencias`); los objetivos ordenan "Sácale más provecho".
  // El tema es del navegador, como en el menú de tema, y se aplica al
  // instante: la bienvenida sigue el tema elegido, así se ve antes de entrar.

  private readonly theme = inject(ThemeService);
  protected readonly opcionesObjetivo = OPCIONES_OBJETIVO;
  protected readonly opcionesTema = OPCIONES_TEMA;
  protected readonly tema = this.theme.tema;
  /** El aviso de cómo se usan los datos (habeas data), abierto o cerrado. */
  protected readonly avisoDatos = signal(false);
  /** Lo guardado, o el nombre de pila que trae la cuenta de Google. */
  protected readonly nombre = linkedSignal(
    () => this.bienvenida.nombre() ?? this.auth.nombreDePila() ?? '',
  );
  /** Arranca con lo que ya eligió, si vuelve a pasar por acá. */
  protected readonly objetivos = linkedSignal<ReadonlySet<Objetivo>>(
    () => new Set(this.bienvenida.objetivos()),
  );

  protected alternarObjetivo(objetivo: Objetivo): void {
    const elegidos = new Set(this.objetivos());
    if (!elegidos.delete(objetivo)) elegidos.add(objetivo);
    this.objetivos.set(elegidos);
  }

  protected elegirTema(tema: Tema): void {
    this.theme.fijar(tema);
  }

  /** Los objetivos van en el orden de las opciones, no en el que se tocaron. */
  protected guardarCaracterizacion(): void {
    const elegidos = this.objetivos();
    this.bienvenida.guardarCaracterizacion({
      nombre: this.nombre().trim() || null,
      objetivos: OPCIONES_OBJETIVO.map((o) => o.valor).filter((o) => elegidos.has(o)),
    });
    this.siguiente();
  }

  // ──────────────────────────── crear la cuenta ────────────────────────────
  // Solo con sesión anónima (entró por "Regístrate"): el último paso
  // convierte esa sesión en una cuenta, con el mismo uid y los mismos datos.

  protected readonly correo = signal('');
  protected readonly clave = signal('');

  protected async crearConCorreo(): Promise<void> {
    const email = this.correo().trim();
    if (!email || this.clave().length < 6 || this.auth.iniciandoSesion()) return;
    if (await this.auth.crearCuentaConCorreo(email, this.clave())) this.irAGeneral();
  }

  protected async crearConGoogle(): Promise<void> {
    if (this.auth.iniciandoSesion()) return;
    if (await this.auth.crearCuentaConGoogle()) this.irAGeneral();
  }

  protected irAGeneral(): void {
    // Terminó sin crear ninguna cuenta: cuenta como saltar el recorrido, si
    // no `sinRecorridoPendiente` lo devolvería acá.
    if (this.bienvenida.faltaCuenta()) this.bienvenida.ocultar();
    void this.router.navigate(['/general']);
  }

  // ─────────────────────────────── 2. cuenta ───────────────────────────────

  protected readonly tiposCuenta = TIPOS_CUENTA;
  protected readonly atajosSaldo = ATAJOS_SALDO;
  protected readonly tipoCuenta = signal<TipoCuenta>('BANCO');
  protected readonly nombreCuenta = signal('');
  protected readonly saldo = signal(0);
  protected readonly ejemploCuenta = computed(
    () => TIPOS_CUENTA.find((t) => t.valor === this.tipoCuenta())!.ejemplo,
  );

  protected crearCuenta(): void {
    if (this.cuenta()) {
      this.siguiente();
      return;
    }
    if (this.saldo() <= 0 || this.guardando()) return;
    const nombre = this.nombreCuenta().trim() || this.ejemploCuenta();
    const tipo = this.tipoCuenta();
    this.guardar(
      this.cuentasApi.crear({
        tipo,
        nombre,
        entidad: tipo === 'BANCO' || tipo === 'BILLETERA' ? nombre : undefined,
        color: COLOR_POR_TIPO[tipo],
        saldoInicial: this.saldo(),
        sumaEnDisponible: true,
      }),
    );
  }

  // ───────────────────────────── 3. categorías ─────────────────────────────

  /** Ocultas mientras se eligen; se guardan al continuar. */
  private readonly ocultasElegidas = signal<ReadonlySet<string> | null>(null);
  protected readonly ocultas = computed(
    () =>
      this.ocultasElegidas() ??
      new Set(
        this.categorias()
          .filter((c) => c.archivada)
          .map((c) => c.id),
      ),
  );
  protected readonly categoriasGasto = computed(() =>
    this.categorias().filter((c) => c.tipo === 'GASTO'),
  );
  protected readonly categoriasIngreso = computed(() =>
    this.categorias().filter((c) => c.tipo === 'INGRESO'),
  );
  protected readonly activas = computed(
    () => this.categorias().filter((c) => !this.ocultas().has(c.id)).length,
  );

  protected alternarCategoria(id: string): void {
    const ocultas = new Set(this.ocultas());
    if (ocultas.has(id)) ocultas.delete(id);
    else ocultas.add(id);
    this.ocultasElegidas.set(ocultas);
  }

  protected guardarCategorias(): void {
    const cambios = this.categorias().filter((c) => c.archivada !== this.ocultas().has(c.id));
    if (cambios.length === 0) {
      this.omitir('categorias');
      return;
    }
    for (const c of cambios) {
      this.categoriasApi.actualizar(c.id, { archivada: !c.archivada }).subscribe({
        error: (error) => mostrarErrorGuardado(this.snackBar, error),
      });
    }
    this.siguiente();
  }

  // ────────────────────────────── 4. créditos ──────────────────────────────

  protected readonly tiposCredito = TIPOS_CREDITO;
  protected readonly grupoCredito = signal<GrupoCredito>('TARJETA');
  protected readonly nombreGrupo = computed(
    () => TIPOS_CREDITO.find((t) => t.valor === this.grupoCredito())!.nombre,
  );

  // Respuestas del formulario corto; cada tipo usa solo las suyas.
  protected readonly nombreCredito = signal('');
  protected readonly cupoCredito = signal(0);
  protected readonly montoCredito = signal(0);
  protected readonly plazoCredito = signal('12');
  protected readonly pagadasCredito = signal('0');
  protected readonly tasaCredito = signal('');
  protected readonly diaPagoCredito = signal('15');
  protected readonly diaCorteCredito = signal('20');

  protected readonly ejemploCredito = computed(
    () => TIPOS_CREDITO.find((t) => t.valor === this.grupoCredito())!.ejemplo,
  );

  /** Tasa escrita como "21,5" o "21.5"; `null` si no es un número. */
  private readonly tasa = computed(() => {
    const valor = Number(this.tasaCredito().replace(',', '.'));
    return this.tasaCredito().trim() && Number.isFinite(valor) && valor >= 0 ? valor : null;
  });

  protected readonly creditoListo = computed(() => {
    switch (this.grupoCredito()) {
      case 'TARJETA':
      case 'PLATAFORMA':
        return this.cupoCredito() > 0;
      case 'BANCO':
        return (
          this.montoCredito() > 0 &&
          this.entero(this.plazoCredito(), 600) > 0 &&
          this.tasa() !== null
        );
      case 'PERSONA':
        return this.montoCredito() > 0;
    }
  });

  /** Los créditos ya agregados, con su cuota de este mes si tiene. */
  protected readonly creditosAgregados = computed(() =>
    this.creditos()
      .filter((c) => !c.archivado)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: TIPOS_CREDITO.find((t) => t.valor === c.grupo)!.nombre,
        cuota: this.cuotasCredito().find((i) => i.nombre === c.nombre)?.monto ?? null,
      })),
  );

  protected agregarCredito(): void {
    if (!this.creditoListo() || this.guardando()) return;
    const base = {
      nombre: this.nombreCredito().trim() || this.ejemploCredito(),
      diaPago: this.entero(this.diaPagoCredito(), 31) || 15,
    };
    let datos: NuevoCredito;
    switch (this.grupoCredito()) {
      case 'TARJETA':
        datos = {
          ...base,
          grupo: 'TARJETA',
          cupo: this.cupoCredito(),
          diaCorte: this.entero(this.diaCorteCredito(), 31) || 20,
        };
        break;
      case 'PLATAFORMA':
        datos = { ...base, grupo: 'PLATAFORMA', cupo: this.cupoCredito() };
        break;
      case 'BANCO': {
        const plazo = this.entero(this.plazoCredito(), 600);
        datos = {
          ...base,
          grupo: 'BANCO',
          monto: this.montoCredito(),
          tasaEa: (this.tasa() ?? 0) / 100,
          tipoTasa: 'FIJA',
          plazoMeses: plazo,
          cuotasPagadasIniciales: Math.min(plazo, this.entero(this.pagadasCredito(), plazo)),
          seguroMensual: 0,
        };
        break;
      }
      case 'PERSONA':
        datos = { ...base, grupo: 'PERSONA', monto: this.montoCredito() };
        break;
    }
    this.guardar(this.creditosApi.crear(datos), () => {
      this.nombreCredito.set('');
      this.cupoCredito.set(0);
      this.montoCredito.set(0);
      this.pagadasCredito.set('0');
      this.tasaCredito.set('');
    });
  }

  /** Entero entre 0 y `maximo` a partir de lo escrito (0 si no hay número). */
  private entero(texto: string, maximo: number): number {
    return Math.min(maximo, Math.max(0, Math.trunc(Number(texto.replace(/\D/g, '')) || 0)));
  }

  // ────────────────────────────── 5. pagos fijos ──────────────────────────────

  protected readonly sugerencias = SUGERENCIAS_PAGO;
  protected readonly nombrePago = signal('');
  protected readonly montoPago = signal(0);
  protected readonly diaPago = signal('');

  protected agregarPago(): void {
    const cuenta = this.cuenta();
    const nombre = this.nombrePago().trim();
    if (!cuenta || !nombre || this.montoPago() <= 0 || this.guardando()) return;
    const sugerencia = SUGERENCIAS_PAGO.find((s) => s.nombre === nombre);
    this.guardar(
      this.pagosFijosApi.crear({
        nombre,
        categoriaId: sugerencia?.categoriaId ?? 'cat-otros-gastos',
        diaLimite: Math.min(31, Math.max(1, Number(this.diaPago()) || 1)),
        monto: this.montoPago(),
        esVariable: false,
        frecuencia: 'MENSUAL',
        mesInicio: 1,
        cuentaDefaultId: cuenta.id,
        activo: true,
      }),
      () => {
        this.nombrePago.set('');
        this.montoPago.set(0);
        this.diaPago.set('');
      },
    );
  }

  protected quitarPago(pago: PagoFijo): void {
    this.pagosFijosApi.actualizar(pago.id, { activo: false }).subscribe({
      error: (error) => mostrarErrorGuardado(this.snackBar, error),
    });
  }

  // ───────────────────────────── 6. movimiento ─────────────────────────────

  protected readonly tipoMovimiento = signal<'GASTO' | 'INGRESO'>('GASTO');
  protected readonly montoMovimiento = signal(0);
  private readonly categoriaElegida = signal<string | null>(null);
  protected readonly categoriasMovimiento = computed(() =>
    this.categorias().filter((c) => c.tipo === this.tipoMovimiento() && !this.ocultas().has(c.id)),
  );
  /** La elegida si sigue disponible; si no, la primera del tipo. */
  protected readonly categoriaMovimiento = computed<Categoria | undefined>(() => {
    const opciones = this.categoriasMovimiento();
    return opciones.find((c) => c.id === this.categoriaElegida()) ?? opciones[0];
  });

  protected elegirTipoMovimiento(tipo: 'GASTO' | 'INGRESO'): void {
    this.tipoMovimiento.set(tipo);
    this.categoriaElegida.set(null);
  }

  protected elegirCategoria(id: string): void {
    this.categoriaElegida.set(id);
  }

  protected registrar(): void {
    const cuenta = this.cuenta();
    const categoria = this.categoriaMovimiento();
    if (!cuenta || !categoria || this.montoMovimiento() <= 0 || this.guardando()) return;
    const esGasto = this.tipoMovimiento() === 'GASTO';
    this.guardar(
      this.movimientosApi.crear({
        fecha: fechaIsoDesdeLocal(new Date()),
        tipo: this.tipoMovimiento(),
        monto: this.montoMovimiento(),
        descripcion: categoria.nombre,
        categoriaId: categoria.id,
        cuentaOrigenId: esGasto ? cuenta.id : undefined,
        cuentaDestinoId: esGasto ? undefined : cuenta.id,
      }),
    );
  }

  // ─────────────────────────────── 7. resumen ───────────────────────────────

  protected readonly resumen = computed(() => {
    const cuenta = this.cuenta();
    const primerMovimiento = this.movimientos().find(
      (m) => m.tipo === 'GASTO' || m.tipo === 'INGRESO',
    );
    const ocultas = this.categorias().filter((c) => c.archivada).length;
    return [
      { titulo: 'Cuenta creada', detalle: cuenta ? cuenta.nombre : 'Sin cuenta' },
      {
        titulo: 'Categorías',
        detalle: ocultas
          ? `${this.categorias().length - ocultas} activas`
          : 'Las que vienen, sin cambios',
      },
      {
        titulo: 'Tarjetas y créditos',
        detalle: this.creditos().length
          ? `${this.creditos().length} ${this.creditos().length === 1 ? 'agregado' : 'agregados'}`
          : 'Sin deudas',
      },
      {
        titulo: 'Pagos fijos',
        detalle: this.pagosActivos().length
          ? `${this.pagosActivos().length} al mes`
          : 'Sin pagos fijos',
      },
      {
        titulo: 'Primer movimiento',
        detalle: primerMovimiento
          ? `${primerMovimiento.tipo === 'GASTO' ? 'Gasto' : 'Ingreso'} registrado`
          : 'Sin registrar',
      },
    ];
  });

  // ─────────────────────────────── utilidades ───────────────────────────────

  /** Solo dígitos: "1.500.000" → 1500000. */
  protected numero(texto: string): number {
    return Number(texto.replace(/\D/g, '').slice(0, 12)) || 0;
  }

  protected miles(valor: number): string {
    return valor ? valor.toLocaleString('es-CO') : '';
  }

  /** El monto como se ve en un campo: "$ 1.500.000", vacío si es 0. */
  protected plata(valor: number): string {
    return valor ? `$ ${this.miles(valor)}` : '';
  }

  /** Día del mes: hasta 2 dígitos y nunca más de 31. */
  private soloDia(texto: string): string {
    const digitos = texto.replace(/\D/g, '').slice(0, 2);
    return digitos && Number(digitos) > 31 ? '31' : digitos;
  }

  /**
   * Los campos de día y de plata se limpian mientras se escribe. Hay que
   * reescribir el campo a mano: si lo limpio da lo mismo que ya había
   * (otra letra, un tercer dígito), el signal no cambia, Angular no repinta
   * y lo escrito se quedaba en pantalla ("3322" en el día).
   */
  protected leerDia(evento: Event, destino: WritableSignal<string>): void {
    const campo = evento.target as HTMLInputElement;
    const dia = this.soloDia(campo.value);
    campo.value = dia;
    destino.set(dia);
  }

  protected leerMonto(evento: Event, destino: WritableSignal<number>): void {
    const campo = evento.target as HTMLInputElement;
    const valor = this.numero(campo.value);
    campo.value = this.plata(valor);
    destino.set(valor);
  }

  /** "Dejarlas así" / "No tengo deudas": lo recuerda la bienvenida y sigue. */
  protected omitir(id: string): void {
    const paso = PASOS_BIENVENIDA.find((p) => p.id === id);
    if (paso) this.bienvenida.omitir(paso);
    this.siguiente();
  }

  /**
   * Guarda y, si salió bien, avanza (o corre `alTerminar`). Las escrituras
   * resuelven en cuanto quedan en el dispositivo, así que esto es casi
   * instantáneo aun sin señal.
   */
  private guardar(accion$: Observable<unknown>, alTerminar?: () => void): void {
    this.guardando.set(true);
    accion$.subscribe({
      next: () => {
        this.guardando.set(false);
        if (alTerminar) alTerminar();
        else this.siguiente();
      },
      error: (error) => {
        this.guardando.set(false);
        mostrarErrorGuardado(this.snackBar, error);
      },
    });
  }
}
