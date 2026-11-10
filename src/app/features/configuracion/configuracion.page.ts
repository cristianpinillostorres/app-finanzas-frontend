import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import { AuthService } from '../../core/auth/auth.service';
import {
  LIMITES_AVISO,
  type PeriodoReporte,
  armarReporteMovimientos,
  fechaIsoDesdeLocal,
  proximoPago,
  rangoReporte,
} from '../../core/domain';
import {
  type Categoria,
  type CambiosPreferencias,
  type Credito,
  type Cuenta,
  type Movimiento,
  type Objetivo,
  PREFERENCIAS_INICIALES,
} from '../../core/models';
import { OPCIONES_OBJETIVO } from '../../shared/bienvenida/pasos-bienvenida';
import { formatearDiaMes, formatearMesAnioCapitalizado } from '../../shared/format/fecha';
import { PageHead } from '../../shared/page-head/page-head';

/** Día con el que arranca el contador al encender "Día de pago fijo". */
const DIA_INICIAL = 15;
/** Espera tras el último toque de − o + antes de guardar, para no guardar cada paso. */
const ESPERA_GUARDAR_MS = 600;

/**
 * Configuración: lo que se decide sobre la app misma, no los datos de cada
 * crédito o cuenta (esos se editan en su pantalla). Cada cambio se guarda al
 * instante en la cuenta (ver `Preferencias`), sin botón de guardar.
 */
