import { Component, computed, forwardRef, input, output, signal } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

type Valor = string | number | null;

interface OpcionSelector {
  valor: Valor;
  etiqueta: string;
  icono?: string;
}

/**
 * Reemplazo del `<select>` nativo: un campo que abre un menú de opciones
 * con el estilo de la app (el desplegable del navegador se veía como una
 * caja gris sin estilo en escritorio). Sirve con `formControlName` o, en
 * los filtros, con `[valor]` + `(cambio)`.
 *
 * Las opciones pueden ser cualquier lista de objetos: `campoValor`,
 * `campoEtiqueta` y `campoIcono` dicen de dónde sale cada cosa, y
 * `etiquetaDe` cubre el caso en que la etiqueta se calcula.
 */
@Component({
  selector: 'app-selector',
  imports: [MatIconModule, MatMenuModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Selector), multi: true }],
  template: `
    <button
      type="button"
      class="selector"
      [id]="inputId()"
      [disabled]="deshabilitado()"
      [attr.aria-invalid]="invalido() || null"
      [matMenuTriggerFor]="menu"
      (menuClosed)="alTocar()"
    >
      @if (seleccionada(); as opcion) {
        @if (opcion.icono) {
          <mat-icon class="selector__icono" aria-hidden="true">{{ opcion.icono }}</mat-icon>
        }
        <span class="selector__texto">{{ opcion.etiqueta }}</span>
      } @else {
        <span class="selector__texto selector__texto--vacio">{{ placeholder() }}</span>
      }
      <mat-icon class="selector__chevron" aria-hidden="true">expand_more</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="menu-opciones">
      @for (opcion of conTodas(); track opcion.valor) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          [attr.aria-checked]="opcion === seleccionada()"
          (click)="elegir(opcion.valor)"
        >
          @if (opcion.icono) {
            <mat-icon aria-hidden="true">{{ opcion.icono }}</mat-icon>
          }
          <span class="menu-opciones__fila">
            {{ opcion.etiqueta }}
            @if (opcion === seleccionada()) {
              <span class="material-symbols-outlined menu-opciones__check" aria-hidden="true"
                >check</span
              >
            }
          </span>
        </button>
      }
    </mat-menu>
  `,
  styleUrl: './selector.scss',
})
export class Selector implements ControlValueAccessor {
  readonly opciones = input.required<readonly unknown[]>();
  readonly campoValor = input('valor');
  readonly campoEtiqueta = input('etiqueta');
  readonly campoIcono = input<string | null>(null);
  readonly etiquetaDe = input<((opcion: never) => string) | null>(null);
  readonly placeholder = input('Elegir');
  readonly inputId = input<string | null>(null);
  readonly invalido = input(false);
  /** Primera opción que deja el valor en `null` ("Todas" en los filtros). */
  readonly opcionTodas = input<string | null>(null);
  /** Para usarlo sin formulario: el valor actual, y el aviso cuando cambia. */
  readonly valor = input<Valor | undefined>(undefined);
  readonly cambio = output<Valor>();

  private readonly valorFormulario = signal<Valor>(null);
  protected readonly deshabilitado = signal(false);
  private alCambiar: (valor: Valor) => void = () => {};
  protected alTocar: () => void = () => {};

  protected readonly valorActual = computed(() => this.valor() ?? this.valorFormulario());

  protected readonly normalizadas = computed<OpcionSelector[]>(() => {
    const etiquetaDe = this.etiquetaDe();
    const icono = this.campoIcono();
    return this.opciones().map((o) => {
      const registro = o as Record<string, unknown>;
      return {
        valor: registro[this.campoValor()] as Valor,
        etiqueta: etiquetaDe
          ? etiquetaDe(o as never)
          : String(registro[this.campoEtiqueta()] ?? ''),
        icono: icono ? (registro[icono] as string | undefined) : undefined,
      };
    });
  });

  /** Las opciones del menú, con "Todas" primero cuando la hay. */
  protected readonly conTodas = computed<OpcionSelector[]>(() => {
    const todas = this.opcionTodas();
    return todas ? [{ valor: null, etiqueta: todas }, ...this.normalizadas()] : this.normalizadas();
  });

  protected readonly seleccionada = computed(() => {
    const actual = this.valorActual();
    // Comparación como texto a propósito: un `<select>` devolvía siempre
    // texto, y algunos controles guardan el mes o las cuotas como número.
    return this.conTodas().find((o) =>
      o.valor === null
        ? actual === null && !!this.opcionTodas()
        : String(o.valor) === String(actual),
    );
  });

  protected elegir(valor: Valor): void {
    this.valorFormulario.set(valor);
    this.alCambiar(valor);
    this.cambio.emit(valor);
  }

  writeValue(valor: Valor | undefined): void {
    this.valorFormulario.set(valor ?? null);
  }

  registerOnChange(fn: (valor: Valor) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}
