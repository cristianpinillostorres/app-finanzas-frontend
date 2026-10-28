import { NgTemplateOutlet } from '@angular/common';
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

import { AuthService } from '../../core/auth/auth.service';
import { BienvenidaService } from '../../shared/bienvenida/bienvenida.service';
import { GuiaPaso } from '../../shared/bienvenida/guia-paso';
import { MontosVisibilityService } from '../../core/montos-visibility.service';
import { OPCIONES_TEMA, ThemeService } from '../../core/theme.service';
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
    NgTemplateOutlet,
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
  protected readonly viewport = inject(ViewportService);
  protected readonly montos = inject(MontosVisibilityService);
  protected readonly tema = inject(ThemeService);
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

  protected readonly tituloOjo = computed(() =>
    this.montos.oculto() ? 'Mostrar montos' : 'Ocultar montos',
  );

  protected readonly opcionesTema = OPCIONES_TEMA;

  /** Correo de la sesión, para el avatar y el menú de la cuenta en escritorio. */
  protected readonly correoUsuario = this.auth.email;
  protected readonly inicialUsuario = computed(() =>
    (this.correoUsuario() ?? '?').trim().charAt(0).toUpperCase(),
  );
  protected readonly tieneGoogle = this.auth.tieneGoogle;
  protected readonly vinculando = this.auth.vinculando;

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
    return this.navItems.find((item) => item.path === segmento)?.label ?? '';
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  vincularGoogle(): void {
    this.auth.vincularGoogle();
  }
}
