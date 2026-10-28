import { Component, computed, inject, input } from '@angular/core';
import {
  ChartComponent,
  type ApexAxisChartSeries,
  type ApexChart,
  type ApexGrid,
  type ApexMarkers,
  type ApexStroke,
  type ApexTooltip,
  type ApexXAxis,
  type ApexYAxis,
} from 'ng-apexcharts';

import type { PuntoTendencia } from '../../../core/domain';
import { MontosVisibilityService } from '../../../core/montos-visibility.service';
import { ThemeService } from '../../../core/theme.service';
import { formatearCop } from '../../format/moneda';
import { prefiereMenosMovimiento } from '../../motion/preferencias-movimiento';
import { Amount } from '../../amount/amount';
import { cromaticaBase, leerColorToken } from '../paleta-graficas';

/**
 * Mini tendencia de ingresos vs gastos acumulados del mes.
 *
 * Dos series en **un solo eje**: las dos son pesos, así que comparten
 * escala. Un eje por serie haría que la posición relativa de las líneas
 * dependiera de dos escalas arbitrarias, y entonces "los gastos pasaron a
 * los ingresos" podría ser verdad o mentira según cómo quedó el gráfico.
 *
 * El color no es categórico sino semántico, el mismo del resto de la app:
 * verde para ingresos, rojo suave para gastos. Y cada serie lleva su valor
 * final en texto en la leyenda, así que la identidad nunca depende solo del
 * color.
 */
@Component({
  selector: 'app-tendencia-mes-chart',
  standalone: true,
  imports: [ChartComponent, Amount],
  templateUrl: './tendencia-mes-chart.html',
  styleUrl: './tendencia-mes-chart.scss',
})
export class TendenciaMesChart {
  puntos = input.required<readonly PuntoTendencia[]>();

  private readonly tema = inject(ThemeService);
  private readonly montos = inject(MontosVisibilityService);
  protected readonly oculto = this.montos.oculto;

  protected readonly totalIngresos = computed(() => this.puntos().at(-1)?.ingresos ?? 0);
  protected readonly totalGastos = computed(() => this.puntos().at(-1)?.gastos ?? 0);

  /** Se recalculan con el tema: los tokens de color cambian de valor. */
  protected readonly colorIngreso = computed(() => {
    this.tema.oscuro();
    return leerColorToken('--color-ingreso', '#3ecf8e');
  });
  protected readonly colorGasto = computed(() => {
    this.tema.oscuro();
    return leerColorToken('--color-gasto', '#f27a7d');
  });
  private readonly base = computed(() => {
    this.tema.oscuro();
    return cromaticaBase();
  });

  protected readonly series = computed<ApexAxisChartSeries>(() => [
    { name: 'Ingresos', data: this.puntos().map((p) => p.ingresos) },
    { name: 'Gastos', data: this.puntos().map((p) => p.gastos) },
  ]);

  protected readonly colores = computed(() => [this.colorIngreso(), this.colorGasto()]);

  protected readonly chart = computed<ApexChart>(() => ({
    type: 'line',
    height: 160,
    fontFamily: 'inherit',
    background: 'transparent',
    animations: {
      enabled: !prefiereMenosMovimiento(),
      speed: 250,
      animateGradually: { enabled: false },
    },
    toolbar: { show: false },
    zoom: { enabled: false },
    parentHeightOffset: 0,
  }));

  protected readonly stroke = computed<ApexStroke>(() => ({
    width: 2,
    curve: 'smooth',
    lineCap: 'round',
  }));

  /** Sin puntos dibujados; solo aparecen al pasar por encima. */
  protected readonly markers = computed<ApexMarkers>(() => ({
    size: 0,
    strokeWidth: 2,
    strokeColors: this.base().superficie,
    hover: { size: 5 },
  }));

  protected readonly grid = computed<ApexGrid>(() => ({
    borderColor: this.base().grilla,
    strokeDashArray: 0,
    // Solo líneas horizontales: las verticales por día son 30 rayas que
    // compiten con las dos líneas que sí son el dato.
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { top: 0, right: 4, bottom: 0, left: 4 },
  }));

  protected readonly xaxis = computed<ApexXAxis>(() => ({
    categories: this.puntos().map((p) => String(p.dia)),
    // Un rótulo cada cinco días: con uno por día no se lee ninguno en 360px.
    tickAmount: Math.min(5, Math.max(1, this.puntos().length - 1)),
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
    labels: {
      // Derechos siempre: inclinados, los números de día se leían de lado.
      rotate: 0,
      hideOverlappingLabels: true,
      style: { colors: this.base().textoTenue, fontSize: '11px' },
      formatter: (valor: string) => valor,
    },
  }));

  /**
   * Eje Y sin rótulos a propósito: los valores exactos se leen en la
   * leyenda y en el tooltip, y en una gráfica de 160px de alto una columna
   * de montos de siete cifras se come el ancho útil.
   */
  protected readonly yaxis = computed<ApexYAxis>(() => ({
    show: false,
    min: 0,
  }));

  protected readonly tooltip = computed<ApexTooltip>(() => {
    const oculto = this.oculto();
    return {
      shared: true,
      intersect: false,
      theme: this.tema.oscuro() ? 'dark' : 'light',
      x: { formatter: (valor: number) => `Día ${valor}` },
      y: { formatter: (valor: number) => (oculto ? '$ ••••••' : formatearCop(valor)) },
      marker: { show: true },
    };
  });
}
