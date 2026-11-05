import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User } from '@supabase/supabase-js';

import { SUPABASE } from '../supabase/supabase.tokens';
import { borrarDatosLocales } from '../sync/persistencia';
import { codigoDeError, mensajeErrorCrearCuenta, mensajeErrorGoogle } from './auth-errores';

type Metodo = 'correo' | 'google' | 'registro';

/** Para qué se fue la página a Google. */
type Redireccion = 'entrar' | 'crear' | 'vincular';

const AVISO_VINCULADA = 'Google quedó vinculado a tu cuenta.';

/**
 * Marca para qué es la redirección a Google en curso. Al volver la página
 * es otra y Supabase solo trae la sesión (o un error en la URL): sin esta
 * marca no habría cómo saber si era entrar, crear la cuenta o vincular.
 */
const REDIRECCION_GOOGLE = 'finanzas.redireccionGoogle';

/**
 * Sesión sobre Supabase Auth. Cada persona tiene su usuario y sus datos
 * viven en filas con su `user_id` (RLS impide ver las de otro, ver
 * `publica/supabase`).
 *
 * El registro empieza con una sesión anónima (la bienvenida guarda datos
 * bajo ese uid) que al final se convierte en cuenta de correo o de Google
 * sin cambiar de uid — y por lo tanto sin perder nada.
 *
 * Google va siempre por redirección (Supabase no tiene ventana emergente):
 * la página se va a Google y el resultado se recoge al volver
 * (`recogerRedireccion`).
 *
 * `usuario()` empieza en `undefined` ("todavía no se sabe" — Supabase tarda
 * un instante en leer la sesión guardada) y pasa a `User | null` con el
 * primer evento de `onAuthStateChange`; `cargando()` distingue ese estado
 * inicial del de "ya se sabe que no hay sesión", para no mostrarle el login
 * a alguien que sí tiene sesión.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);
  private readonly router = inject(Router);

  private readonly _usuario = signal<User | null | undefined>(undefined, { equal: () => false });
  private readonly _iniciandoCon = signal<Metodo | null>(null);
  private readonly _error = signal<{ metodo: Metodo; mensaje: string } | null>(null);
  private readonly _vinculando = signal(false);
  private readonly _aviso = signal<string | null>(null);

  readonly cargando = computed(() => this._usuario() === undefined);
  readonly autenticado = computed(() => !!this._usuario());
  /**
   * Sesión de quien tocó "Regístrate": recorre la bienvenida y guarda sus
   * datos bajo su uid anónimo, y al final elige con qué entrar (correo o
   * Google), que se vincula a ese mismo uid. Mientras tanto solo puede
   * estar en la bienvenida (ver `conCuenta`).
   */
  readonly anonimo = computed(() => this._usuario()?.is_anonymous ?? false);
  /** Uid de la sesión — con él `SincronizacionService` abre los datos de esa persona. */
  readonly uid = computed(() => this._usuario()?.id);
  /** Correo de la sesión, para identificar la cuenta en el menú del `Shell`. */
  readonly email = computed(() => this._usuario()?.email || null);
  /** El primer nombre que trae la cuenta (Google lo da), o `null`. */
  readonly nombreDePila = computed(() => {
    const datos = this._usuario()?.user_metadata;
    const nombre = datos?.['full_name'] ?? datos?.['name'];
    return typeof nombre === 'string' && nombre.trim() ? nombre.trim().split(/\s+/)[0] : null;
  });
  readonly tieneGoogle = computed(
    () => this._usuario()?.identities?.some((i) => i.provider === 'google') ?? false,
  );
  /** Con qué se está entrando, para que solo ese botón diga "Entrando…". */
  readonly iniciandoCon = this._iniciandoCon.asReadonly();
  readonly iniciandoSesion = computed(() => this._iniciandoCon() !== null);
  /** Error del formulario de correo y contraseña. */
  readonly error = computed(() => this.errorDe('correo'));
  /** Error del botón de Google — se muestra junto a él, no bajo la contraseña. */
  readonly errorGoogle = computed(() => this.errorDe('google'));
  /** Error de "Regístrate" en el login. */
  readonly errorRegistro = computed(() => this.errorDe('registro'));
  readonly vinculando = this._vinculando.asReadonly();
  /**
   * Resultado de vincular Google (éxito o error), para que el `Shell` lo
   * muestre: al vincular ya hay sesión, así que el login no está en
   * pantalla para mostrarlo.
   */
  readonly aviso = this._aviso.asReadonly();

  constructor() {
    // Se lee antes de que Supabase procese la URL de regreso.
    const regreso = { redireccion: leerMarca(), errorUrl: errorEnUrl() };
    guardarMarca(null);
    let primerEvento = true;
    this.supabase.auth.onAuthStateChange((evento, sesion) => {
      this._usuario.set(sesion?.user ?? null);
      // Llegó por el enlace del correo de "Olvidé mi contraseña": la sesión
      // ya es la de la persona, solo falta que escriba la clave nueva.
      if (evento === 'PASSWORD_RECOVERY') void this.router.navigateByUrl('/nueva-clave');
      if (primerEvento) {
        primerEvento = false;
        this.recogerRedireccion(regreso.redireccion, regreso.errorUrl);
      }
    });
  }

  /**
   * "Regístrate" del login: sesión anónima para recorrer la bienvenida sin
   * cuenta todavía.
   */
  async registrarse(): Promise<void> {
    this._error.set(null);
    this._iniciandoCon.set('registro');
    const { error } = await this.supabase.auth.signInAnonymously();
    if (error) {
      console.error('Error al empezar el registro', error);
      this._error.set({
        metodo: 'registro',
        mensaje: mensajeErrorCrearCuenta(codigoDeError(error)),
      });
      this._iniciandoCon.set(null);
    }
  }

  /**
   * Fin de la bienvenida: convierte la sesión anónima en una cuenta de
   * correo y contraseña con el mismo uid, así no se pierde nada de lo que
   * se agregó. Devuelve si se pudo.
   *
   * Son dos pasos porque Supabase no deja ponerle contraseña a un usuario
   * anónimo que todavía no tiene correo.
   */
  async crearCuentaConCorreo(email: string, password: string): Promise<boolean> {
    this._error.set(null);
    if (!this._usuario()) return false;
    this._iniciandoCon.set('correo');
    try {
      const conCorreo = await this.supabase.auth.updateUser({ email });
      if (conCorreo.error) throw conCorreo.error;
      const conClave = await this.supabase.auth.updateUser({ password });
      if (conClave.error) throw conClave.error;
      this._usuario.set(conClave.data.user);
      return true;
    } catch (error) {
      console.error('Error al crear la cuenta', error);
      this._error.set({ metodo: 'correo', mensaje: mensajeErrorCrearCuenta(codigoDeError(error)) });
      return false;
    } finally {
      this._iniciandoCon.set(null);
    }
  }

  /**
   * Lo mismo que `crearCuentaConCorreo`, con Google. La página se va a
   * Google: si todo sale bien la promesa no llega a resolverse, y la cuenta
   * queda creada al volver (`recogerRedireccion`).
   */
  async crearCuentaConGoogle(): Promise<boolean> {
    this._error.set(null);
    if (!this._usuario()) return false;
    this._iniciandoCon.set('google');
    guardarMarca('crear');
    const { error } = await this.supabase.auth.linkIdentity(opcionesGoogle());
    if (error) {
      guardarMarca(null);
      const mensaje = mensajeErrorGoogle(codigoDeError(error), 'crear');
      if (mensaje) {
        console.error('Error al crear la cuenta con Google', error);
        this._error.set({ metodo: 'google', mensaje });
      }
      this._iniciandoCon.set(null);
      return false;
    }
    return true;
  }

  async iniciarSesion(email: string, password: string): Promise<void> {
    this._error.set(null);
    this._iniciandoCon.set('correo');
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // No se distingue "usuario no existe" de "contraseña incorrecta"
      // (mismo mensaje genérico): no darle pistas a quien intenta entrar.
      this._error.set({
        metodo: 'correo',
        mensaje:
          codigoDeError(error) === 'network_error'
            ? 'No hay conexión. Revisa tu internet e intenta de nuevo.'
            : 'Usuario o contraseña incorrectos.',
      });
      this._iniciandoCon.set(null);
    }
  }

  /**
   * "Olvidé mi contraseña": manda al correo un enlace para crear una clave
   * nueva. Devuelve `true` si se pidió el envío. No dice si el correo tiene
   * cuenta (misma razón que en `iniciarSesion`: no dar pistas).
   */
  async enviarRecuperacion(email: string): Promise<boolean> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/`,
    });
    if (error && codigoDeError(error) === 'network_error') throw error;
    if (error) console.error('Error al pedir la recuperación', error);
    return true;
  }

  /** Guarda la clave nueva de la sesión de recuperación. Devuelve si se pudo. */
  async cambiarClave(password: string): Promise<boolean> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) {
      console.error('Error al cambiar la clave', error);
      return false;
    }
    return true;
  }

  /** Entra con Google, o crea la cuenta si es la primera vez — Supabase no distingue los dos casos. */
  async entrarConGoogle(): Promise<void> {
    this._error.set(null);
    this._iniciandoCon.set('google');
    guardarMarca('entrar');
    const { error } = await this.supabase.auth.signInWithOAuth(opcionesGoogle());
    if (error) {
      guardarMarca(null);
      this.fallarEntrada(error);
      this._iniciandoCon.set(null);
    }
  }

  /**
   * Al entrar, el botón sigue en "Entrando…" hasta que `App` sabe a dónde
   * llevar a la persona (ver `App.decidirDestino`); entonces lo suelta.
   */
  terminarEntrada(): void {
    this._iniciandoCon.set(null);
  }

  /**
   * Une Google a la cuenta de la sesión (una de correo y contraseña): mismo
   * uid, mismos datos, y desde ahí se puede entrar de las dos formas.
   */
  async vincularGoogle(): Promise<void> {
    if (!this._usuario() || this._vinculando()) return;
    this._vinculando.set(true);
    guardarMarca('vincular');
    const { error } = await this.supabase.auth.linkIdentity(opcionesGoogle());
    if (error) {
      guardarMarca(null);
      this.fallarVinculo(error);
      this._vinculando.set(false);
    }
  }

  /** El `Shell` ya mostró el aviso. */
  descartarAviso(): void {
    this._aviso.set(null);
  }

  /**
   * Además de salir, borra la copia local de los datos: en un computador
   * prestado no puede quedar la plata de nadie guardada en el navegador.
   * Lo que no se alcanzó a subir se pierde, igual que antes con Firestore.
   * Solo cierra la sesión de este dispositivo (`scope: 'local'`). Se recarga
   * la página para arrancar limpia en el login.
   */
  async cerrarSesion(): Promise<void> {
    const uid = this.uid();
    await this.supabase.auth.signOut({ scope: 'local' });
    if (uid) await borrarDatosLocales(uid);
    location.reload();
  }

  /**
   * Al volver de Google, la sesión nueva ya llegó (Supabase la saca de la
   * URL antes del primer evento) o vino un error en la URL. Si no hubo
   * redirección no pasa nada.
   */
  private recogerRedireccion(redireccion: Redireccion | null, errorUrl: string | null): void {
    if (!redireccion) return;
    if (errorUrl) {
      if (redireccion === 'crear') {
        const mensaje = mensajeErrorGoogle(errorUrl, 'crear');
        if (mensaje) this._error.set({ metodo: 'google', mensaje });
      } else if (redireccion === 'vincular') {
        this.fallarVinculo({ code: errorUrl });
      } else {
        this.fallarEntrada({ code: errorUrl });
      }
      return;
    }
    // Al crearla se sigue a General; al vincular solo hay que avisar.
    if (redireccion === 'crear' && this.tieneGoogle()) void this.router.navigateByUrl('/general');
    else if (redireccion === 'vincular' && this.tieneGoogle()) this._aviso.set(AVISO_VINCULADA);
  }

  private fallarEntrada(error: unknown): void {
    const mensaje = mensajeErrorGoogle(codigoDeError(error), 'entrar');
    if (!mensaje) return;
    console.error('Error al entrar con Google', error);
    this._error.set({ metodo: 'google', mensaje });
  }

  private fallarVinculo(error: unknown): void {
    const mensaje = mensajeErrorGoogle(codigoDeError(error), 'vincular');
    if (!mensaje) return;
    console.error('Error al vincular Google', error);
    this._aviso.set(mensaje);
  }

  private errorDe(metodo: Metodo): string | null {
    const error = this._error();
    return error?.metodo === metodo ? error.mensaje : null;
  }
}

function opcionesGoogle() {
  return {
    provider: 'google' as const,
    options: {
      redirectTo: `${location.origin}/`,
      // Siempre el selector de cuenta: en un celular con varias cuentas de
      // Google, sin esto entra directo con la última usada.
      queryParams: { prompt: 'select_account' },
    },
  };
}

/**
 * Código del error con el que Supabase devuelve a la app cuando falla el
 * paso por Google (`?error_code=identity_already_exists`, o
 * `error=access_denied` si la persona canceló). Puede venir en la query o
 * en el hash.
 */
function errorEnUrl(): string | null {
  const parametros = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const error = parametros.get('error') ?? hash.get('error');
  const codigo =
    error === 'access_denied'
      ? error
      : (parametros.get('error_code') ?? hash.get('error_code') ?? error);
  if (codigo) history.replaceState(history.state, '', location.pathname);
  return codigo;
}

function leerMarca(): Redireccion | null {
  try {
    return sessionStorage.getItem(REDIRECCION_GOOGLE) as Redireccion | null;
  } catch {
    return null;
  }
}

function guardarMarca(redireccion: Redireccion | null): void {
  try {
    if (redireccion) sessionStorage.setItem(REDIRECCION_GOOGLE, redireccion);
    else sessionStorage.removeItem(REDIRECCION_GOOGLE);
  } catch {
    // Sin almacenamiento: al volver no se sabrá para qué fue (solo cambia el aviso).
  }
}
