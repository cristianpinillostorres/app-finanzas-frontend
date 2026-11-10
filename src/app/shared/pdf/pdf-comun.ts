/**
 * Lo que comparten los PDF de la app. Estos archivos se cargan solo al
 * descargar (`import()` dinámico), para que `jspdf` no pese en el arranque.
 *
 * Los PDF usan la letra estándar (Helvetica): lleva tildes y la ñ, pero no
 * flechas ni el signo "−" de verdad, por eso los textos pasan por `plano`.
 */

const COLOR_ACENTO_RESPALDO = '#1f5a5f';

/** El PDF solo entiende Latin-1: cambia los símbolos que no caben (› → >, − → -). */
export function plano(texto: string): string {
  return texto.replace(/[›→]/g, '>').replace(/[−–]/g, '-');
}

/** "2026-11-05" → "05/11/2026". */
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** El color de acento de la app, leído del tema; si no se puede leer, uno de respaldo. */
export function colorDeAcento(): string {
  if (typeof document === 'undefined') return COLOR_ACENTO_RESPALDO;
  const valor = getComputedStyle(document.documentElement).getPropertyValue('--accent-solid').trim();
  return /^#[0-9a-f]{6}$/i.test(valor) ? valor : COLOR_ACENTO_RESPALDO;
}

/** El PDF ya armado y el nombre con el que se descarga. */
export interface PdfListo {
  nombre: string;
  blob: Blob;
  paginas: number;
}

/** Baja un archivo al dispositivo con un enlace temporal. */
export function descargarArchivo({ nombre, blob }: Pick<PdfListo, 'nombre' | 'blob'>): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se suelta un momento después: algunos navegadores aún están leyendo el archivo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
