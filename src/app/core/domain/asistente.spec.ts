import { describe, expect, it } from 'vitest';

import type { Categoria } from '../models';
import {
  alertaDelAsistente,
  claveDeAlerta,
  restanteEnPresupuestos,
  textoDeIaValido,
  topesAjustadosALibre,
  type ContextoAsistente,
} from './asistente';
import type { ProgresoMeta } from './metas-ahorro';
import type { PresupuestoDelMes } from './presupuestos';

const fmt = (n: number) => `$${n}`;

function presupuesto(id: string, tope: number, gastado: number, extra = {}): PresupuestoDelMes {
  const categoria: Categoria = {
    id,
    nombre: id,
    tipo: 'GASTO',
    icono: 'sell',
    archivada: false,
    personalizada: false,
    topeMensual: tope,
  };
  const proporcion = gastado / tope;
  return {
    categoria,
    gastado,
    deOtras: 0,
    tope,
    proporcion,
    restante: tope - gastado,
    estado: proporcion > 1 ? 'pasado' : proporcion >= 0.8 ? 'cerca' : 'bien',
    ritmoAlto: false,
    ...extra,
  };
}

function meta(id: string, aporte: number, faltante: number, cumplida = false): ProgresoMeta {
  return {
    meta: { id, nombre: id, objetivo: 0, aporteMensual: aporte, bolsilloId: 'b' },
    ahorrado: 0,
    falta: 0,
    proporcion: 0,
    cumplida,
    aportadoEnCiclo: 0,
    aporteFaltante: faltante,
    mesesParaLlegar: null,
    sinBolsillo: false,
    sinObjetivo: false,
  };
}

/** Un mes tranquilo: nada que avisar. */
const TRANQUILO: ContextoAsistente = {
  disponible: 1_000_000,
  porPagar: 200_000,
  pagosPendientes: 2,
  hasta: 'tu pago',
  libreParaGastar: 800_000,
  libreAntesDeMetas: 800_000,
  presupuestos: [presupuesto('comida', 500_000, 100_000)],
  cuotasDelMes: 300_000,
  comprometido: 0.2,
  estadoComprometido: 'bien',
  comprasACuotas: 0,
  pagosDeuda: 300_000,
  metas: [],
};

describe('restanteEnPresupuestos', () => {
  it('suma lo que queda y no resta lo que ya se pasó', () => {
    const lista = [presupuesto('a', 100, 40), presupuesto('b', 100, 130)];
    expect(restanteEnPresupuestos(lista)).toBe(60);
  });
});

describe('topesAjustadosALibre', () => {
  it('no sugiere nada si lo que queda por gastar ya cabe en lo libre', () => {
    expect(topesAjustadosALibre([presupuesto('a', 100_000, 0)], 100_000)).toEqual({});
  });

  it('reduce lo que queda por gastar en la misma proporción y deja lo ya gastado', () => {
    const lista = [presupuesto('a', 300_000, 100_000), presupuesto('b', 200_000, 0)];
    // Quedan 200.000 + 200.000 = 400.000 y hay 200.000 libres: mitad y mitad.
    const topes = topesAjustadosALibre(lista, 200_000);
    expect(topes).toEqual({ a: 200_000, b: 100_000 });
    const nuevoRestante = (topes['a'] - 100_000) + (topes['b'] - 0);
    expect(nuevoRestante).toBeLessThanOrEqual(200_000);
  });

  it('no toca los presupuestos que ya se pasaron', () => {
    const lista = [presupuesto('a', 100_000, 150_000), presupuesto('b', 400_000, 0)];
    expect(Object.keys(topesAjustadosALibre(lista, 100_000))).toEqual(['b']);
  });

  it('sin plata libre no sugiere topes', () => {
    expect(topesAjustadosALibre([presupuesto('a', 100_000, 0)], 0)).toEqual({});
  });
});

