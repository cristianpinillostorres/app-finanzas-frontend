import type { Cuenta, Movimiento, TipoCuenta } from '../models';
import { saldoCuenta, saldoTotalCuenta } from './cuentas';

/** Bolsillo con su saldo ya calculado, listo para pintar en pantalla. */
export interface BolsilloConSaldo {
  cuenta: Cuenta;
  saldo: number;
}

/** Cuenta raíz con su saldo libre, total y bolsillos, ya calculados. */
export interface CuentaConSaldo {
  cuenta: Cuenta;
  saldoLibre: number;
  saldoTotal: number;
  bolsillos: BolsilloConSaldo[];
}

export interface GrupoCuentas {
  tipo: TipoCuenta;
  etiqueta: string;
  /** Suma de `saldoTotal` de las cuentas del grupo. */
  subtotal: number;
  cuentas: CuentaConSaldo[];
}

const ETIQUETA_TIPO: Record<TipoCuenta, string> = {
  BANCO: 'Banco',
  BILLETERA: 'Billetera digital',
  EFECTIVO: 'Efectivo',
  OTRO: 'Otro',
};

/** Orden fijo de los grupos en pantalla, igual al prototipo. */
const ORDEN_TIPOS: TipoCuenta[] = ['BANCO', 'BILLETERA', 'EFECTIVO', 'OTRO'];

/**
 * Cuentas raíz (sin archivar) agrupadas por tipo, en el orden del
 * prototipo, cada una con su saldo libre/total y sus bolsillos (sin
 * archivar) con saldo. Los grupos sin cuentas se devuelven igual, vacíos,
 * para poder mostrar su estado vacío ("Otro").
 */
export function agruparCuentasPorTipo(
  cuentas: Cuenta[],
  movimientos: Movimiento[],
): GrupoCuentas[] {
  const raices = cuentas.filter((c) => c.cuentaPadreId === null && !c.archivada);

  return ORDEN_TIPOS.map((tipo) => {
    const cuentasDelGrupo: CuentaConSaldo[] = raices
      .filter((raiz) => raiz.tipo === tipo)
      .map((raiz) => {
        const bolsillos = cuentas.filter((c) => c.cuentaPadreId === raiz.id && !c.archivada);
        return {
          cuenta: raiz,
          saldoLibre: saldoCuenta(raiz, movimientos),
          saldoTotal: saldoTotalCuenta(raiz, cuentas, movimientos),
          bolsillos: bolsillos.map((bolsillo) => ({
            cuenta: bolsillo,
            saldo: saldoCuenta(bolsillo, movimientos),
          })),
        };
      });

    return {
      tipo,
      etiqueta: ETIQUETA_TIPO[tipo],
      subtotal: cuentasDelGrupo.reduce((acc, c) => acc + c.saldoTotal, 0),
      cuentas: cuentasDelGrupo,
    };
  });
}
