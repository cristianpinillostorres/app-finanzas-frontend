import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, type Observable, defer, filter, firstValueFrom, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { SUPABASE } from '../supabase/supabase.tokens';
import { type Operacion, type Persistencia, abrirPersistencia } from './persistencia';
import { type Remoto, RemotoSupabase } from './remoto';
import { type Fila, type NombreTabla, TABLAS } from './tablas';

/** Espera entre reintentos de subir la cola: crece hasta un minuto. */
const ESPERA_MINIMA = 2_000;
const ESPERA_MAXIMA = 60_000;
/** Al volver a la app, descarga de nuevo como mucho cada 30 s. */
const ENTRE_DESCARGAS = 30_000;

export interface Entorno {
  enLinea(): boolean;
  /** Avisa al volver la red y al volver la app al frente. Devuelve cómo dejar de escuchar. */
  escucharEventos(alVolverRed: () => void, alVolverAlFrente: () => void): () => void;
}

const ENTORNO_NAVEGADOR: Entorno = {
  enLinea: () => typeof navigator === 'undefined' || navigator.onLine,
  escucharEventos(alVolverRed, alVolverAlFrente) {
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') alVolverAlFrente();
    };
    window.addEventListener('online', alVolverRed);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      window.removeEventListener('online', alVolverRed);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  },
};

/**
 * Los datos de una sesión, primero en el dispositivo y después en
 * Supabase:
 *
 * 1. Al abrir, carga la copia local (IndexedDB) y las pantallas la ven al
 *    instante, aun sin señal.
 * 2. Cada escritura cambia la copia local en el acto (el formulario cierra
 *    sin esperar al servidor) y queda en una cola.
 * 3. La cola se sube en orden cuando hay red; si falla por la red, se
 *    reintenta; si la base la rechaza, se descarta y se vuelve a descargar
 *    esa tabla para que la pantalla no muestre algo que no quedó guardado.
 * 4. Se descarga todo al conectar y al volver a la app, y se escuchan en
 *    vivo los cambios de otros dispositivos. Una fila con operaciones en
 *    cola conserva su versión local: es más nueva que la del servidor.
 *
 * Todo lo que toca la copia local pasa por `encadenar`, en orden: así una
 * descarga no pisa una escritura que llegó mientras tanto.
 */
export class SesionLocal {
  private readonly filas = new Map<NombreTabla, Map<string, Fila>>(
    TABLAS.map((t) => [t, new Map()]),
  );
  private readonly listas = new Map<NombreTabla, BehaviorSubject<Fila[] | null>>(
    TABLAS.map((t) => [t, new BehaviorSubject<Fila[] | null>(null)]),
  );
  /**
   * Tablas que nunca llegaron del servidor a este dispositivo. Si una de
   * ellas se ve vacía es porque no hubo cómo traerla (sin red, o falló la
   * descarga), no porque esté vacía: la pantalla lo distingue con esto.
   */
  private readonly sinTraerTablas = new BehaviorSubject<ReadonlySet<NombreTabla>>(
    new Set(TABLAS),
  );
  private persistencia: Persistencia | undefined;
  private cadena: Promise<unknown> = Promise.resolve();
  private cargada = false;
  private cerrada = false;
  private subiendo = false;
  private subirOtraVez = false;
  private espera = ESPERA_MINIMA;
  private reintento: ReturnType<typeof setTimeout> | undefined;
  private ultimaDescarga = 0;
  private readonly limpiezas: Array<() => void> = [];

  constructor(
    readonly uid: string,
    private readonly remoto: Remoto,
    private readonly abrir: (uid: string) => Promise<Persistencia> = abrirPersistencia,
    private readonly entorno: Entorno = ENTORNO_NAVEGADOR,
  ) {}

  /** Carga la copia local y arranca la sincronización. Resuelve cuando la copia local está lista. */
  iniciar(): Promise<void> {
    const lista = this.encadenar(async () => {
      this.persistencia = await this.abrir(this.uid);
      const [guardadas, descargadas] = await Promise.all([
        this.persistencia.cargarFilas(),
        this.persistencia.tablasDescargadas(),
      ]);
      for (const { tabla, fila } of guardadas) this.filas.get(tabla)?.set(fila.id, fila);
      this.sinTraerTablas.next(new Set(TABLAS.filter((tabla) => !descargadas.has(tabla))));
      this.cargada = true;
      // Lo que ya se descargó alguna vez se muestra ya; lo que nunca, espera
      // a la descarga — si no, una cuenta con datos se vería vacía un
      // instante (y la bienvenida creería que es nueva). Sin red no hay
      // nada que esperar.
      for (const tabla of TABLAS) {
        if (descargadas.has(tabla) || !this.entorno.enLinea()) this.emitir(tabla);
      }
    });
    void lista.then(() => {
      if (this.cerrada) return;
      void this.subirCola();
      this.limpiezas.push(
        this.remoto.escuchar(
          this.uid,
          (tabla, fila) => void this.recibir(tabla, fila),
          () => void this.descargarTodo(),
        ),
        this.entorno.escucharEventos(
          () => void this.subirCola(),
          () => {
            if (Date.now() - this.ultimaDescarga < ENTRE_DESCARGAS) return;
            void this.subirCola();
            void this.descargarTodo();
          },
        ),
      );
    });
    return lista;
  }

