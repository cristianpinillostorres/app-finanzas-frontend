import type { Categoria, Cuenta, Movimiento } from '../models';
import {
  agruparMovimientosPorDia,
  categoriasConMovimientos,
  contarFiltrosActivos,
  filtrarMovimientos,
  resumenMovimientos,
  FILTROS_MOVIMIENTOS_DEFECTO,
  type FiltrosMovimientos,
} from './movimientos-agrupados';

function mov(datos: Partial<Movimiento> & Pick<Movimiento, 'id' | 'tipo'>): Movimiento {
  return {
    fecha: '2026-09-10',
    monto: 0,
    descripcion: '',
    creadoEn: '2026-09-10T00:00:00.000Z',
    ...datos,
  };
}

function cuenta(datos: Partial<Cuenta> & Pick<Cuenta, 'id'>): Cuenta {
  return {
    nombre: datos.id,
    tipo: 'BANCO',
    color: '#000',
    cuentaPadreId: null,
    saldoInicial: 0,
    sumaEnDisponible: true,
    reservado: false,
    archivada: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...datos,
  };
}

const SIN_FILTROS: FiltrosMovimientos = {
  ...FILTROS_MOVIMIENTOS_DEFECTO,
  texto: '',
  mostrarInternos: true,
};

const HOY = new Date(2026, 8, 15); // 15 de septiembre de 2026

describe('resumenMovimientos', () => {
  it('suma ingresos y gastos; transferencias, internos y ajustes no cuentan', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'INGRESO', monto: 2_000_000 }),
      mov({ id: 'b', tipo: 'GASTO', monto: 300_000 }),
      mov({ id: 'c', tipo: 'TRANSFERENCIA', monto: 500_000 }),
      mov({ id: 'd', tipo: 'INTERNO', monto: 100_000 }),
      mov({ id: 'e', tipo: 'AJUSTE', monto: 10_000 }),
    ];
    const resumen = resumenMovimientos(movimientos);
    expect(resumen.ingresos).toBe(2_000_000);
    expect(resumen.gastos).toBe(300_000);
    expect(resumen.balance).toBe(1_700_000);
  });
});