describe('alertaDelAsistente', () => {
  it('pagos: avisa lo que falta cuando lo disponible no alcanza', () => {
    const alerta = alertaDelAsistente(
      'pagos',
      { ...TRANQUILO, disponible: 50_000, porPagar: 200_000 },
      fmt,
    );
    expect(alerta?.gravedad).toBe(3);
    expect(alerta?.texto).toContain('$150000');
    expect(alerta?.accion).toMatchObject({ tipo: 'IR_A', ruta: '/pagos-fijos' });
  });

  it('pagos: si está cubierto, lo dice con gravedad baja', () => {
    const alerta = alertaDelAsistente('pagos', TRANQUILO, fmt);
    expect(alerta?.gravedad).toBe(1);
    expect(alerta?.texto).toContain('cubiertos');
  });

  it('gastos: cruza los presupuestos con lo libre y sugiere topes', () => {
    const contexto = {
      ...TRANQUILO,
      libreParaGastar: 105_000,
      presupuestos: [presupuesto('a', 300_000, 100_000), presupuesto('b', 267_000, 0)],
    };
    const alerta = alertaDelAsistente('gastos', contexto, fmt);
    expect(alerta?.gravedad).toBe(3);
    expect(alerta?.texto).toContain('$467000');
    expect(alerta?.texto).toContain('$105000');
    expect(alerta?.accion.tipo).toBe('AJUSTAR_TOPES');
    if (alerta?.accion.tipo === 'AJUSTAR_TOPES') {
      expect(Object.keys(alerta.accion.topes).length).toBeGreaterThan(0);
    }
  });

  it('gastos: sin plata libre manda a ver los pagos, no a ajustar topes', () => {
    const alerta = alertaDelAsistente('gastos', { ...TRANQUILO, libreParaGastar: -5_000 }, fmt);
    expect(alerta?.gravedad).toBe(3);
    expect(alerta?.accion).toMatchObject({ tipo: 'IR_A', ruta: '/pagos-fijos' });
  });

  it('gastos: avisa del presupuesto que va más rápido que el mes', () => {
    const rapido = presupuesto('restaurantes', 100_000, 70_000, { ritmoAlto: true, estado: 'cerca' });
    const alerta = alertaDelAsistente('gastos', { ...TRANQUILO, presupuestos: [rapido] }, fmt);
    expect(alerta?.gravedad).toBe(2);
    expect(alerta?.texto).toContain('restaurantes');
    expect(alerta?.texto).toContain('70 %');
  });

  it('deudas: si compró a cuotas más de lo que pagó, dice que la deuda subió', () => {
    const alerta = alertaDelAsistente(
      'deudas',
      { ...TRANQUILO, comprasACuotas: 3_840_000, pagosDeuda: 1_570_000, comprometido: 0.65 },
      fmt,
    );
    expect(alerta?.texto).toContain('tu deuda subió');
    expect(alerta?.texto).toContain('65 %');
    expect(alerta?.accion).toMatchObject({ ruta: '/creditos' });
  });

  it('deudas: sin compras nuevas, dice el porcentaje y el margen', () => {
    const alerta = alertaDelAsistente(
      'deudas',
      { ...TRANQUILO, comprometido: 0.65, estadoComprometido: 'pasado' },
      fmt,
    );
    expect(alerta?.gravedad).toBe(3);
    expect(alerta?.texto).toContain('margen crítico');
  });

  it('ahorrar: si no alcanza lo libre ofrece pausar las metas con aporte', () => {
    const alerta = alertaDelAsistente(
      'ahorrar',
      {
        ...TRANQUILO,
        libreAntesDeMetas: 100_000,
        metas: [meta('viaje', 150_000, 150_000), meta('listo', 50_000, 0, true)],
      },
      fmt,
    );
    expect(alerta?.gravedad).toBe(3);
    expect(alerta?.accion).toEqual({
      tipo: 'PAUSAR_METAS',
      etiqueta: 'Pausar mis metas',
      metasIds: ['viaje'],
    });
  });

  it('orden y sin objetivo: dice la más urgente de todas', () => {
    const contexto = { ...TRANQUILO, disponible: 10_000, porPagar: 200_000 };
    expect(alertaDelAsistente('orden', contexto, fmt)?.tema).toBe('pagos');
    expect(alertaDelAsistente(null, contexto, fmt)?.tema).toBe('pagos');
  });

  it('orden: no molesta con avisos de gravedad baja', () => {
    expect(alertaDelAsistente('orden', TRANQUILO, fmt)).toBeNull();
  });

  it('si el tema elegido no tiene nada, cae a la más urgente de las demás', () => {
    // Quiere ahorrar pero no tiene metas, y no le alcanza para sus pagos.
    const contexto = { ...TRANQUILO, disponible: 10_000, porPagar: 200_000 };
    expect(alertaDelAsistente('ahorrar', contexto, fmt)?.tema).toBe('pagos');
  });

  it('sin nada que avisar devuelve null', () => {
    expect(alertaDelAsistente('deudas', { ...TRANQUILO, comprometido: null }, fmt)).toBeNull();
  });
});

describe('textos con IA', () => {
  const alerta = alertaDelAsistente(
    'deudas',
    { ...TRANQUILO, comprasACuotas: 3_840_000, pagosDeuda: 1_570_000, comprometido: 0.65 },
    fmt,
  )!;

  it('cada alerta trae titular, consejo y las cifras que la respaldan', () => {
    expect(alerta.titular).toBeTruthy();
    expect(alerta.consejo).toBeTruthy();
    expect(alerta.evidencia.map((e) => e.valor)).toEqual([3_840_000, 1_570_000]);
    expect(alerta.evidencia[0].alerta).toBe(true);
  });

  it('acepta un texto sin cifras o con un porcentaje que está en los hechos', () => {
    expect(textoDeIaValido('Tu deuda sube; piensa antes de otra cuota', alerta)).toBe(true);
    expect(textoDeIaValido('Tus cuotas ya son el 65 % de tus ingresos', alerta)).toBe(true);
  });

  it('rechaza un texto con una cifra que no es de los hechos', () => {
    expect(textoDeIaValido('Te sobran $500.000 este mes', alerta)).toBe(false);
    expect(textoDeIaValido('Tus cuotas son el 80 % de tus ingresos', alerta)).toBe(false);
  });

  it('la clave cambia cuando cambian las cifras', () => {
    const otra = alertaDelAsistente(
      'deudas',
      { ...TRANQUILO, comprasACuotas: 4_000_000, pagosDeuda: 1_570_000, comprometido: 0.65 },
      fmt,
    )!;
    expect(claveDeAlerta(otra)).not.toBe(claveDeAlerta(alerta));
    expect(claveDeAlerta(alerta)).toBe(claveDeAlerta(alerta));
  });
});
