import type { Fila, NombreTabla } from './tablas';

/** Una escritura que el dispositivo todavía tiene que subir a Supabase. */
export interface Operacion {
  tabla: NombreTabla;
  id: string;
  /** `guardar` sube la fila completa (crear); `actualizar`, solo los campos que cambiaron. */
  tipo: 'guardar' | 'actualizar' | 'eliminar';
  datos?: Record<string, unknown>;
}

export interface OperacionEnCola extends Operacion {
  /** Orden de llegada: la cola se sube en este orden (una compra va después de su crédito). */
  n: number;
}

/**
 * Lo que el dispositivo guarda de la sesión: una copia de las filas del
 * usuario y la cola de escrituras pendientes. Cada cambio local escribe las
 * dos cosas en una sola transacción, así nunca queda una fila cambiada sin
 * su operación en la cola, ni al revés.
 */
export interface Persistencia {
  cargarFilas(): Promise<Array<{ tabla: NombreTabla; fila: Fila }>>;
  /** Tablas que ya se descargaron de Supabase alguna vez en este dispositivo. */
  tablasDescargadas(): Promise<Set<NombreTabla>>;
  /** Pone (o quita, con `null`) una fila y, si viene, encola la operación. */
  aplicar(tabla: NombreTabla, id: string, fila: Fila | null, operacion?: Operacion): Promise<void>;
  /** Reemplaza la copia de una tabla con lo descargado y la marca como descargada. */
  reemplazarTabla(tabla: NombreTabla, filas: Fila[]): Promise<void>;
  primeraEnCola(): Promise<OperacionEnCola | undefined>;
  quitarDeCola(n: number): Promise<void>;
  /** Ids de la tabla con operaciones en cola: su versión local manda sobre la del servidor. */
  pendientes(tabla: NombreTabla): Promise<Set<string>>;
  cerrar(): void;
}

const VERSION = 1;

function nombreBase(uid: string): string {
  return `finanzas-${uid}`;
}

function pedir<T>(solicitud: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

function terminar(transaccion: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaccion.oncomplete = () => resolve();
    transaccion.onerror = () => reject(transaccion.error);
    transaccion.onabort = () => reject(transaccion.error);
  });
}

/**
 * Una base IndexedDB por usuario (`finanzas-{uid}`), con tres almacenes:
 * `filas` (clave `[tabla, id]`), `cola` (autoincremental, en orden) y
 * `meta` (qué tablas ya se descargaron).
 */
export class PersistenciaIndexedDb implements Persistencia {
  private constructor(private readonly db: IDBDatabase) {
    // Otra pestaña cerró sesión y quiere borrar la base: hay que soltarla.
    db.onversionchange = () => db.close();
  }

  static async abrir(uid: string): Promise<PersistenciaIndexedDb> {
    const solicitud = indexedDB.open(nombreBase(uid), VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      db.createObjectStore('filas', { keyPath: ['tabla', 'id'] });
      db.createObjectStore('cola', { keyPath: 'n', autoIncrement: true }).createIndex(
        'tabla',
        'tabla',
      );
      db.createObjectStore('meta');
    };
    return new PersistenciaIndexedDb(await pedir(solicitud));
  }

  async cargarFilas(): Promise<Array<{ tabla: NombreTabla; fila: Fila }>> {
    const guardadas = await pedir(this.db.transaction('filas').objectStore('filas').getAll());
    return guardadas.map((g: { tabla: NombreTabla; datos: Fila }) => ({
      tabla: g.tabla,
      fila: g.datos,
    }));
  }

  async tablasDescargadas(): Promise<Set<NombreTabla>> {
    const claves = await pedir(this.db.transaction('meta').objectStore('meta').getAllKeys());
    return new Set(claves as NombreTabla[]);
  }

  async aplicar(
    tabla: NombreTabla,
    id: string,
    fila: Fila | null,
    operacion?: Operacion,
  ): Promise<void> {
    const transaccion = this.db.transaction(['filas', 'cola'], 'readwrite');
    const filas = transaccion.objectStore('filas');
    if (fila) filas.put({ tabla, id, datos: fila });
    else filas.delete([tabla, id]);
    if (operacion) transaccion.objectStore('cola').add(operacion);
    await terminar(transaccion);
  }

