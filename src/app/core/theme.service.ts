import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

/**
 * Las cinco paletas de la app. Cada una existe en modo claro y en modo
 * oscuro: el tema (la paleta) y el modo se eligen por separado. Los valores
 * son los del atributo `data-theme` de `<html>`.
 */
export type Tema = 'teal' | 'neutro' | 'medianoche' | 'brasa' | 'marino';

/** Valor del atributo `data-modo` de `<html>`. */
export type Modo = 'claro' | 'oscuro';

export interface OpcionTema {
  id: Tema;
  nombre: string;
}

export interface OpcionModo {
  id: Modo;
  nombre: string;
  icono: string;
}

export const OPCIONES_TEMA: readonly OpcionTema[] = [
  { id: 'teal', nombre: 'Teal' },
  { id: 'neutro', nombre: 'Neutro' },
  { id: 'medianoche', nombre: 'Medianoche' },
  { id: 'brasa', nombre: 'Brasa' },
  { id: 'marino', nombre: 'Marino' },
];

export const OPCIONES_MODO: readonly OpcionModo[] = [
  { id: 'claro', nombre: 'Claro', icono: 'light_mode' },
  { id: 'oscuro', nombre: 'Oscuro', icono: 'dark_mode' },
];

const TEMA_POR_DEFECTO: Tema = 'teal';
const MODO_POR_DEFECTO: Modo = 'claro';

// Si cambias estas claves, cambia también el script inline de `index.html`
// (aplica el tema guardado antes del primer pintado, no puede importar
// estas constantes — corre antes de que exista cualquier bundle de Angular).
const CLAVE_TEMA = 'finanzas.tema';
const CLAVE_MODO = 'finanzas.modo';

/** Color de la barra de estado del teléfono para cada tema y modo: el de la página. */
const COLOR_BARRA: Record<Tema, Record<Modo, string>> = {
  teal: { claro: '#f6f8f9', oscuro: '#0b1213' },
  neutro: { claro: '#f5f5f5', oscuro: '#0e0e0e' },
  medianoche: { claro: '#f5f5f7', oscuro: '#0e0e0e' },
  brasa: { claro: '#f6f5fa', oscuro: '#181824' },
  marino: { claro: '#f8f9fb', oscuro: '#07182a' },
};

/**
 * Tema y modo elegidos a mano desde el menú del `Shell`, guardados en
 * `localStorage` para que sobrevivan a un recargo. Sin elección, Teal claro:
 * es el tema de la app y no se sigue al sistema operativo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly elegidoTema = signal<Tema>(
    this.leerGuardado(CLAVE_TEMA, OPCIONES_TEMA) ?? TEMA_POR_DEFECTO,
  );
  private readonly elegidoModo = signal<Modo>(
    this.leerGuardado(CLAVE_MODO, OPCIONES_MODO) ?? MODO_POR_DEFECTO,
  );

  /**
   * Pantallas que se ven siempre en Teal claro (el login): son la cara de la
   * marca y se diseñaron solo así. Contador y no booleano porque al navegar
   * la pantalla nueva se crea antes de que la anterior se destruya.
   */
  private readonly pantallasSoloClaro = signal(0);

  /**
   * Pantallas que respetan el tema elegido pero siempre en modo claro (la
   * bienvenida: se diseñó en claro y es donde se elige el tema).
   */
  private readonly pantallasModoClaro = signal(0);

  /** Lo que eligió el usuario, no lo que se ve ahora mismo. */
  readonly tema = this.elegidoTema.asReadonly();
  readonly modo = this.elegidoModo.asReadonly();

  /** El modo que se ve ahora: igual al elegido salvo en las pantallas que fuerzan claro. */
  private readonly modoEfectivo = computed<Modo>(() =>
    this.pantallasSoloClaro() > 0 || this.pantallasModoClaro() > 0 ? 'claro' : this.elegidoModo(),
  );
  private readonly temaEfectivo = computed<Tema>(() =>
    this.pantallasSoloClaro() > 0 ? 'teal' : this.elegidoTema(),
  );

  readonly oscuro = computed(() => this.modoEfectivo() === 'oscuro');

  /**
   * Cambia con cualquier cambio de lo que se ve (tema o modo). Lo leen las
   * gráficas, que pintan con valores de color y no con `var(--x)`, para
   * volver a leer los tokens: `oscuro` no basta, porque pasar de Teal claro
   * a Brasa claro cambia los colores sin cambiar el modo.
   */
  readonly huella = computed(() => `${this.temaEfectivo()}-${this.modoEfectivo()}`);

  constructor() {
    effect(() => this.aplicarAlDocumento(this.temaEfectivo(), this.modoEfectivo()));
  }

  /** Fuerza Teal claro mientras viva la pantalla que lo llama (en su contexto de inyección). */
  soloClaro(): void {
    this.pantallasSoloClaro.update((n) => n + 1);
    inject(DestroyRef).onDestroy(() => this.pantallasSoloClaro.update((n) => n - 1));
  }

  /** Fuerza el modo claro, con el tema elegido, mientras viva la pantalla que lo llama. */
  soloModoClaro(): void {
    this.pantallasModoClaro.update((n) => n + 1);
    inject(DestroyRef).onDestroy(() => this.pantallasModoClaro.update((n) => n - 1));
  }

  fijar(tema: Tema): void {
    this.elegidoTema.set(tema);
    this.guardar(CLAVE_TEMA, tema);
  }

  fijarModo(modo: Modo): void {
    this.elegidoModo.set(modo);
    this.guardar(CLAVE_MODO, modo);
  }

  private aplicarAlDocumento(tema: Tema, modo: Modo): void {
    const raiz = document.documentElement;
    raiz.setAttribute('data-theme', tema);
    raiz.setAttribute('data-modo', modo);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', COLOR_BARRA[tema][modo]);
  }

  private leerGuardado<T extends string>(
    clave: string,
    opciones: readonly { id: T }[],
  ): T | null {
    try {
      const valor = localStorage.getItem(clave);
      return opciones.some((o) => o.id === valor) ? (valor as T) : null;
    } catch {
      return null; // Safari privado / storage bloqueado: el de por defecto, sin romper.
    }
  }

  private guardar(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // Sin persistencia entre recargas, pero el cambio sigue funcionando en esta sesión.
    }
  }
}
