import type { Credito, Cuenta } from '../models';
import {
  gruposPagarCon,
  gruposTransferenciaHacia,
  opcionesCreditosPorGrupo,
  opcionesCuentasYBolsillos,
  opcionesTodosLosCreditos,
} from './opciones-cuenta';

function cuenta(datos: Partial<Cuenta> & Pick<Cuenta, 'id' | 'nombre'>): Cuenta {
  return {
    tipo: 'BANCO',
    color: '#000000',
    cuentaPadreId: null,
    saldoInicial: 0,
    sumaEnDisponible: true,
    reservado: false,
    archivada: false,
    creadoEn: '2026-01-01',
    ...datos,
  };
}

const bancolombia = cuenta({ id: 'bancolombia', nombre: 'Bancolombia' });
const viaje = cuenta({ id: 'viaje', nombre: 'Viaje', cuentaPadreId: 'bancolombia' });
const emergencias = cuenta({
  id: 'emergencias',
  nombre: 'Emergencias',
  cuentaPadreId: 'bancolombia',
});
const nequi = cuenta({ id: 'nequi', nombre: 'Nequi' });
const archivada = cuenta({ id: 'vieja', nombre: 'Vieja', archivada: true });

describe('opcionesCuentasYBolsillos', () => {
  it('pone cada bolsillo justo después de su cuenta madre, con el formato "Madre › Bolsillo"', () => {
    const opciones = opcionesCuentasYBolsillos([bancolombia, viaje, emergencias, nequi]);
    expect(opciones.map((o) => o.etiqueta)).toEqual([
      'Bancolombia',
      'Bancolombia › Viaje',
      'Bancolombia › Emergencias',
      'Nequi',
    ]);
  });

  it('ignora cuentas archivadas', () => {
    const opciones = opcionesCuentasYBolsillos([bancolombia, archivada]);
    expect(opciones.map((o) => o.id)).toEqual(['bancolombia']);
  });

  it('marca todas las opciones con tipo "cuenta"', () => {
    const opciones = opcionesCuentasYBolsillos([bancolombia, viaje]);
    expect(opciones.every((o) => o.tipo === 'cuenta')).toBe(true);
  });
});

const visa: Credito = {
  id: 'visa',
  grupo: 'TARJETA',
  nombre: 'Visa',
  diaPago: 5,
  diaCorte: 20,
  cupo: 1_000_000,
  archivado: false,
};
const addi: Credito = {
  id: 'addi',
  grupo: 'PLATAFORMA',
  nombre: 'Addi',
  diaPago: 15,
  cupo: 500_000,
  archivado: false,
};
const libreInversion: Credito = {
  id: 'libre-inversion',
  grupo: 'BANCO',
  nombre: 'Libre inversión',
  diaPago: 5,
  monto: 1_000_000,
  tasaEa: 0.2,
  tipoTasa: 'FIJA',
  plazoMeses: 12,
  cuotasPagadasIniciales: 0,
  seguroMensual: 0,
  archivado: false,
};
const archivadaTarjeta: Credito = { ...visa, id: 'visa-vieja', archivado: true };

describe('opcionesCreditosPorGrupo', () => {
  it('filtra por grupo e ignora archivados', () => {
    const opciones = opcionesCreditosPorGrupo([visa, addi, archivadaTarjeta], 'TARJETA');
    expect(opciones).toEqual([{ id: 'visa', tipo: 'credito', etiqueta: 'Visa' }]);
  });
});

describe('opcionesTodosLosCreditos', () => {
  it('incluye créditos de cualquier grupo, sin archivados', () => {
    const opciones = opcionesTodosLosCreditos([visa, addi, libreInversion, archivadaTarjeta]);
    expect(opciones.map((o) => o.id)).toEqual(['visa', 'addi', 'libre-inversion']);
  });
});

describe('gruposPagarCon', () => {
  it('incluye cuentas, y solo tarjetas/plataformas que existan', () => {
    const grupos = gruposPagarCon([bancolombia], [visa, addi, libreInversion]);
    expect(grupos.map((g) => g.etiqueta)).toEqual([
      'Cuentas y bolsillos',
      'Tarjetas',
      'Plataformas',
    ]);
  });

  it('omite el grupo de tarjetas si no hay ninguna', () => {
    const grupos = gruposPagarCon([bancolombia], [addi]);
    expect(grupos.map((g) => g.etiqueta)).toEqual(['Cuentas y bolsillos', 'Plataformas']);
  });
});

describe('gruposTransferenciaHacia', () => {
  it('incluye cuentas y todos los créditos', () => {
    const grupos = gruposTransferenciaHacia([bancolombia], [visa, libreInversion]);
    expect(grupos.map((g) => g.etiqueta)).toEqual(['Cuentas y bolsillos', 'Créditos']);
    expect(grupos[1].opciones.map((o) => o.id)).toEqual(['visa', 'libre-inversion']);
  });
});
