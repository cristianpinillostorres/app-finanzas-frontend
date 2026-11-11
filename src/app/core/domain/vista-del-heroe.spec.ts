import { type ContextoHeroe, vistaDelHeroe } from './vista-del-heroe';

const TODO: ContextoHeroe = { hayMetas: true, hayDeudas: true, hayPagosPendientes: true };
const NADA: ContextoHeroe = { hayMetas: false, hayDeudas: false, hayPagosPendientes: false };

describe('vistaDelHeroe', () => {
  it('cada objetivo muestra su cifra cuando hay con qué', () => {
    expect(vistaDelHeroe('ahorrar', TODO)).toBe('ahorro');
    expect(vistaDelHeroe('deudas', TODO)).toBe('deudas');
    expect(vistaDelHeroe('pagos', TODO)).toBe('pagos');
  });

  it('si el objetivo no tiene con qué mostrarse, vuelve a la vista de gasto', () => {
    expect(vistaDelHeroe('ahorrar', NADA)).toBe('gasto');
    expect(vistaDelHeroe('deudas', NADA)).toBe('gasto');
    expect(vistaDelHeroe('pagos', NADA)).toBe('gasto');
  });

  it('controlar gastos, tenerlo todo en un lugar y no elegir nada usan la vista de siempre', () => {
    expect(vistaDelHeroe('gastos', TODO)).toBe('gasto');
    expect(vistaDelHeroe('orden', TODO)).toBe('gasto');
    expect(vistaDelHeroe(null, TODO)).toBe('gasto');
  });
});
