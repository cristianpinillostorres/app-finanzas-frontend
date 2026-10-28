import { BreakpointObserver } from '@angular/cdk/layout';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

type Tema = 'claro' | 'oscuro';

const PREFIERE_OSCURO = '(prefers-color-scheme: dark)';
// Si cambias esta clave, cambia también el script inline de `index.html`
// (aplica el tema guardado antes del primer pintado, no puede importar
// esta constante — corre antes de que exista cualquier bundle de Angular).
const CLAVE_ALMACENAMIENTO = 'finanzas.tema';

/**
 * Tema claro/oscuro. Por defecto sigue el sistema operativo (ya lo hacía
 * `_semanticos.scss` con `prefers-color-scheme`, sin control manual — ver
 * notas del sistema de diseño); acá se agrega el override manual desde el
 * menú "···" del `Shell`, guardado en `localStorage` para que sobreviva a
 * un recargo. Sin override guardado, `oscuro()` sigue el sistema en vivo
 * (mismo patrón que `ViewportService`: `BreakpointObserver` + `toSignal`).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly prefiereOscuroSistema = toSignal(
    this.breakpointObserver.observe(PREFIERE_OSCURO).pipe(map((resultado) => resultado.matches)),
    { initialValue: this.breakpointObserver.isMatched(PREFIERE_OSCURO) },
  );

  private readonly manual = signal<Tema | null>(this.leerGuardado());

  /**
   * Pantallas que se ven siempre en claro (login y bienvenida): son la
   * cara de la marca y se diseñaron solo en claro. Contador y no booleano
   * porque al ir del login a la bienvenida la nueva se crea antes de que
   * la anterior se destruya.
   */
  private readonly pantallasSoloClaro = signal(0);

  readonly oscuro = computed(
    () => (this.manual() ?? (this.prefiereOscuroSistema() ? 'oscuro' : 'claro')) === 'oscuro',
  );

  constructor() {
    effect(() =>
      this.aplicarAlDocumento(this.pantallasSoloClaro() > 0 ? 'claro' : this.manual()),
    );
  }

  /** Fuerza el tema claro mientras viva la pantalla que lo llama (en su contexto de inyección). */
  soloClaro(): void {
    this.pantallasSoloClaro.update((n) => n + 1);
    inject(DestroyRef).onDestroy(() => this.pantallasSoloClaro.update((n) => n - 1));
  }

  alternar(): void {
    const siguiente: Tema = this.oscuro() ? 'claro' : 'oscuro';
    this.manual.set(siguiente);
    this.guardar(siguiente);
  }

  private aplicarAlDocumento(tema: Tema | null): void {
    const raiz = document.documentElement;
    if (tema === null) raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', tema);
  }

  private leerGuardado(): Tema | null {
    try {
      const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      return valor === 'claro' || valor === 'oscuro' ? valor : null;
    } catch {
      return null; // Safari privado / storage bloqueado: sigue el sistema, sin romper.
    }
  }

  private guardar(tema: Tema): void {
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, tema);
    } catch {
      // Sin persistencia entre recargas, pero el toggle sigue funcionando en esta sesión.
    }
  }
}
