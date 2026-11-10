import { type ReporteCredito, fechaIsoDesdeLocal } from '../../core/domain';
import { formatearCop } from '../format/moneda';
import { type PdfListo, colorDeAcento, descargarArchivo, fechaCorta, plano } from './pdf-comun';

/** "zero-g-compras-2026-11-09.pdf": el nombre del crédito sin tildes ni símbolos, y el día. */
export function nombreArchivoCredito(nombre: string, generadoEn: Date): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${limpio || 'credito'}-compras-${fechaIsoDesdeLocal(generadoEn)}.pdf`;
}

/**
 * Arma el PDF de una tarjeta o plataforma: el resumen (deuda, cuota del mes,
 * cupo disponible), sus compras a cuotas con la cuota en que va cada una, y
 * sus pagos. Pensado para ponerlo al lado del extracto del banco.
 */
export async function armarPdfCredito(
  reporte: ReporteCredito,
  generadoEn: Date = new Date(),
): Promise<PdfListo> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margen = 40;
  const acento = colorDeAcento();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(plano(`${reporte.nombre}: compras y pagos`), margen, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Al ${fechaCorta(fechaIsoDesdeLocal(generadoEn))}`, margen, 64);

  const cifras: [string, string][] = [
    ['Deuda en cuotas', formatearCop(reporte.deuda)],
    ['Cuota del mes', formatearCop(reporte.cuotaDelMes)],
    ...(reporte.cupoDisponible === null
      ? []
      : ([['Cupo disponible', formatearCop(reporte.cupoDisponible)]] as [string, string][])),
    ['Total pagado', formatearCop(reporte.totalPagado)],
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

  const estiloTabla = {
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: 30 },
    headStyles: { fillColor: acento, textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [246, 247, 248] as [number, number, number] },
    margin: { left: margen, right: margen, bottom: 40 },
  };

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Compras a cuotas', margen, 138);
  autoTable(doc, {
    ...estiloTabla,
    startY: 146,
    head: [['Fecha', 'Descripción', 'Monto', 'Cuota', 'Valor cuota', 'Saldo pendiente']],
    body: reporte.compras.length
      ? reporte.compras.map((c) => [
          fechaCorta(c.fecha),
          plano(c.descripcion),
          formatearCop(c.monto),
          c.terminada ? `${c.numCuotas} de ${c.numCuotas} (pagada)` : `${c.cuotaActual} de ${c.numCuotas}`,
          formatearCop(c.valorCuota),
          formatearCop(c.saldoPendiente),
        ])
      : [['', 'Sin compras a cuotas', '', '', '', '']],
    columnStyles: {
      0: { cellWidth: 60 },
      2: { halign: 'right' },
      3: { cellWidth: 110 },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  });

  const despuesDeCompras = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 146;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Pagos', margen, despuesDeCompras + 28);
  autoTable(doc, {
    ...estiloTabla,
    startY: despuesDeCompras + 36,
    head: [['Fecha', 'Desde la cuenta', 'Monto']],
    body: reporte.pagos.length
      ? reporte.pagos.map((p) => [fechaCorta(p.fecha), plano(p.cuenta), formatearCop(p.monto)])
      : [['', 'Sin pagos registrados', '']],
    columnStyles: { 0: { cellWidth: 60 }, 2: { halign: 'right', cellWidth: 100 } },
  });

  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130);
    doc.text(
      `Página ${pagina} de ${paginas}`,
      doc.internal.pageSize.getWidth() - margen,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  return { nombre: nombreArchivoCredito(reporte.nombre, generadoEn), blob: doc.output('blob'), paginas };
}

/** Arma el PDF de una tarjeta y lo baja al dispositivo. */
export async function descargarPdfCredito(
  reporte: ReporteCredito,
  generadoEn: Date = new Date(),
): Promise<void> {
  descargarArchivo(await armarPdfCredito(reporte, generadoEn));
}
