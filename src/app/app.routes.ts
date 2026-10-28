import { Routes } from '@angular/router';

import { conCuenta } from './core/auth/con-cuenta.guard';
import { sinRecorridoPendiente } from './shared/bienvenida/sin-recorrido-pendiente.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'general' },
  {
    path: 'general',
    loadComponent: () => import('./features/general/general.page').then((m) => m.GeneralPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'General',
  },
  {
    path: 'cuentas',
    loadComponent: () => import('./features/cuentas/cuentas.page').then((m) => m.CuentasPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'Cuentas',
  },
  {
    path: 'creditos',
    loadComponent: () => import('./features/creditos/creditos.page').then((m) => m.CreditosPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'Créditos',
  },
  {
    path: 'movimientos',
    loadComponent: () =>
      import('./features/movimientos/movimientos.page').then((m) => m.MovimientosPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'Movimientos',
  },
  {
    path: 'pagos-fijos',
    loadComponent: () =>
      import('./features/pagos-fijos/pagos-fijos.page').then((m) => m.PagosFijosPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'Pagos fijos',
  },
  {
    // Pantalla completa, sin la navegación del `Shell` (ver `pantallaCompleta`).
    path: 'bienvenida',
    loadComponent: () =>
      import('./features/bienvenida/bienvenida.page').then((m) => m.BienvenidaPage),
    title: 'Bienvenida',
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./features/categorias/categorias.page').then((m) => m.CategoriasPage),
    canActivate: [conCuenta, sinRecorridoPendiente],
    title: 'Categorías',
  },
  { path: '**', redirectTo: 'general' },
];