  async reemplazarTabla(tabla: NombreTabla, filas: Fila[]): Promise<void> {
    const transaccion = this.db.transaction(['filas', 'meta'], 'readwrite');
    const almacen = transaccion.objectStore('filas');
    almacen.delete(IDBKeyRange.bound([tabla, ''], [tabla, '￿']));
    for (const fila of filas) almacen.put({ tabla, id: fila.id, datos: fila });
    transaccion.objectStore('meta').put(true, tabla);
    await terminar(transaccion);
  }

  async primeraEnCola(): Promise<OperacionEnCola | undefined> {
    const cursor = await pedir(this.db.transaction('cola').objectStore('cola').openCursor());
    return cursor?.value as OperacionEnCola | undefined;
  }

  async quitarDeCola(n: number): Promise<void> {
    const transaccion = this.db.transaction('cola', 'readwrite');
    transaccion.objectStore('cola').delete(n);
    await terminar(transaccion);
  }

  async pendientes(tabla: NombreTabla): Promise<Set<string>> {
    const indice = this.db.transaction('cola').objectStore('cola').index('tabla');
    const operaciones: Operacion[] = await pedir(indice.getAll(tabla));
    return new Set(operaciones.map((o) => o.id));
  }

  cerrar(): void {
    this.db.close();
  }
}

/** Para pruebas y navegadores sin IndexedDB: lo mismo, pero se pierde al recargar. */
export class PersistenciaEnMemoria implements Persistencia {
  readonly filas = new Map<string, { tabla: NombreTabla; fila: Fila }>();
  readonly cola: OperacionEnCola[] = [];
  readonly descargadas = new Set<NombreTabla>();
  private siguiente = 1;

  async cargarFilas() {
    return [...this.filas.values()];
  }

  async tablasDescargadas() {
    return new Set(this.descargadas);
  }

  async aplicar(tabla: NombreTabla, id: string, fila: Fila | null, operacion?: Operacion) {
    if (fila) this.filas.set(`${tabla}/${id}`, { tabla, fila });
    else this.filas.delete(`${tabla}/${id}`);
    if (operacion) this.cola.push({ ...operacion, n: this.siguiente++ });
  }

  async reemplazarTabla(tabla: NombreTabla, filas: Fila[]) {
    for (const [clave, valor] of this.filas) if (valor.tabla === tabla) this.filas.delete(clave);
    for (const fila of filas) this.filas.set(`${tabla}/${fila.id}`, { tabla, fila });
    this.descargadas.add(tabla);
  }

  async primeraEnCola() {
    return this.cola[0];
  }

  async quitarDeCola(n: number) {
    const i = this.cola.findIndex((o) => o.n === n);
    if (i >= 0) this.cola.splice(i, 1);
  }

  async pendientes(tabla: NombreTabla) {
    return new Set(this.cola.filter((o) => o.tabla === tabla).map((o) => o.id));
  }

  cerrar(): void {}
}

/** IndexedDB si el navegador la deja abrir; si no (modo privado viejo, pruebas), en memoria. */
export async function abrirPersistencia(uid: string): Promise<Persistencia> {
  try {
    if (typeof indexedDB === 'undefined') return new PersistenciaEnMemoria();
    return await PersistenciaIndexedDb.abrir(uid);
  } catch (error) {
    console.error('No se pudo abrir el almacenamiento del dispositivo', error);
    return new PersistenciaEnMemoria();
  }
}

/**
 * Borra la copia local del usuario (al cerrar sesión: en un computador
 * prestado no puede quedar la plata de nadie guardada en el navegador).
 * Si la base está abierta en esta u otra pestaña, `onversionchange` la
 * cierra primero.
 */
export async function borrarDatosLocales(uid: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const solicitud = indexedDB.deleteDatabase(nombreBase(uid));
  await new Promise<void>((resolve) => {
    solicitud.onsuccess = () => resolve();
    solicitud.onerror = () => resolve();
    // Una pestaña que no suelta la base: no se espera para siempre.
    solicitud.onblocked = () => setTimeout(resolve, 1000);
  });
}
