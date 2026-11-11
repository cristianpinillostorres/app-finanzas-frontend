import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import { avanceDelCiclo } from '../../core/domain/ciclo-pago';
import { PREFERENCIAS_INICIALES } from '../../core/models';
import { OPCIONES_OBJETIVO } from '../../shared/bienvenida/pasos-bienvenida';
import { AuthService } from '../../core/auth/auth.service';
import { OPCIONES_TEMA, ThemeService } from '../../core/theme.service';
import { BienvenidaService } from '../../shared/bienvenida/bienvenida.service';
import { GuiaPaso } from '../../shared/bienvenida/guia-paso';
import { MontosVisibilityService } from '../../core/montos-visibility.service';
import { AccionesEscritorioService } from '../acciones-escritorio.service';
import { HeaderActionService } from '../header-action.service';
import { HeaderSearchService } from '../header-search.service';
import { NAV_ITEMS } from '../nav/nav-items';
import { NuevoMovimientoService } from '../nuevo-movimiento/nuevo-movimiento.service';
import { ViewportService } from '../services/viewport.service';

/**
 * Layout de la app: tabs arriba en escritorio, barra inferior en móvil, y el
 * botón de nuevo movimiento visible en todas las tabs (ver notas de
 * navegación en `notas-app-finanzas.md`). El botón de ocultar montos vive
 * acá porque aplica a todas las pantallas, no solo a General.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    GuiaPaso,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly navItems = NAV_ITEMS;
  /** La barra de abajo del celular: solo lo que cabe en cinco lugares. */
  protected readonly navItemsMovil = NAV_ITEMS.filter((item) => !item.soloEscritorio);
  // Se crea con el shell para que el modo fijado (en Configuración o en el menú
  // de la cuenta) se aplique, barra del navegador incluida, en cualquier pantalla.
  protected readonly tema = inject(ThemeService);
  protected readonly opcionesTema = OPCIONES_TEMA;
  protected readonly viewport = inject(ViewportService);
  protected readonly montos = inject(MontosVisibilityService);
  protected readonly accionPantalla = inject(HeaderActionService).accion;
  protected readonly headerSearch = inject(HeaderSearchService);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);
  private readonly auth = inject(AuthService);
  protected readonly bienvenida = inject(BienvenidaService);

  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Rutas que se dibujan sin el marco de la app (menú, cabezote, "+"). */
  protected readonly pantallaCompleta = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/bienvenida')),
      startWith(this.router.url.startsWith('/bienvenida')),
    ),
    { initialValue: false },
  );

  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');
  private readonly accionesEscritorio = viewChild.required<TemplateRef<unknown>>('acciones');
  private readonly acciones = inject(AccionesEscritorioService);

  /** Nombre de la sección actual, para el header móvil. */
  protected readonly tituloPantalla = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => this.tituloDesdeUrl(evento.urlAfterRedirects)),
      startWith(this.tituloDesdeUrl(this.router.url)),
    ),
    { initialValue: '' },
  );


  private readonly preferencias = toSignal(inject(PREFERENCIAS_API).obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  /** El enfoque que eligió (cambiarlo es en Configuración), o `null` si no eligió. */
  protected readonly enfoque = computed(
    () => OPCIONES_OBJETIVO.find((o) => o.valor === this.preferencias().objetivoPrincipal) ?? null,
  );

  /** Dónde va el ciclo de pago; sin día de pago no hay ciclo que mostrar. */
  protected readonly ciclo = computed(() => {
    const dia = this.preferencias().diaDePago;
    if (dia === null) return null;
    const avance = avanceDelCiclo(new Date(), dia);
    return { ...avance, porcentaje: Math.min(100, Math.round((avance.dia / avance.duracion) * 100)) };
  });

  protected readonly tituloOjo = computed(() =>
    this.montos.oculto() ? 'Mostrar montos' : 'Ocultar montos',
  );

  /** Correo de la sesión, para el avatar y el menú de la cuenta en escritorio. */
  protected readonly correoUsuario = this.auth.email;
  protected readonly inicialUsuario = computed(() =>
    (this.correoUsuario() ?? '?').trim().charAt(0).toUpperCase(),
  );

  constructor() {
    // Autofocus imperativo: la barra de búsqueda entra/sale con `@if`, así
    // que el `<input>` es un nodo nuevo cada vez que `abierta()` pasa a
    // `true` — el atributo `autofocus` no es confiable ahí en todos los
    // navegadores (piensa en "carga inicial de página", no en "nodo recién
    // insertado").
    effect(() => {
      if (this.headerSearch.abierta()) this.campoBusqueda()?.nativeElement.focus();
    });

    // En escritorio los botones globales van en la fila del título de cada
    // pantalla (ver `PageHead`); en el teléfono ya están en el header.
    effect(() => {
      this.acciones.establecer(this.viewport.esMovil() ? null : this.accionesEscritorio());
    });

    // Sin ninguna cuenta y sin haber saltado el recorrido, el lugar es la
    // bienvenida, se llegue como se llegue. `sinRecorridoPendiente` y
    // `App.decidirDestino` lo deciden antes de dibujar, pero dejan pasar si
    // los datos tardan (al entrar después de cerrar sesión la caché está
    // vacía); esto lo corrige en cuanto llegan, y cubre cualquier camino.
    effect(() => {
      if (this.bienvenida.faltaCuenta() && !this.pantallaCompleta()) {
        void this.router.navigate(['/bienvenida'], { replaceUrl: true });
      }
    });

    // Resultado de "Vincular con Google". Llega por signal y no como
    // retorno de `vincularGoogle()` porque en la app instalada el vínculo
    // va por redirección: la página se recarga y el resultado aparece
    // recién al volver (ver `AuthService.recogerRedireccion`).
    effect(() => {
      const aviso = this.auth.aviso();
      if (!aviso) return;
      this.snackBar.open(aviso, undefined, { duration: 4000 });
      this.auth.descartarAviso();
    });
  }

  abrirNuevoMovimiento(): void {
    if (this.bienvenida.faltaCuenta()) {
      this.bienvenida.avisarBloqueo();
      return;
    }
    this.nuevoMovimiento.abrir();
  }

  /** Click en una sección bloqueada por el recorrido: en vez de nada, dice qué falta. */
  protected alTocarSeccion(path: string): void {
    if (this.bienvenida.seccionBloqueada(path)) this.bienvenida.avisarBloqueo();
  }

  private tituloDesdeUrl(url: string): string {
    const segmento = url.split('/').filter(Boolean)[0] ?? '';
    // Categorías no es tab (vive en el menú de Cuenta), pero el header
    // móvil igual necesita su título.
    if (segmento === 'categorias') return 'Categorías';
    if (segmento === 'configuracion') return 'Configuración';
    return this.navItems.find((item) => item.path === segmento)?.label ?? '';
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
