import type { Cuenta } from '../models';
import { descripcionAutomaticaTransferencia, esInterno } from './clasificacion-movimiento';

function cuenta(datos: Partial<Cuenta> & Pick<Cuenta, 'id'>): Cuenta {
  return {
    nombre: datos.id,
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

describe('esInterno', () => {
  it('es interno entre el saldo libre de una cuenta y uno de sus bolsillos', () => {
    const madre = cuenta({ id: 'bancolombia' });
    const bolsillo = cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia' });
    expect(esInterno(madre, bolsillo)).toBe(true);
    expect(esInterno(bolsillo, madre)).toBe(true);
  });

  it('es interno entre dos bolsillos de la misma cuenta', () => {
    const a = cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia' });
    const b = cuenta({ id: 'emergencias', cuentaPadreId: 'bancolombia' });
    expect(esInterno(a, b)).toBe(true);
  });

  it('no es interno entre cuentas distintas', () => {
    const bancolombia = cuenta({ id: 'bancolombia' });
    const nequi = cuenta({ id: 'nequi' });
    expect(esInterno(bancolombia, nequi)).toBe(false);
  });

  it('no es interno entre bolsillos de cuentas distintas', () => {
    const a = cuenta({ id: 'viaje', cuentaPadreId: 'bancolombia' });
    const b = cuenta({ id: 'meta', cuentaPadreId: 'nequi' });
    expect(esInterno(a, b)).toBe(false);
  });
});

describe('descripcionAutomaticaTransferencia', () => {
  it('usa "Pago de <crédito>" cuando el destino es un crédito', () => {
    expect(
      descripcionAutomaticaTransferencia({
        nombreCreditoDestino: 'Visa',
        destinoEsEfectivo: false,
      }),
    ).toBe('Pago de Visa');
  });

  it('usa "Retiro" cuando el destino es efectivo', () => {
    expect(descripcionAutomaticaTransferencia({ destinoEsEfectivo: true })).toBe('Retiro');
  });

  it('usa "Transferencia" en cualquier otro caso', () => {
    expect(descripcionAutomaticaTransferencia({ destinoEsEfectivo: false })).toBe('Transferencia');
  });
});
