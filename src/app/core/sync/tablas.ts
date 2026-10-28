/**
 * Las tablas de Supabase que la app guarda en el dispositivo, y cómo se
 * convierte una fila de la base (snake_case, `null`) en un objeto del
 * dominio (camelCase, `undefined`) y al revés.
 *
 * Los campos van listados a mano, no se adivinan: así no se manda a la base
 * una propiedad que no tenga columna (PostgREST rechazaría la escritura
 * entera) y cada valor vuelve con su tipo — `numeric` puede llegar como
 * texto y `timestamptz` con otro formato que el ISO que escribe el cliente.
 */

export type NombreTabla =
  | 'cuentas'
  | 'creditos'
  | 'extractos'
  | 'cambios_tasa'
  | 'pagos_fijos'
  | 'movimientos'
  | 'compras'
  | 'categorias'
  | 'preferencias';

/** Una fila tal como la guarda el dispositivo: un objeto del dominio con su id. */
export type Fila = { id: string } & Record<string, unknown>;

type TipoCampo = 'texto' | 'numero' | 'bool' | 'fecha' | 'instante' | 'lista' | 'json';

/** Campos de cada tabla, con el nombre del dominio (camelCase), sin `id`. */
const CAMPOS: Record<NombreTabla, Record<string, TipoCampo>> = {
  cuentas: {
    nombre: 'texto',
    tipo: 'texto',
    entidad: 'texto',
    ultimos4: 'texto',
    color: 'texto',
    cuentaPadreId: 'texto',
    saldoInicial: 'numero',
    sumaEnDisponible: 'bool',
    reservado: 'bool',
    archivada: 'bool',
    creadoEn: 'instante',
  },
  creditos: {
    grupo: 'texto',
    nombre: 'texto',
    entidad: 'texto',
    diaPago: 'numero',
    archivado: 'bool',
    creadoEn: 'instante',
    ultimos4: 'texto',
    diaCorte: 'numero',
    cupo: 'numero',
    monto: 'numero',
    tasaEa: 'numero',
    tipoTasa: 'texto',
    plazoMeses: 'numero',
    cuotasPagadasIniciales: 'numero',
    seguroMensual: 'numero',
    fechaAcordada: 'fecha',
  },
  extractos: {
    creditoId: 'texto',
    periodo: 'texto',
    valorAPagar: 'numero',
  },
  cambios_tasa: {
    creditoId: 'texto',
    fechaDesde: 'fecha',
    tasaEa: 'numero',
  },
  pagos_fijos: {
    nombre: 'texto',
    categoriaId: 'texto',
    diaLimite: 'numero',
    monto: 'numero',
    esVariable: 'bool',
    frecuencia: 'texto',
    mesInicio: 'numero',
    cuentaDefaultId: 'texto',
    activo: 'bool',
    periodosPagadosSinMovimiento: 'lista',
  },
  movimientos: {
    fecha: 'fecha',
    tipo: 'texto',
    monto: 'numero',
    descripcion: 'texto',
    categoriaId: 'texto',
    cuentaOrigenId: 'texto',
    cuentaDestinoId: 'texto',
    creditoOrigenId: 'texto',
    creditoDestinoId: 'texto',
    pagoFijoId: 'texto',
    periodo: 'texto',
    creadoEn: 'instante',
  },
  compras: {
    creditoId: 'texto',
    movimientoId: 'texto',
    descripcion: 'texto',
    monto: 'numero',
    numCuotas: 'numero',
    valorCuota: 'numero',
    fecha: 'fecha',
  },
  categorias: { datos: 'json' },
  preferencias: { datos: 'json' },
};

export const TABLAS = Object.keys(CAMPOS) as NombreTabla[];

function aColumna(campo: string): string {
  return campo.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

/**
 * Objeto del dominio (completo o solo los cambios) → fila para la base.
 * Solo viajan las claves presentes: un campo en `undefined` significa
 * "quedó vacío" y se escribe `null`; uno que no viene no se toca.
 */
export function aFila(tabla: NombreTabla, datos: Record<string, unknown>): Record<string, unknown> {
  const campos = CAMPOS[tabla];
  const fila: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (campo === 'id') {
      fila['id'] = valor;
      continue;
    }
    const tipo = campos[campo];
    if (!tipo) continue;
    fila[aColumna(campo)] = valor === undefined || (tipo === 'fecha' && valor === '') ? null : valor;
  }
  return fila;
}

/** Fila de la base → objeto del dominio. Una columna en `null` no aparece (queda `undefined`). */
export function desdeFila(tabla: NombreTabla, fila: Record<string, unknown>): Fila {
  const resultado: Fila = { id: String(fila['id']) };
  for (const [campo, tipo] of Object.entries(CAMPOS[tabla])) {
    const valor = fila[aColumna(campo)];
    if (valor === null || valor === undefined) continue;
    resultado[campo] =
      tipo === 'numero'
        ? Number(valor)
        : tipo === 'instante'
          ? new Date(valor as string).toISOString()
          : valor;
  }
  return resultado;
}

/** Id nuevo generado en el dispositivo: no hace falta la red para crear una fila. */
export function idNuevo(): string {
  return crypto.randomUUID().replaceAll('-', '');
}
