import { type ReporteMovimientos, fechaIsoDesdeLocal, nombreTipoMovimiento } from '../../core/domain';
import { formatearCop } from '../format/moneda';
import { type PdfListo, colorDeAcento, descargarArchivo, fechaCorta, plano } from './pdf-comun';

/** Los pesos con su signo: gastos con "-", ingresos con "+", el resto sin signo. */
function montoConSigno(tipo: string, monto: number): string {
  const texto = formatearCop(monto);
  if (tipo === 'GASTO') return `-${texto}`;
  if (tipo === 'INGRESO') return `+${texto}`;
  return texto;
}

/** "movimientos-2026-11.pdf" para un mes, "movimientos-todo.pdf" sin rango. */
export function nombreArchivoMovimientos(reporte: ReporteMovimientos): string {
  const { desde, hasta } = reporte.rango;
  if (!desde || !hasta) return 'movimientos-todo.pdf';
  return desde.slice(0, 7) === hasta.slice(0, 7)
    ? `movimientos-${desde.slice(0, 7)}.pdf`
    : `movimientos-${desde}-a-${hasta}.pdf`;
}

/**
 * Arma el PDF: título con el periodo, el resumen de ingresos, gastos y
 * balance, y la tabla de movimientos (con encabezado repetido en cada hoja y
 * el número de página abajo).
 */
export async function armarPdfMovimientos(
  reporte: ReporteMovimientos,
  titulo: string,
  generadoEn: Date = new Date(),
): Promise<PdfListo> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margen = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(plano(titulo), margen, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Generado el ${fechaCorta(fechaIsoDesdeLocal(generadoEn))} · ${reporte.filas.length} movimientos`,
    margen,
    64,
  );

  // Resumen: tres cifras en una fila.
  const cifras: [string, string][] = [
    ['Ingresos', formatearCop(reporte.ingresos)],
    ['Gastos', formatearCop(reporte.gastos)],
    ['Balance', plano(formatearCop(reporte.balance))],
  ];
  cifras.forEach(([rotulo, valor], i) => {
    const x = margen + i * 170;
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(rotulo, x, 92);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(valor, x, 110);
    doc.setFont('helvetica', 'normal');
  });

  autoTable(doc, {
    startY: 128,
    margin: { left: margen, right: margen, bottom: 40 },
    head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Cuenta', 'Monto']],
    body: reporte.filas.map((f) => [
      fechaCorta(f.fecha),
      nombreTipoMovimiento(f.tipo),
      plano(f.descripcion),
      plano(f.categoria),
      plano(f.cuenta),
      montoConSigno(f.tipo, f.monto),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: 30 },
    headStyles: { fillColor: colorDeAcento(), textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 248] },
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: 70 },
      5: { halign: 'right', cellWidth: 80 },
    },
  });

  // El número de página, ya con el total: solo se sabe cuando la tabla terminó.
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
      `Página ${pagina} de ${paginas}`,
      doc.internal.pageSize.getWidth() - margen,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  return { nombre: nombreArchivoMovimientos(reporte), blob: doc.output('blob'), paginas };
}

/** Arma el PDF de movimientos y lo baja al dispositivo. */
export async function descargarPdfMovimientos(
  reporte: ReporteMovimientos,
  titulo: string,
  generadoEn: Date = new Date(),
): Promise<void> {
  descargarArchivo(await armarPdfMovimientos(reporte, titulo, generadoEn));
}
