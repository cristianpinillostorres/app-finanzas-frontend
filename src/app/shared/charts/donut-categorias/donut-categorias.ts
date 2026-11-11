import { Component, computed, inject, input } from '@angular/core';
import {
  ChartComponent,
  type ApexChart,
  type ApexPlotOptions,
  type ApexStroke,
  type ApexTooltip,
} from 'ng-apexcharts';

import type { CategoriaConGasto } from '../../../core/domain';
import { MontosVisibilityService } from '../../../core/montos-visibility.service';
import { ThemeService } from '../../../core/theme.service';
import { formatearCop } from '../../format/moneda';
import { prefiereMenosMovimiento } from '../../motion/preferencias-movimiento';
import { Amount } from '../../amount/amount';
import { MAX_CATEGORIAS_CON_COLOR, coloresDeSerie, leerColorToken } from '../paleta-graficas';

/** Una porción de la dona, ya con su color y su parte del total. */
interface Porcion {
  nombre: string;
  monto: number;
  color: string;
  /** Parte del total de gastos, 0-100. Distinto del `porcentaje` de
   * `CategoriaConGasto`, que es relativo a la categoría mayor. */
  participacion: number;
}

/**
 * Dona de gastos por categoría, con su leyenda.
 *
 * La leyenda no es opcional. Tres de los siete colores de serie quedan por
 * debajo de 3:1 contra la superficie clara, lo que es legal solo si el dato
 * se puede leer de otra forma — acá, el nombre y el monto en texto al lado
 * de cada muestra de color. Además evita que la identidad de cada porción
 * dependa solo del color, que es lo que rompe la gráfica para quien tiene
 * daltonismo. Ver `paleta-graficas.ts`.
 *
 * La cola se agrupa en "Otras" a partir de la séptima categoría: más de
 * siete tonos no se distinguen entre sí por más que se generen, así que la
 * respuesta correcta es agrupar, no inventar un color nuevo.
 */
@Component({
  selector: 'app-donut-categorias',
  standalone: true,
  imports: [ChartComponent, Amount],
  templateUrl: './donut-categorias.html',
  styleUrl: './donut-categorias.scss',
})
export class DonutCategorias {
  datos = input.required<readonly CategoriaConGasto[]>();

  private readonly tema = inject(ThemeService);
  private readonly montos = inject(MontosVisibilityService);
  protected readonly oculto = this.montos.oculto;

  protected readonly total = computed(() => this.datos().reduce((acc, d) => acc + d.monto, 0));

  /**
   * Las categorías con color propio más, si sobran, una porción "Otras" con
   * la suma del resto. Se recalcula con el tema porque la paleta tiene un
   * escalonado distinto para fondo claro y para fondo oscuro.
   */
  protected readonly porciones = computed<Porcion[]>(() => {
    const datos = this.datos();
    const total = this.total();
    if (total === 0) return [];

    const colores = coloresDeSerie(this.tema.oscuro());
    const conColor = datos.slice(0, MAX_CATEGORIAS_CON_COLOR);
    const resto = datos.slice(MAX_CATEGORIAS_CON_COLOR);

    const porciones: Porcion[] = conColor.map((dato, i) => ({
      nombre: dato.nombre || 'Sin nombre',
      monto: dato.monto,
      color: colores[i],
      participacion: (dato.monto / total) * 100,
    }));

    if (resto.length > 0) {
      const monto = resto.reduce((acc, d) => acc + d.monto, 0);
      porciones.push({
        nombre: `Otras (${resto.length})`,
        monto,
        color: colores[MAX_CATEGORIAS_CON_COLOR],
        participacion: (monto / total) * 100,
      });
    }
    return porciones;
  });

  protected readonly series = computed(() => this.porciones().map((p) => p.monto));
  protected readonly etiquetas = computed(() => this.porciones().map((p) => p.nombre));
  protected readonly colores = computed(() => this.porciones().map((p) => p.color));

  protected readonly chart = computed<ApexChart>(() => ({
    type: 'donut',
    height: 208,
    fontFamily: 'inherit',
    // El movimiento de entrada lo maneja la fase de animaciones; acá se deja
    // el de ApexCharts, corto y sin rebote, y se apaga si el sistema pide
    // menos movimiento.
    animations: {
      enabled: !prefiereMenosMovimiento(),
      speed: 250,
      animateGradually: { enabled: false },
    },
    toolbar: { show: false },
    sparkline: { enabled: false },
  }));

  protected readonly plotOptions = computed<ApexPlotOptions>(() => ({
    pie: {
      expandOnClick: false,
      donut: {
        size: '72%',
        // El total va como HTML encima de la dona, no como etiqueta de
        // ApexCharts: así usa la tipografía del sistema de diseño y
        // respeta el botón de ocultar montos.
        labels: { show: false },
      },
    },
  }));

  /**
   * Separación de 2px del color de la superficie entre porciones: sin ella,
   * dos categorías de tono parecido se leen como una sola porción grande.
   */
  protected readonly stroke = computed<ApexStroke>(() => {
    // Los tokens se vuelven a leer cuando cambia el tema o el modo.
    this.tema.huella();
    return { width: 2, colors: [leerColorToken('--bg-surface', '#ffffff')] };
  });

  protected readonly tooltip = computed<ApexTooltip>(() => {
    const oculto = this.oculto();
    return {
      enabled: true,
      // Con los montos ocultos el tooltip muestra solo el porcentaje: si
      // mostrara el valor, el botón del ojo no serviría de nada.
      y: {
        formatter: (valor: number, opciones?: { seriesIndex: number }) => {
          const participacion = this.porciones()[opciones?.seriesIndex ?? 0]?.participacion ?? 0;
          const porcentaje = `${participacion.toFixed(1)}%`;
          return oculto ? porcentaje : `${formatearCop(valor)} · ${porcentaje}`;
        },
      },
    };
  });

  protected porcentajeTexto(porcion: Porcion): string {
    return `${porcion.participacion.toFixed(porcion.participacion < 10 ? 1 : 0)}%`;
  }
}
