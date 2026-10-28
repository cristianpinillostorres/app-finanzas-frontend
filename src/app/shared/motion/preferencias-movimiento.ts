/**
 * Si el sistema pide menos movimiento.
 *
 * La regla de la app es que ninguna animación no esencial corre cuando esto
 * es `true`. El CSS ya se apaga solo (los tokens `--dur-*` bajan a ~0 bajo
 * `prefers-reduced-motion`, ver `styles/tokens/_semanticos.scss`); esta
 * función es para el movimiento escrito en JavaScript, que no pasa por esos
 * tokens: el conteo de montos, la aparición escalonada y las animaciones
 * internas de ApexCharts.
 *
 * Se consulta en cada llamada en vez de guardarse: la preferencia puede
 * cambiar con la sesión abierta.
 */
export function prefiereMenosMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
