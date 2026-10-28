import type { AbstractControl } from '@angular/forms';

/**
 * Un campo se marca inválido solo después de que el usuario lo tocó (o se
 * intentó enviar el formulario, que marca todo como touched) — no antes,
 * para no recibir con errores en rojo a alguien que recién abrió el
 * formulario.
 */
export function campoInvalido(control: AbstractControl | null | undefined): boolean {
  return !!control && control.invalid && (control.dirty || control.touched);
}
