import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

/**
 * Los tres temas de la app. Los valores son los del atributo `data-theme`
 * (históricos: 'claro' es Teal y 'oscuro' es Medianoche), así una
 * preferencia guardada antes de existir Neutro sigue valiendo.
 */
export type Tema = 'claro' | 'neutro' | 'oscuro';

export interface OpcionTema {
  id: Tema;
  nombre: string;
}

export const OPCIONES_TEMA: readonly OpcionTema[] = [
  { id: 'claro', nombre: 'Teal' },
  { id: 'neutro', nombre: 'Neutro' },
  { id: 'oscuro', nombre: 'Medianoche' },
];

// Si cambias esta clave, cambia también el script inline de `index.html`
// (aplica el tema guardado antes del primer pintado, no puede importar
// esta constante — corre antes de que exista cualquier bundle de Angular).
const CLAVE_ALMACENAMIENTO = 'finanzas.tema';

/** Color de la barra de estado del teléfono para cada tema: el de la página. */
const COLOR_BARRA: Record<Tema, string> = {
  claro: '#f6f8f9',
  neutro: '#f5f5f5',
  oscuro: '#0e0e0e',
};

/**
 * Tema elegido a mano desde el botón de tema del `Shell`, guardado en
 * `localStorage` para que sobreviva a un recargo. Sin elección, Teal: es el
 * tema de la app y no se sigue al sistema operativo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly elegido = signal<Tema>(this.leerGuardado() ?? 'claro');

  /**
   * Pantallas que se ven siempre en Teal (login y bienvenida): son la
   * cara de la marca y se diseñaron solo en claro. Contador y no booleano
   * porque al ir del login a la bienvenida la nueva se crea antes de que
   * la anterior se destruya.
   */
  private readonly pantallasSoloClaro = signal(0);

  readonly tema = this.elegido.asReadonly();
  readonly oscuro = computed(() => this.elegido() === 'oscuro');

  constructor() {
    effect(() => this.aplicarAlDocumento(this.pantallasSoloClaro() > 0 ? 'claro' : this.elegido()));
  }

  /** Fuerza Teal mientras viva la pantalla que lo llama (en su contexto de inyección). */
  soloClaro(): void {
    this.pantallasSoloClaro.update((n) => n + 1);
    inject(DestroyRef).onDestroy(() => this.pantallasSoloClaro.update((n) => n - 1));
  }

  fijar(tema: Tema): void {
    this.elegido.set(tema);
    this.guardar(tema);
  }

  private aplicarAlDocumento(tema: Tema): void {
    document.documentElement.setAttribute('data-theme', tema);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', COLOR_BARRA[tema]);
  }

  private leerGuardado(): Tema | null {
    try {
      const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      return OPCIONES_TEMA.some((o) => o.id === valor) ? (valor as Tema) : null;
    } catch {
      return null; // Safari privado / storage bloqueado: Teal, sin romper.
    }
  }

  private guardar(tema: Tema): void {
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, tema);
    } catch {
      // Sin persistencia entre recargas, pero el cambio sigue funcionando en esta sesión.
    }
  }
}