  observar(tabla: NombreTabla): Observable<Fila[]> {
    return this.listas.get(tabla)!.pipe(filter((filas): filas is Fila[] => filas !== null));
  }

  /** Si la tabla todavía no ha llegado nunca del servidor (ver `sinTraerTablas`). */
  sinTraer(tabla: NombreTabla): Observable<boolean> {
    return this.sinTraerTablas.pipe(map((tablas) => tablas.has(tabla)));
  }

  /** Una fila de la copia local, esperando a que la tabla esté lista. */
  obtener(tabla: NombreTabla, id: string): Promise<Fila | undefined> {
    return firstValueFrom(this.observar(tabla).pipe(map((filas) => filas.find((f) => f.id === id))));
  }

  /** Crea (o reemplaza entera) una fila. */
  guardar(tabla: NombreTabla, fila: Fila): void {
    this.escribirLocal(tabla, fila.id, () => fila, { tabla, id: fila.id, tipo: 'guardar', datos: fila });
  }

  /**
   * Cambia solo los campos que vienen; uno en `undefined` queda vacío.
   * Devuelve la fila como queda — al instante si la copia ya cargó.
   */
  actualizar(tabla: NombreTabla, id: string, cambios: Record<string, unknown>): Promise<Fila> {
    return this.escribirLocal(
      tabla,
      id,
      (actual) => {
        if (!actual) throw new Error(`No existe ${tabla}/${id} en el dispositivo`);
        const nueva: Fila = { ...actual, ...cambios, id };
        for (const [campo, valor] of Object.entries(cambios)) {
          if (valor === undefined) delete nueva[campo];
        }
        return nueva;
      },
      { tabla, id, tipo: 'actualizar', datos: cambios },
    ) as Promise<Fila>;
  }

  eliminar(tabla: NombreTabla, id: string): void {
    this.escribirLocal(tabla, id, () => null, { tabla, id, tipo: 'eliminar' });
  }

  cerrar(): void {
    this.cerrada = true;
    clearTimeout(this.reintento);
    for (const limpiar of this.limpiezas) limpiar();
    void this.cadena.then(() => this.persistencia?.cerrar());
  }