describe('filtrarMovimientos', () => {
  const cuentas = [
    cuenta({ id: 'bancolombia' }),
    cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia' }),
  ];
  const categorias: Categoria[] = [
    {
      id: 'cat-mercado',
      nombre: 'Mercado',
      tipo: 'GASTO',
      icono: 'sell',
      archivada: false,
      personalizada: false,
      topeMensual: null,
    },
  ];

  it('el chip "GASTO" deja solo gastos', () => {
    const movimientos = [mov({ id: 'a', tipo: 'GASTO' }), mov({ id: 'b', tipo: 'INGRESO' })];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, tipo: 'GASTO' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id)).toEqual(['a']);
  });

  it('el chip "transferencia" agrupa transferencias, internos y ajustes', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'TRANSFERENCIA' }),
      mov({ id: 'b', tipo: 'INTERNO' }),
      mov({ id: 'c', tipo: 'AJUSTE' }),
      mov({ id: 'd', tipo: 'GASTO' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, tipo: 'transferencia' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('los movimientos internos se ocultan por defecto, incluso con el chip "Todos"', () => {
    const movimientos = [mov({ id: 'a', tipo: 'INTERNO' }), mov({ id: 'b', tipo: 'GASTO' })];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, mostrarInternos: false },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id)).toEqual(['b']);
  });

  it('filtrar por una cuenta raíz incluye los movimientos de sus bolsillos', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'INTERNO', cuentaOrigenId: 'bancolombia', cuentaDestinoId: 'viaje' }),
      mov({ id: 'b', tipo: 'GASTO', cuentaOrigenId: 'nequi' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, cuentaOCreditoId: 'bancolombia' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id)).toEqual(['a']);
  });

  it('filtrar por un crédito busca en origen y destino', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', creditoOrigenId: 'visa' }),
      mov({ id: 'b', tipo: 'TRANSFERENCIA', creditoDestinoId: 'visa' }),
      mov({ id: 'c', tipo: 'GASTO', creditoOrigenId: 'addi' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, cuentaOCreditoId: 'visa' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('filtra por categoría', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', categoriaId: 'cat-mercado' }),
      mov({ id: 'b', tipo: 'GASTO' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, categoriaId: 'cat-mercado' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id)).toEqual(['a']);
  });

  it('el buscador coincide con la descripción o el nombre de la categoría', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', descripcion: 'Mercado Éxito' }),
      mov({ id: 'b', tipo: 'GASTO', descripcion: 'Bus', categoriaId: 'cat-mercado' }),
      mov({ id: 'c', tipo: 'GASTO', descripcion: 'Cine' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, texto: 'mercado' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('"hoy" solo deja los movimientos del día de "hoy"', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', fecha: '2026-09-15' }),
      mov({ id: 'b', tipo: 'GASTO', fecha: '2026-09-14' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, fecha: 'hoy' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id)).toEqual(['a']);
  });

  it('"7-dias" incluye hoy y los 6 días anteriores, no el séptimo', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', fecha: '2026-09-15' }), // hoy
      mov({ id: 'b', tipo: 'GASTO', fecha: '2026-09-09' }), // hace 6 días
      mov({ id: 'c', tipo: 'GASTO', fecha: '2026-09-08' }), // hace 7 días, fuera
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, fecha: '7-dias' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('"rango" acota por desde/hasta, inclusive', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', fecha: '2026-09-04' }),
      mov({ id: 'b', tipo: 'GASTO', fecha: '2026-09-10' }),
      mov({ id: 'c', tipo: 'GASTO', fecha: '2026-09-20' }),
    ];
    const resultado = filtrarMovimientos(
      movimientos,
      { ...SIN_FILTROS, fecha: 'rango', desde: '2026-09-04', hasta: '2026-09-10' },
      cuentas,
      categorias,
      HOY,
    );
    expect(resultado.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });
});

describe('contarFiltrosActivos', () => {
  it('0 cuando todo está en su valor por defecto', () => {
    expect(contarFiltrosActivos({ ...FILTROS_MOVIMIENTOS_DEFECTO, texto: '' })).toBe(0);
  });

  it('suma 1 por cada grupo fuera de su valor por defecto, sin contar el texto', () => {
    const filtros: FiltrosMovimientos = {
      ...FILTROS_MOVIMIENTOS_DEFECTO,
      tipo: 'GASTO',
      fecha: 'hoy',
      cuentaOCreditoId: 'bancolombia',
      categoriaId: 'cat-mercado',
      mostrarInternos: true,
      texto: 'mercado',
    };
    expect(contarFiltrosActivos(filtros)).toBe(5);
  });
});

describe('categoriasConMovimientos', () => {
  it('deja solo las categorías con al menos un movimiento en la lista', () => {
    const categorias: Categoria[] = [
      {
        id: 'mercado',
        nombre: 'Mercado',
        tipo: 'GASTO',
        icono: 'sell',
        archivada: false,
        personalizada: false,
        topeMensual: null,
      },
      {
        id: 'salud',
        nombre: 'Salud',
        tipo: 'GASTO',
        icono: 'sell',
        archivada: false,
        personalizada: false,
        topeMensual: null,
      },
    ];
    const movimientos = [mov({ id: 'a', tipo: 'GASTO', categoriaId: 'mercado' })];
    const resultado = categoriasConMovimientos(categorias, movimientos);
    expect(resultado.map((c) => c.id)).toEqual(['mercado']);
  });
});

describe('agruparMovimientosPorDia', () => {
  it('agrupa por fecha y ordena del más reciente al más antiguo', () => {
    const movimientos = [
      mov({ id: 'a', tipo: 'GASTO', fecha: '2026-09-09' }),
      mov({ id: 'b', tipo: 'GASTO', fecha: '2026-09-11' }),
      mov({ id: 'c', tipo: 'GASTO', fecha: '2026-09-11' }),
    ];
    const grupos = agruparMovimientosPorDia(movimientos);
    expect(grupos.map((g) => g.fecha)).toEqual(['2026-09-11', '2026-09-09']);
    expect(grupos[0].movimientos.map((m) => m.id)).toEqual(['b', 'c']);
  });
});
