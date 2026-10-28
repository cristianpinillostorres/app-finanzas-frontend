import { Component, DestroyRef, type ElementRef, inject, signal, viewChild } from '@angular/core';

import type { EstadoSemaforo } from '../../../core/domain';
import { Amount } from '../../../shared/amount/amount';
import { prefiereMenosMovimiento } from '../../../shared/motion/preferencias-movimiento';

/** Datos fijos de los paneles de ejemplo de la presentación. */
const EJEMPLO_GENERAL = {
  libre: 1_240_000,
  pagos: [
    { nombre: 'Arriendo', dia: 5, monto: 900_000, estado: 'amarillo', texto: 'en 2 días' },
    { nombre: 'Internet', dia: 12, monto: 85_000, estado: 'verde', texto: 'en 9 días' },
    { nombre: 'Suscripción', dia: 20, monto: 45_000, estado: 'verde', texto: 'en 17 días' },
  ] satisfies {
    nombre: string;
    dia: number;
    monto: number;
    estado: EstadoSemaforo;
    texto: string;
  }[],
  deudaTotal: 8_400_000,
  /** Porcentaje ya pagado del total. */
  deudaPagada: 38,
  cuotasFaltan: 14,
  /** `porcentaje`: el ancho de la barra. */
  categorias: [
    { categoriaId: 'mercado', nombre: 'Mercado', monto: 420_000, porcentaje: 70 },
    { categoriaId: 'transporte', nombre: 'Transporte', monto: 270_000, porcentaje: 45 },
    { categoriaId: 'restaurantes', nombre: 'Restaurantes', monto: 180_000, porcentaje: 30 },
  ],
};

/**
 * Carrusel del paso 0 de la bienvenida: las cuatro preguntas que responde
 * la app, cada una con una tarjeta de ejemplo de lo que se ve en General.
 * Se desliza con el dedo (scroll-snap) o con los puntos, y avanza solo
 * cada 5 s hasta que la persona lo toca.
 */
@Component({
  selector: 'app-muestras-general',
  imports: [Amount],
  templateUrl: './muestras-general.html',
  styleUrl: './muestras-general.scss',
})
export class MuestrasGeneral {
  protected readonly preguntas = [
    {
      icono: 'savings',
      titulo: '¿Cuánto me queda libre este mes?',
      texto: 'Después de pagos fijos y cuotas.',
    },
    {
      icono: 'event',
      titulo: '¿Qué tengo que pagar y cuándo?',
      texto: 'Que no se pase ningún pago ni cuota.',
    },
    {
      icono: 'credit_card',
      titulo: '¿Cómo voy con mis deudas?',
      texto: 'Bancos, tarjetas, plataformas y personas.',
    },
    {
      icono: 'donut_large',
      titulo: '¿En qué se me va la plata?',
      texto: 'Gasto por categoría y tendencia del mes.',
    },
  ];

  /** Lo que muestran los paneles de ejemplo del paso 0: una persona cualquiera a mitad de mes. */
  protected readonly ejemplo = EJEMPLO_GENERAL;

  protected readonly muestra = signal(0);
  private readonly pista = viewChild<ElementRef<HTMLElement>>('pista');
  private autoavance: ReturnType<typeof setInterval> | undefined;

  constructor() {
    if (!prefiereMenosMovimiento()) {
      this.autoavance = setInterval(() => {
        const pista = this.pista()?.nativeElement;
        if (pista) this.irAMuestra(pista, (this.muestra() + 1) % this.preguntas.length);
      }, 5000);
    }
    inject(DestroyRef).onDestroy(() => this.detenerAutoavance());
  }

  protected detenerAutoavance(): void {
    clearInterval(this.autoavance);
    this.autoavance = undefined;
  }

  protected alDeslizar(pista: HTMLElement): void {
    this.muestra.set(Math.round(pista.scrollLeft / Math.max(pista.clientWidth, 1)));
  }

  protected irAMuestra(pista: HTMLElement, i: number): void {
    const destino = Math.min(Math.max(i, 0), this.preguntas.length - 1);
    pista.scrollTo({
      left: destino * pista.clientWidth,
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
    });
    this.muestra.set(destino);
  }
}
