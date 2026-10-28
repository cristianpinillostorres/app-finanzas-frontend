import { firstValueFrom } from 'rxjs';

import { type Operacion, PersistenciaEnMemoria } from './persistencia';
import type { Remoto, ResultadoRemoto } from './remoto';
import { type Entorno, SesionLocal } from './sincronizador';
import type { Fila, NombreTabla } from './tablas';

/** Un Supabase de mentira: guarda en memoria y se puede "desconectar". */
class RemotoFalso implements Remoto {
  enLinea = true;
  readonly servidor = new Map<string, Fila>();
  readonly subidas: Operacion[] = [];
  rechazar: (operacion: Operacion) => boolean = () => false;
  alCambiar: ((tabla: NombreTabla, fila: Fila) => void) | undefined;

  async ejecutar(operacion: Operacion): Promise<ResultadoRemoto> {
    if (!this.enLinea) return 'reintentar';
    if (this.rechazar(operacion)) return { rechazada: 'violates check constraint' };
    this.subidas.push(operacion);
    const clave = `${operacion.tabla}/${operacion.id}`;
    if (operacion.tipo === 'eliminar') this.servidor.delete(clave);
    else {
      const actual = this.servidor.get(clave) ?? { id: operacion.id };
      this.servidor.set(clave, { ...actual, ...operacion.datos, id: operacion.id });
    }
    return 'ok';
  }

  async descargar(tabla: NombreTabla): Promise<Fila[]> {
    if (!this.enLinea) throw new Error('sin red');
    return [...this.servidor.entries()]
      .filter(([clave]) => clave.startsWith(`${tabla}/`))
      .map(([, fila]) => fila);
  }

  escuchar(_uid: string, alCambiar: (tabla: NombreTabla, fila: Fila) => void): () => void {
    this.alCambiar = alCambiar;
    return () => undefined;
  }
}

function entornoDe(remoto: RemotoFalso): Entorno {
  return { enLinea: () => remoto.enLinea, escucharEventos: () => () => undefined };
}

async function iniciar(remoto: RemotoFalso, persistencia = new PersistenciaEnMemoria()) {
  const sesion = new SesionLocal('u1', remoto, async () => persistencia, entornoDe(remoto));
  await sesion.iniciar();
  return { sesion, persistencia };
}

const lista = (sesion: SesionLocal, tabla: NombreTabla) => firstValueFrom(sesion.observar(tabla));

describe('SesionLocal', () => {
  it('sin red, lo escrito se ve al instante y queda en cola hasta que vuelve la red', async () => {
    const remoto = new RemotoFalso();
    remoto.enLinea = false;
    const { sesion, persistencia } = await iniciar(remoto);

    sesion.guardar('cuentas', { id: 'c1', nombre: 'Nequi' });
    sesion.guardar('movimientos', { id: 'm1', cuentaOrigenId: 'c1', monto: 5000 });

    expect((await lista(sesion, 'movimientos')).map((m) => m.id)).toEqual(['m1']);
    await vi.waitFor(() => expect(persistencia.cola).toHaveLength(2));
    expect(remoto.subidas).toHaveLength(0);

    remoto.enLinea = true;
    await sesion.subirCola();

    // En el orden en que se escribieron: la cuenta antes que su movimiento.
    expect(remoto.subidas.map((o) => o.id)).toEqual(['c1', 'm1']);
    expect(persistencia.cola).toHaveLength(0);
  });

  it('una operación rechazada se descarta, no frena la cola y la tabla vuelve a lo del servidor', async () => {
    const remoto = new RemotoFalso();
    remoto.rechazar = (o) => o.id === 'malo';
    const { sesion, persistencia } = await iniciar(remoto);

    sesion.guardar('cuentas', { id: 'malo', nombre: '' });
    sesion.guardar('cuentas', { id: 'bueno', nombre: 'Bancolombia' });

    await vi.waitFor(() => expect(remoto.subidas.map((o) => o.id)).toEqual(['bueno']));
    await vi.waitFor(() => expect(persistencia.cola).toHaveLength(0));
    await vi.waitFor(async () =>
      expect((await lista(sesion, 'cuentas')).map((c) => c.id)).toEqual(['bueno']),
    );
  });

  it('al descargar, una fila con cambios en cola conserva su versión local', async () => {
    const remoto = new RemotoFalso();
    remoto.servidor.set('cuentas/c1', { id: 'c1', nombre: 'Viejo' });
    remoto.servidor.set('cuentas/c2', { id: 'c2', nombre: 'Otra' });
    const { sesion } = await iniciar(remoto);
    await sesion.descargarTodo();

    remoto.enLinea = false;
    await sesion.actualizar('cuentas', 'c1', { nombre: 'Nuevo' });
    remoto.enLinea = true;
    remoto.servidor.set('cuentas/c3', { id: 'c3', nombre: 'De otro dispositivo' });
    // La subida ya falló por la red; descargar antes de reintentar no pisa el cambio.
    await vi.waitFor(() => expect(remoto.subidas).toHaveLength(0));
    await sesion.descargarTodo();

    const cuentas = await lista(sesion, 'cuentas');
    expect(cuentas.find((c) => c.id === 'c1')?.['nombre']).toBe('Nuevo');
    expect(cuentas.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('una tabla que nunca se descargó no se muestra vacía antes de descargarla', async () => {
    const remoto = new RemotoFalso();
    remoto.servidor.set('cuentas/c1', { id: 'c1', nombre: 'Nequi' });
    const { sesion } = await iniciar(remoto);

    let emitida: Fila[] | undefined;
    sesion.observar('cuentas').subscribe((filas) => (emitida = filas));
    expect(emitida).toBeUndefined();

    await sesion.descargarTodo();
    expect(emitida?.map((c) => c.id)).toEqual(['c1']);
  });

  it('ignora un cambio en vivo de una fila que tiene cambios propios sin subir', async () => {
    const remoto = new RemotoFalso();
    const { sesion } = await iniciar(remoto);
    await sesion.descargarTodo();

    remoto.enLinea = false;
    sesion.guardar('cuentas', { id: 'c1', nombre: 'Mío' });
    remoto.alCambiar?.('cuentas', { id: 'c1', nombre: 'Del servidor' });
    remoto.alCambiar?.('cuentas', { id: 'c2', nombre: 'Nueva de otro dispositivo' });

    await vi.waitFor(async () => expect(await lista(sesion, 'cuentas')).toHaveLength(2));
    const cuentas = await lista(sesion, 'cuentas');
    expect(cuentas.find((c) => c.id === 'c1')?.['nombre']).toBe('Mío');
  });

  it('actualizar quita los campos que vienen en undefined', async () => {
    const remoto = new RemotoFalso();
    const { sesion } = await iniciar(remoto);
    sesion.guardar('movimientos', { id: 'm1', monto: 1000, categoriaId: 'cat-mercado' });

    const fila = await sesion.actualizar('movimientos', 'm1', { categoriaId: undefined });
    expect(fila).toEqual({ id: 'm1', monto: 1000 });
  });
});
