import type { WritableSignal } from '@angular/core';
import type { MatSnackBar } from '@angular/material/snack-bar';
import type { Observable } from 'rxjs';

const DURACION_EXITO = 3000;
const DURACION_ERROR = 4000;
const MENSAJE_ERROR = 'No se pudo guardar. Intenta de nuevo.';

/**
 * Alerta de error uniforme para cualquier guardado fallido — usada por
 * `guardarConFeedback` y por los formularios con guardados encadenados
 * (`movimiento-form`, que no encaja en `guardarConFeedback` por tener más
 * de un paso). El detalle técnico solo va a la consola: al usuario no le
 * sirve un mensaje de Firestore, y podría revelar de más.
 */
export function mostrarErrorGuardado(snackBar: MatSnackBar, error: unknown): void {
  console.error('Error al guardar', error);
  snackBar.open(MENSAJE_ERROR, undefined, { duration: DURACION_ERROR });
}

/**
 * Estándar de "guardar" para cualquier formulario (crear/editar): prende
 * `guardando` — el botón se deshabilita y muestra su `.spinner` — y al
 * terminar muestra una alerta, de éxito (corre `alExito`, normalmente
 * cerrar el diálogo) o de error (sin cerrar nada, para poder reintentar).
 *
 * Antes cada formulario llamaba `.subscribe(() => {...})` a mano, con un
 * solo callback y sin manejar el error: si el guardado fallaba (permisos
 * de Firestore, red...), ese callback nunca corría, `guardando` se
 * quedaba en `true` para siempre y el formulario no se cerraba ni avisaba
 * nada (un guardado en Firestore sí puede fallar).
 */
export function guardarConFeedback<T>(
  snackBar: MatSnackBar,
  guardando: WritableSignal<boolean>,
  accion$: Observable<T>,
  mensajeExito: string,
  alExito?: (valor: T) => void,
): void {
  guardando.set(true);
  accion$.subscribe({
    next: (valor) => {
      guardando.set(false);
      snackBar.open(mensajeExito, undefined, { duration: DURACION_EXITO });
      alExito?.(valor);
    },
    error: (error: unknown) => {
      guardando.set(false);
      mostrarErrorGuardado(snackBar, error);
    },
  });
}
