/**
 * Código de un error de Supabase Auth (`email_exists`, `weak_password`…), o
 * `undefined` si el error no trae uno. Un fallo de red no trae código: se
 * reporta como `network_error` para poder darle su propio mensaje.
 */
export function codigoDeError(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string' && error.code) return error.code;
  if ('name' in error && error.name === 'AuthRetryableFetchError') return 'network_error';
  return undefined;
}

/** La persona canceló en la pantalla de Google: no es un error. */
const CANCELADO = new Set(['access_denied']);

/**
 * Qué decirle a la persona cuando falla entrar o vincular con Google.
 * `null` = no decir nada (canceló ella misma). El detalle técnico no se
 * muestra: va a la consola desde `AuthService`, igual que los guardados
 * fallidos (ver `mostrarErrorGuardado`).
 */
export function mensajeErrorGoogle(
  codigo: string | undefined,
  operacion: 'entrar' | 'vincular' | 'crear',
): string | null {
  if (codigo && CANCELADO.has(codigo)) return null;
  switch (codigo) {
    case 'network_error':
      return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
    case 'provider_disabled':
    case 'manual_linking_disabled':
      return 'El acceso con Google todavía no está habilitado.';
    case 'email_exists':
      return 'Ya hay una cuenta con ese correo. Entra con tu correo y contraseña, y vincula Google desde el menú de tu cuenta.';
    case 'identity_already_exists':
      return operacion === 'crear'
        ? 'Esa cuenta de Google ya está registrada. Usa otra, o crea la cuenta con correo y contraseña.'
        : 'Esa cuenta de Google ya tiene su propio usuario en la app, así que no se puede vincular a este.';
  }
  if (operacion === 'entrar') return 'No se pudo entrar con Google. Intenta de nuevo.';
  if (operacion === 'crear') return 'No se pudo crear la cuenta con Google. Intenta de nuevo.';
  return 'No se pudo vincular Google. Intenta de nuevo.';
}

/** Qué decir cuando falla crear la cuenta con correo y contraseña, o empezar el registro. */
export function mensajeErrorCrearCuenta(codigo: string | undefined): string {
  switch (codigo) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return 'Ese correo ya tiene cuenta. Usa otro, o entra con él desde el inicio.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Ese correo no es válido.';
    case 'weak_password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'network_error':
      return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.';
    case 'anonymous_provider_disabled':
    case 'email_provider_disabled':
    case 'signup_disabled':
      return 'El registro todavía no está habilitado.';
  }
  return 'No se pudo crear la cuenta. Intenta de nuevo.';
}