@Component({
  selector: 'app-configuracion-page',
  imports: [MatIconModule, NgTemplateOutlet, PageHead],
  templateUrl: './configuracion.page.html',
  styleUrl: './configuracion.page.scss',
})
export class ConfiguracionPage {
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);

  protected readonly correo = this.auth.email;
  protected readonly tieneGoogle = this.auth.tieneGoogle;
  protected readonly vinculando = this.auth.vinculando;
  protected readonly opcionesObjetivo = OPCIONES_OBJETIVO;

  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });
  /**
   * Lo que se ve en los contadores: sigue lo guardado, pero cambia al
   * instante con cada toque de − o +, antes de que el guardado (que espera)
   * termine.
   */
  protected readonly diaDePago = linkedSignal(() => this.preferencias().diaDePago);
  protected readonly avisos = linkedSignal(() => this.preferencias().avisos);
  protected readonly nombre = computed(() => this.preferencias().nombre);
  protected readonly objetivos = computed(() => this.preferencias().objetivos);

  // ── Mis datos ───────────────────────────────────────────────────────
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });

  protected readonly periodos: { valor: PeriodoReporte; nombre: string }[] = [
    { valor: 'este-mes', nombre: 'Este mes' },
    { valor: 'mes-anterior', nombre: 'Mes anterior' },
    { valor: 'todo', nombre: 'Todo' },
  ];
  protected readonly periodo = signal<PeriodoReporte>('este-mes');
  protected readonly descargando = signal(false);

  private temporizadorDia: ReturnType<typeof setTimeout> | undefined;
  private temporizadorAvisos: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.guardarDiaPendiente();
      this.guardarAvisosPendientes();
    });
  }

  /** "20 de noviembre": el próximo pago según el día elegido. */
  protected readonly textoProximoPago = computed(() => {
    const dia = this.diaDePago();
    return dia === null ? '' : formatearDiaMes(fechaIsoDesdeLocal(proximoPago(new Date(), dia)));
  });

  // ── Tu mes ──────────────────────────────────────────────────────────

  /** El interruptor: con día fijo arranca en `DIA_INICIAL`; sin él, vuelve a mes calendario. */
  protected alternarDiaFijo(activo: boolean): void {
    clearTimeout(this.temporizadorDia);
    this.temporizadorDia = undefined;
    const dia = activo ? DIA_INICIAL : null;
    this.diaDePago.set(dia);
    this.guardar({ diaDePago: dia });
  }

  /** − y +: del 1 al 31, y del 31 se vuelve al 1 (y al revés). */
  protected readonly moverDia = (paso: 1 | -1): void => {
    const actual = this.diaDePago();
    if (actual === null) return;
    this.diaDePago.set(((actual - 1 + paso + 31) % 31) + 1);
    clearTimeout(this.temporizadorDia);
    this.temporizadorDia = setTimeout(() => this.guardarDiaPendiente(), ESPERA_GUARDAR_MS);
  };

  // ── Avisos de pagos ─────────────────────────────────────────────────

  /** Amarillo: de 1 a 14 días. Si queda a la par del rojo o por debajo, el rojo baja con él. */
  protected readonly moverAmarillo = (paso: 1 | -1): void => {
    const { amarillo, rojo } = this.avisos();
    const nuevo = Math.min(
      LIMITES_AVISO.amarilloMax,
      Math.max(LIMITES_AVISO.amarilloMin, amarillo + paso),
    );
    this.cambiarAvisos({ amarillo: nuevo, rojo: Math.min(rojo, nuevo - 1) });
  };

  /** Rojo: de 0 hasta un día menos que el amarillo. */
  protected readonly moverRojo = (paso: 1 | -1): void => {
    const { amarillo, rojo } = this.avisos();
    const nuevo = Math.min(amarillo - 1, Math.max(LIMITES_AVISO.rojoMin, rojo + paso));
    this.cambiarAvisos({ amarillo, rojo: nuevo });
  };

  /** Cómo se lee cada aviso: "Amarillo desde 4 días antes". */
  protected textoAviso(dias: number): string {
    if (dias === 0) return 'el día en que vence';
    return dias === 1 ? '1 día antes' : `${dias} días antes`;
  }

  private cambiarAvisos(avisos: { amarillo: number; rojo: number }): void {
    this.avisos.set(avisos);
    clearTimeout(this.temporizadorAvisos);
    this.temporizadorAvisos = setTimeout(() => this.guardarAvisosPendientes(), ESPERA_GUARDAR_MS);
  }

  // ── Mi cuenta ───────────────────────────────────────────────────────

  protected cambiarNombre(texto: string): void {
    const nombre = texto.trim() || null;
    if (nombre === this.nombre()) return;
    this.guardar({ nombre });
  }

  protected estaElegido(objetivo: Objetivo): boolean {
    return this.objetivos().includes(objetivo);
  }

  /** Marca o desmarca un objetivo; la lista guardada siempre sigue el orden de la bienvenida. */
  protected alternarObjetivo(objetivo: Objetivo): void {
    const elegidos = new Set(this.objetivos());
    if (elegidos.has(objetivo)) elegidos.delete(objetivo);
    else elegidos.add(objetivo);
    const objetivos = OPCIONES_OBJETIVO.map((o) => o.valor).filter((v) => elegidos.has(v));
    this.guardar({ objetivos });
  }

  protected vincularGoogle(): void {
    void this.auth.vincularGoogle();
  }

  protected cerrarSesion(): void {
    void this.auth.cerrarSesion();
  }

  // ── Mis datos ───────────────────────────────────────────────────────

  /** Arma el PDF de movimientos del periodo elegido y lo descarga. */
  protected async descargarMovimientosPdf(): Promise<void> {
    if (this.descargando()) return;
    const hoy = new Date();
    const rango = rangoReporte(this.periodo(), hoy);
    const reporte = armarReporteMovimientos(
      this.movimientos(),
      { cuentas: this.cuentas(), creditos: this.creditos(), categorias: this.categorias() },
      rango,
    );
    if (reporte.filas.length === 0) {
      this.snackBar.open('No hay movimientos en ese periodo.', undefined, { duration: 3000 });
      return;
    }

    this.descargando.set(true);
    try {
      // Se carga solo ahora: la librería de PDF no pesa mientras no se descargue nada.
      const { descargarPdfMovimientos } = await import('../../shared/pdf/pdf-movimientos');
      await descargarPdfMovimientos(reporte, this.tituloReporte(hoy));
      this.snackBar.open('PDF descargado', undefined, { duration: 2500 });
    } catch (error) {
      console.error('No se pudo armar el PDF de movimientos', error);
      this.snackBar.open('No se pudo armar el PDF. Intenta de nuevo.', undefined, {
        duration: 4000,
      });
    } finally {
      this.descargando.set(false);
    }
  }

  /** "Movimientos de Noviembre de 2026", o "Todos los movimientos". */
  private tituloReporte(hoy: Date): string {
    switch (this.periodo()) {
      case 'este-mes':
        return `Movimientos de ${formatearMesAnioCapitalizado(hoy)}`;
      case 'mes-anterior':
        return `Movimientos de ${formatearMesAnioCapitalizado(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))}`;
      case 'todo':
        return 'Todos los movimientos';
    }
  }

  // ── Guardado ────────────────────────────────────────────────────────

  /** Guarda el día que quedó en pantalla si todavía no se guardó (también al salir de la página). */
  private guardarDiaPendiente(): void {
    if (this.temporizadorDia === undefined) return;
    clearTimeout(this.temporizadorDia);
    this.temporizadorDia = undefined;
    const dia = this.diaDePago();
    if (dia !== this.preferencias().diaDePago) this.guardar({ diaDePago: dia });
  }

  private guardarAvisosPendientes(): void {
    if (this.temporizadorAvisos === undefined) return;
    clearTimeout(this.temporizadorAvisos);
    this.temporizadorAvisos = undefined;
    const avisos = this.avisos();
    const guardados = this.preferencias().avisos;
    if (avisos.amarillo !== guardados.amarillo || avisos.rojo !== guardados.rojo) {
      this.guardar({ avisos });
    }
  }

  private guardar(cambios: CambiosPreferencias): void {
    this.preferenciasApi.actualizar(cambios).subscribe({
      next: () => this.snackBar.open('Guardado', undefined, { duration: 2000 }),
      error: () =>
        this.snackBar.open('No se pudo guardar. Intenta de nuevo.', undefined, { duration: 4000 }),
    });
  }
}