  /**
   * Aplica el cambio a la copia en memoria — ya, si cargó, para que la
   * pantalla lo vea sin esperar a IndexedDB — y lo guarda con su operación
   * en cola, en orden.
   */
  private escribirLocal(
    tabla: NombreTabla,
    id: string,
    calcular: (actual: Fila | undefined) => Fila | null,
    operacion: Operacion,
  ): Promise<Fila | null> {
    const enMemoria = () => {
      const resultado = calcular(this.filas.get(tabla)!.get(id));
      if (resultado) this.filas.get(tabla)!.set(id, resultado);
      else this.filas.get(tabla)!.delete(id);
      this.emitir(tabla);
      return resultado;
    };
    let inmediato: { valor: Fila | null } | undefined;
    if (this.cargada) {
      try {
        inmediato = { valor: enMemoria() };
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const guardado = this.encadenar(async () => {
      const resultado = inmediato ? inmediato.valor : enMemoria();
      await this.persistencia!.aplicar(tabla, id, resultado, operacion);
      return resultado;
    });
    void guardado.then(
      () => void this.subirCola(),
      (error) => console.error(`No se pudo guardar en el dispositivo: ${tabla}/${id}`, error),
    );
    return inmediato ? Promise.resolve(inmediato.valor) : guardado;
  }

  /** Sube la cola en orden. Solo una subida a la vez, también entre pestañas. */
  async subirCola(): Promise<void> {
    if (this.cerrada || !this.persistencia) return;
    if (this.subiendo) {
      // Llegó algo mientras se subía: puede que la vuelta en curso ya no lo vea.
      this.subirOtraVez = true;
      return;
    }
    this.subiendo = true;
    clearTimeout(this.reintento);
    this.reintento = undefined;
    try {
      do {
        this.subirOtraVez = false;
        await conCandado(`finanzas-cola-${this.uid}`, () => this.subirEnOrden());
      } while (this.subirOtraVez && !this.reintento);
    } finally {
      this.subiendo = false;
    }
  }

  private async subirEnOrden(): Promise<void> {
    const recargar = new Set<NombreTabla>();
    while (!this.cerrada) {
      const operacion = await this.persistencia!.primeraEnCola();
      if (!operacion) break;
      const resultado = await this.remoto.ejecutar(operacion, this.uid);
      if (resultado === 'reintentar') {
        this.reintento = setTimeout(() => {
          this.reintento = undefined;
          void this.subirCola();
        }, this.espera);
        this.espera = Math.min(this.espera * 2, ESPERA_MAXIMA);
        break;
      }
      if (resultado !== 'ok') {
        console.error(
          `Supabase rechazó ${operacion.tipo} ${operacion.tabla}/${operacion.id}; se descarta`,
          resultado.rechazada,
        );
        recargar.add(operacion.tabla);
      }
      this.espera = ESPERA_MINIMA;
      await this.persistencia!.quitarDeCola(operacion.n);
    }
    for (const tabla of recargar) await this.descargar(tabla);
  }

  async descargarTodo(): Promise<void> {
    this.ultimaDescarga = Date.now();
    await Promise.all(TABLAS.map((tabla) => this.descargar(tabla)));
  }

  private async descargar(tabla: NombreTabla): Promise<void> {
    let delServidor: Fila[];
    try {
      delServidor = await this.remoto.descargar(tabla, this.uid);
    } catch (error) {
      console.error(`No se pudo descargar ${tabla}`, error);
      // Sin descarga, al menos que la pantalla muestre lo que hay.
      await this.encadenar(async () => this.emitir(tabla));
      return;
    }
    await this.encadenar(async () => {
      if (this.cerrada) return;
      const pendientes = await this.persistencia!.pendientes(tabla);
      const locales = this.filas.get(tabla)!;
      const nuevas = new Map(delServidor.map((fila) => [fila.id, fila]));
      for (const id of pendientes) {
        const local = locales.get(id);
        if (local) nuevas.set(id, local);
        else nuevas.delete(id);
      }
      this.filas.set(tabla, nuevas);
      if (this.sinTraerTablas.value.has(tabla)) {
        const quedan = new Set(this.sinTraerTablas.value);
        quedan.delete(tabla);
        this.sinTraerTablas.next(quedan);
      }
      this.emitir(tabla);
      await this.persistencia!.reemplazarTabla(tabla, [...nuevas.values()]);
    });
  }

  /** Una fila que cambió en Supabase (otro dispositivo, o el eco de una escritura propia). */
  private recibir(tabla: NombreTabla, fila: Fila): Promise<void> {
    return this.encadenar(async () => {
      if (this.cerrada) return;
      if ((await this.persistencia!.pendientes(tabla)).has(fila.id)) return;
      this.filas.get(tabla)!.set(fila.id, fila);
      this.emitir(tabla);
      await this.persistencia!.aplicar(tabla, fila.id, fila);
    });
  }

  private emitir(tabla: NombreTabla): void {
    this.listas.get(tabla)!.next([...this.filas.get(tabla)!.values()]);
  }

  private encadenar<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cadena.then(tarea);
    this.cadena = resultado.catch(() => undefined);
    return resultado;
  }
}

/** Web Locks si el navegador los tiene (una subida entre todas las pestañas); si no, directo. */
function conCandado(nombre: string, tarea: () => Promise<void>): Promise<void> {
  const candados = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return candados ? candados.request(nombre, () => tarea()).then(() => undefined) : tarea();
}

/**
 * La `SesionLocal` del usuario con sesión, para las `*SupabaseApi`. Se crea
 * la primera vez que una la pide y se reemplaza si cambia el uid (salir y
 * entrar con otra cuenta recarga la página, así que en la práctica es una
 * por carga).
 */
@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private readonly auth = inject(AuthService);
  private readonly remoto = new RemotoSupabase(inject(SUPABASE));
  private sesion: SesionLocal | undefined;

  actual(): SesionLocal {
    const uid = this.auth.uid();
    if (!uid) throw new Error('No hay sesión: no se puede acceder a los datos.');
    if (this.sesion?.uid !== uid) {
      this.sesion?.cerrar();
      this.sesion = new SesionLocal(uid, this.remoto);
      void this.sesion.iniciar();
    }
    return this.sesion;
  }

  /** Ver `SesionLocal.sinTraer`. */
  sinTraer(tabla: NombreTabla): Observable<boolean> {
    return defer(() => this.actual().sinTraer(tabla));
  }

  /** Vuelve a pedir todo al servidor, para el botón "Reintentar" de una pantalla. */
  reintentar(): Promise<void> {
    return this.actual().descargarTodo();
  }
}
