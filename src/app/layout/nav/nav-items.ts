export interface NavItem {
  path: string;
  label: string;
  /** Nombre del ícono de Material Symbols Outlined. */
  icon: string;
}

/** Las cinco tabs de la app, en el orden en que se muestran. */
export const NAV_ITEMS: NavItem[] = [
  { path: 'general', label: 'General', icon: 'dashboard' },
  { path: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' },
  { path: 'creditos', label: 'Créditos', icon: 'credit_card' },
  { path: 'movimientos', label: 'Movimientos', icon: 'swap_horiz' },
  { path: 'pagos-fijos', label: 'Pagos fijos', icon: 'event_repeat' },
];
