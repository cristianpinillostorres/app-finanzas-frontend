import { codigoDeError, mensajeErrorCrearCuenta, mensajeErrorGoogle } from './auth-errores';

describe('codigoDeError', () => {
  it('lee el código de un error de Supabase Auth', () => {
    expect(codigoDeError({ code: 'email_exists', message: '...' })).toBe('email_exists');
  });

  it('reporta los fallos de red como network_error', () => {
    expect(codigoDeError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe(
      'network_error',
    );
  });

  it('devuelve undefined si el error no trae código', () => {
    expect(codigoDeError(new Error('sin código'))).toBeUndefined();
    expect(codigoDeError(null)).toBeUndefined();
    expect(codigoDeError({ code: 42 })).toBeUndefined();
  });
});

describe('mensajeErrorGoogle', () => {
  it('no dice nada si la persona canceló en Google', () => {
    expect(mensajeErrorGoogle('access_denied', 'entrar')).toBeNull();
    expect(mensajeErrorGoogle('access_denied', 'vincular')).toBeNull();
  });

  it('avisa si el acceso con Google no está habilitado en Supabase', () => {
    expect(mensajeErrorGoogle('provider_disabled', 'entrar')).toContain(
      'todavía no está habilitado',
    );
    expect(mensajeErrorGoogle('manual_linking_disabled', 'vincular')).toContain(
      'todavía no está habilitado',
    );
  });

  it('explica que la cuenta de Google ya es otro usuario al vincular', () => {
    expect(mensajeErrorGoogle('identity_already_exists', 'vincular')).toContain(
      'ya tiene su propio usuario',
    );
    expect(mensajeErrorGoogle('identity_already_exists', 'crear')).toContain('ya está registrada');
  });

  it('cae en un mensaje genérico según la operación', () => {
    expect(mensajeErrorGoogle('unexpected_failure', 'entrar')).toBe(
      'No se pudo entrar con Google. Intenta de nuevo.',
    );
    expect(mensajeErrorGoogle(undefined, 'vincular')).toBe(
      'No se pudo vincular Google. Intenta de nuevo.',
    );
  });
});

describe('mensajeErrorCrearCuenta', () => {
  it('distingue correo ya registrado, inválido y contraseña débil', () => {
    expect(mensajeErrorCrearCuenta('email_exists')).toContain('ya tiene cuenta');
    expect(mensajeErrorCrearCuenta('email_address_invalid')).toBe('Ese correo no es válido.');
    expect(mensajeErrorCrearCuenta('weak_password')).toContain('6 caracteres');
  });

  it('cae en un mensaje genérico', () => {
    expect(mensajeErrorCrearCuenta(undefined)).toBe('No se pudo crear la cuenta. Intenta de nuevo.');
  });
});
