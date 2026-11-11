export interface NavItem {
  path: string;
  label: string;
  /** Nombre del ícono de Material Symbols Outlined. */
  icon: string;
  /**
   * Solo en el lateral de escritorio. La barra de abajo del celular tiene
   * cinco lugares y los nombres ya llegan justos a 360px; lo que queda
   * fuera vive en el menú de la cuenta.
   */
  soloEscritorio?: boolean;
}

/** Las tabs de la app, en el orden en que se muestran. */
export const NAV_ITEMS: NavItem[] = [
  { path: 'general', label: 'General', icon: 'dashboard' },
  { path: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' },
  { path: 'creditos', label: 'Créditos', icon: 'credit_card' },
  { path: 'ahorro', label: 'Ahorro', icon: 'savings', soloEscritorio: true },
  { path: 'movimientos', label: 'Movimientos', icon: 'swap_horiz' },
  { path: 'pagos-fijos', label: 'Pagos fijos', icon: 'event_repeat' },
  // En el teléfono vive en el menú de la cuenta; en escritorio es una sección más.
  { path: 'categorias', label: 'Categorías', icon: 'sell', soloEscritorio: true },
];
