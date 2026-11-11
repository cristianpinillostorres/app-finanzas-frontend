import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';

/** Las tres opciones de apariencia, con su rótulo e ícono: una sola lista para el menú de la cuenta y Configuración. */
export const OPCIONES_TEMA: readonly { valor: PreferenciaTema; nombre: string; icono: string }[] = [
  { valor: 'sistema', nombre: 'Sistema', icono: 'brightness_auto' },
  { valor: 'claro', nombre: 'Claro', icono: 'light_mode' },
  { valor: 'oscuro', nombre: 'Oscuro', icono: 'dark_mode' },
];

const CLAVE = 'finanzas.tema';
/** Fondo de la página en cada modo, para la barra del navegador (ver `index.html`). */
const COLOR_BARRA = { claro: '#ffffff', oscuro: '#11212d' } as const;

function leerGuardada(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema';
  } catch {
    return 'sistema';
  }
}

/**
 * La app tiene un solo estilo, el de la marca, en claro y en oscuro. Por
 * defecto lo decide el sistema (`prefers-color-scheme`); quien prefiera puede
 * fijar uno desde Configuración. La elección vive en este dispositivo y se
 * aplica con `data-theme` en `<html>` (el de Marca) (ver `styles/tokens/_semanticos.scss`;
 * `index.html` la aplica antes del primer pintado para que no parpadee).
 *
 * Las gráficas pintan con valores de color y no con `var(--x)`: `huella`
 * cambia cuando el modo efectivo cambia y ellas vuelven a leer los tokens.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly consulta =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly sistemaOscuro = signal(this.consulta?.matches ?? false);

  /** Lo que eligió la persona: "sistema" si no ha elegido. */
  readonly preferencia = signal<PreferenciaTema>(leerGuardada());
  private readonly esOscuro = computed(() => {
    const preferencia = this.preferencia();
    return preferencia === 'sistema' ? this.sistemaOscuro() : preferencia === 'oscuro';
  });

  /** Cambia cada vez que el modo efectivo pasa de claro a oscuro o al revés. */
  readonly huella = () => (this.esOscuro() ? 'oscuro' : 'claro');
  readonly oscuro = () => this.esOscuro();

  constructor() {
    const alCambiar = (evento: MediaQueryListEvent): void => {
      this.sistemaOscuro.set(evento.matches);
      this.aplicar();
    };
    this.consulta?.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => this.consulta?.removeEventListener('change', alCambiar));
    this.aplicar();
  }

  elegir(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
    try {
      if (preferencia === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, preferencia);
    } catch {
      // Sin almacenamiento (ventana privada): el cambio vale hasta recargar.
    }
    this.aplicar();
  }

  private aplicar(): void {
    if (typeof document === 'undefined') return;
    const raiz = document.documentElement;
    const preferencia = this.preferencia();
    if (preferencia === 'sistema') raiz.removeAttribute('data-theme');
    else raiz.setAttribute('data-theme', preferencia === 'claro' ? 'light' : 'dark');

    // La barra del navegador: con el modo fijado ya no basta la media query de
    // los `<meta>`, así que se escribe el color del modo efectivo en los dos.
    const color = COLOR_BARRA[this.esOscuro() ? 'oscuro' : 'claro'];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      if (preferencia === 'sistema') {
        const original = meta.getAttribute('media')?.includes('dark')
          ? COLOR_BARRA.oscuro
          : COLOR_BARRA.claro;
        meta.setAttribute('content', original);
      } else {
        meta.setAttribute('content', color);
      }
    });
  }
}
