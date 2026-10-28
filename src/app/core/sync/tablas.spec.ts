import { aFila, desdeFila } from './tablas';

describe('aFila', () => {
  it('pasa a snake_case, deja fuera lo que no tiene columna y escribe null en lo vacío', () => {
    expect(
      aFila('movimientos', {
        id: 'm1',
        monto: 5000,
        cuentaOrigenId: 'c1',
        categoriaId: undefined,
        otraCosa: 'x',
      }),
    ).toEqual({ id: 'm1', monto: 5000, cuenta_origen_id: 'c1', categoria_id: null });
  });

  it('una fecha vacía viaja como null', () => {
    expect(aFila('creditos', { fechaAcordada: '' })).toEqual({ fecha_acordada: null });
  });
});

describe('desdeFila', () => {
  it('vuelve a camelCase, omite los null y normaliza números e instantes', () => {
    expect(
      desdeFila('cuentas', {
        id: 'c1',
        user_id: 'u1',
        nombre: 'Nequi',
        entidad: null,
        saldo_inicial: '150000.00',
        creado_en: '2026-10-27T15:00:00.123456+00:00',
        actualizado_en: '2026-10-27T15:00:00+00:00',
      }),
    ).toEqual({
      id: 'c1',
      nombre: 'Nequi',
      saldoInicial: 150000,
      creadoEn: '2026-10-27T15:00:00.123Z',
    });
  });
});
