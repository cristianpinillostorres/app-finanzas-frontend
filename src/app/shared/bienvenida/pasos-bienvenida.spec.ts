import { describe, expect, it } from 'vitest';

import {
  type ContextoBienvenida,
  type PasoBienvenida,
  PASOS_BIENVENIDA,
  estadoBienvenida,
} from './pasos-bienvenida';

const vacio: ContextoBienvenida = {
  cuentas: 0,
  categoriasAjustadas: false,
  creditos: 0,
  pagosFijos: 0,
  movimientos: 0,
  presupuestos: 0,
};
const completo: ContextoBienvenida = {
  cuentas: 1,
  categoriasAjustadas: true,
  creditos: 1,
  pagosFijos: 1,
  movimientos: 1,
  presupuestos: 1,
};

const extra: PasoBienvenida = {
  id: 'otro',
  bloque: 'extra',
  titulo: 'Ponle tope a una categoría',
  descripcion: '',
  icono: 'savings',
  guia: '',
  destino: { ruta: '/categorias' },
  hecho: () => false,
  omitir: 'No me interesa',
};

describe('estadoBienvenida', () => {
  it('en una cuenta nueva muestra lo esencial, todo pendiente', () => {
    const estado = estadoBienvenida(PASOS_BIENVENIDA, vacio, new Set())!;
    expect(estado.bloque).toBe('esencial');
    expect(estado.resueltos).toBe(0);
    expect(estado.pasos.every((p) => p.estado === 'pendiente')).toBe(true);
  });

  it('"No tengo deudas" cuenta como resuelto', () => {
    const contexto = { ...completo, creditos: 0 };
    expect(estadoBienvenida(PASOS_BIENVENIDA, contexto, new Set(['creditos']))).toBeNull();
  });

  it('un paso sin `omitir` no se puede saltar aunque esté en omitidos', () => {
    const estado = estadoBienvenida(PASOS_BIENVENIDA, vacio, new Set(['cuentas']))!;
    expect(estado.pasos.find((p) => p.paso.id === 'cuentas')!.estado).toBe('pendiente');
  });

  it('con lo esencial listo pasa a los extras', () => {
    const estado = estadoBienvenida([...PASOS_BIENVENIDA, extra], completo, new Set())!;
    expect(estado.bloque).toBe('extra');
    expect(estado.pasos.filter((p) => p.estado === 'pendiente').map((p) => p.paso.id)).toEqual([
      'otro',
    ]);
  });

  it('sin extras pendientes no muestra nada', () => {
    expect(estadoBienvenida(PASOS_BIENVENIDA, completo, new Set())).toBeNull();
    expect(estadoBienvenida([...PASOS_BIENVENIDA, extra], completo, new Set(['otro']))).toBeNull();
  });

  it('deja fuera los pasos que no aplican', () => {
    const soloConDeudas = { ...extra, aplica: (c: ContextoBienvenida) => c.creditos > 0 };
    const contexto = { ...completo, creditos: 0 };
    expect(
      estadoBienvenida([...PASOS_BIENVENIDA, soloConDeudas], contexto, new Set(['creditos'])),
    ).toBeNull();
  });

  it('sube en los extras los pasos que sirven a lo que quiere lograr', () => {
    const deudas: PasoBienvenida = { ...extra, id: 'deudas', objetivos: ['deudas'] };
    const ahorro: PasoBienvenida = { ...extra, id: 'ahorro', objetivos: ['ahorrar'] };
    const pasos = [...PASOS_BIENVENIDA, extra, deudas, ahorro];
    const ids = (objetivos: Parameters<typeof estadoBienvenida>[3]) =>
      estadoBienvenida(pasos, completo, new Set(), objetivos)!.pasos.map((p) => p.paso.id);

    expect(ids([])).toEqual(['presupuesto', 'otro', 'deudas', 'ahorro']);
    expect(ids(['ahorrar', 'deudas'])).toEqual(['deudas', 'ahorro', 'presupuesto', 'otro']);
  });

  it('no reordena lo esencial', () => {
    const conObjetivo = PASOS_BIENVENIDA.map((p) =>
      p.id === 'movimientos' ? { ...p, objetivos: ['gastos' as const] } : p,
    );
    const estado = estadoBienvenida(conObjetivo, vacio, new Set(), ['gastos'])!;
    expect(estado.pasos.map((p) => p.paso.id)).toEqual(
      PASOS_BIENVENIDA.filter((p) => p.bloque === 'esencial').map((p) => p.id),
    );
  });
});
