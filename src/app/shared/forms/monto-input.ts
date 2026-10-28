import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const FORMATO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** 13 dígitos: billones de pesos, más de lo que cabe en cualquier monto real. */
const MAX_DIGITOS = 13;

/**
 * Campo de monto en pesos con separador de miles mientras se escribe:
 * "1.800.000" en vez de "1800000". Con cifras de hasta 12 dígitos, contar
 * ceros a ojo es como se cuela un cero de más o de menos. El control sigue
 * guardando un número (o `null` si está vacío), así que los validadores
 * (`required`, `min`) no cambian.
 *
 * Es `type="text"` con `inputmode="numeric"`: `type="number"` no admite
 * los puntos de miles, y el teclado numérico sigue saliendo en el celular.
 */
@Directive({
  selector: 'input[appMonto]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MontoInput), multi: true },
  ],
  host: {
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    '(input)': 'alEscribir()',
    '(blur)': 'alTocar()',
  },
})
export class MontoInput implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private alCambiar: (valor: number | null) => void = () => {};
  protected alTocar: () => void = () => {};

  writeValue(valor: number | null | undefined): void {
    this.input.value = valor === null || valor === undefined ? '' : FORMATO.format(valor);
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.input.disabled = deshabilitado;
  }

  protected alEscribir(): void {
    const texto = this.input.value;
    // El cursor se conserva contando desde el final: al agregar un punto de
    // miles el texto crece por la izquierda, no por donde se está escribiendo.
    const desdeElFinal = texto.length - (this.input.selectionStart ?? texto.length);
    const digitos = texto
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '')
      .slice(0, MAX_DIGITOS);
    const valor = digitos ? Number(digitos) : null;
    const formateado = valor === null ? '' : FORMATO.format(valor);

    this.input.value = formateado;
    const posicion = Math.max(0, formateado.length - desdeElFinal);
    this.input.setSelectionRange(posicion, posicion);
    this.alCambiar(valor);
  }
}
