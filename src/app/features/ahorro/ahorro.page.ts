import { Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import { formatearDiaMes } from '../../shared/format/fecha';
import {
  aporteFaltanteTotal,
  fechaIsoDesdeLocal,
  inicioDelCiclo,
  progresoDeMeta,
  type ProgresoMeta,
} from '../../core/domain';
import {
  type Cuenta,
  type MetaAhorro,
  type Movimiento,
  PREFERENCIAS_INICIALES,
} from '../../core/models';
import { HeaderActionService } from '../../layout/header-action.service';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { Amount } from '../../shared/amount/amount';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { PageHead } from '../../shared/page-head/page-head';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';
import { MetaForm } from './meta-form/meta-form';

/**
 * Tab Ahorro: lo que se quiere juntar y cómo va. Cada meta vive en un
 * bolsillo reservado de Cuentas, así que lo ahorrado sale de ahí y no se
 * anota dos veces; "Apartar" reutiliza el formulario de movimiento en modo
 * transferencia. Lo que falta apartar en el ciclo baja lo que General deja
 * gastar por día (ver `libreDespuesDeAhorrar`).
 */
@Component({
  selector: 'app-ahorro-page',
  imports: [
    MatIconModule,
    MatMenuModule,
    Amount,
    PageHead,
    PantallaVacia,
    SkeletonRows,
    AparicionEscalonada,
  ],
  templateUrl: './ahorro.page.html',
  styleUrl: './ahorro.page.scss',
})
export class AhorroPage {
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly headerAction = inject(HeaderActionService);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });
  protected readonly listo = primeraCarga(this.cuentasApi.listar(), this.movimientosApi.listar());

  constructor() {
    this.headerAction.establecer({
      icono: 'add',
      etiqueta: 'Nueva meta',
      accion: () => this.nuevaMeta(),
      ocultaNuevoMovimiento: true,
    });
    inject(DestroyRef).onDestroy(() => this.headerAction.limpiar());
  }

  private readonly inicioCiclo = computed(() =>
    inicioDelCiclo(new Date(), this.preferencias().diaDePago),
  );
  /** "20 oct": desde cuándo cuenta lo apartado, para que "este ciclo" no sea un misterio. */
  protected readonly desdeCuando = computed(() =>
    formatearDiaMes(fechaIsoDesdeLocal(this.inicioCiclo())),
  );

  protected readonly progresos = computed<ProgresoMeta[]>(() => {
    const inicio = this.inicioCiclo();
    return this.preferencias().metasAhorro.map((meta) =>
      progresoDeMeta(meta, this.cuentas(), this.movimientos(), inicio),
    );
  });

  protected readonly sinMetas = computed(() => this.preferencias().metasAhorro.length === 0);
  protected readonly totalAhorrado = computed(() =>
    this.progresos().reduce((acc, p) => acc + p.ahorrado, 0),
  );
  protected readonly totalFalta = computed(() =>
    this.progresos().reduce((acc, p) => acc + p.falta, 0),
  );
  /** Si alguna meta tiene cifra final; sin ninguna, "falta para tus metas" no aplica. */
  protected readonly hayObjetivos = computed(() => this.progresos().some((p) => !p.sinObjetivo));
  protected readonly apartadoEnCiclo = computed(() =>
    this.progresos().reduce((acc, p) => acc + (p.cumplida ? 0 : p.aportadoEnCiclo), 0),
  );
  protected readonly faltaApartar = computed(() => aporteFaltanteTotal(this.progresos()));

  protected readonly detalle = computed(() => {
    if (!this.listo()) return '';
    const n = this.progresos().length;
    if (n === 0) return 'Aún no tienes metas';
    const cumplidas = this.progresos().filter((p) => p.cumplida).length;
    const metas = n === 1 ? '1 meta' : `${n} metas`;
    return cumplidas > 0 ? `${metas} · ${cumplidas} cumplida${cumplidas === 1 ? '' : 's'}` : metas;
  });

  /** Una frase sobre cómo va la meta este ciclo. */
  protected textoDe(p: ProgresoMeta): string {
    if (p.sinBolsillo) return 'El bolsillo de esta meta ya no existe: elimínala y crea otra.';
    if (p.cumplida) return '¡Meta cumplida!';
    if (p.meta.aporteMensual === 0) return 'En pausa: no tiene aporte mensual.';
    if (p.sinObjetivo) return 'Sin cifra final: tu ahorro crece con cada aporte.';
    if (p.mesesParaLlegar === null) return '';
    const meses =
      p.mesesParaLlegar === 1 ? 'a 1 mes de lograrlo' : `a ${p.mesesParaLlegar} meses de lograrlo`;
    return `Al ritmo de tu aporte, estás ${meses}.`;
  }

  protected progresoDe(proporcion: number): number {
    return Math.min(proporcion, 1);
  }

  protected nuevaMeta(): void {
    this.dialog.open(MetaForm, { width: '480px', maxHeight: '90vh', data: {} });
  }

  protected editar(meta: MetaAhorro): void {
    this.dialog.open(MetaForm, { width: '480px', maxHeight: '90vh', data: { meta } });
  }

  /** Mover plata al bolsillo de la meta: es una transferencia con destino ya elegido. */
  protected apartar(p: ProgresoMeta): void {
    const bolsillo = this.cuentas().find((c) => c.id === p.meta.bolsilloId);
    this.nuevoMovimiento.abrir({
      tipo: 'transferencia',
      cuentaOrigenId: bolsillo?.cuentaPadreId ?? undefined,
      cuentaDestinoId: p.meta.bolsilloId,
      monto: p.aporteFaltante > 0 ? p.aporteFaltante : undefined,
      descripcion: `Ahorro · ${p.meta.nombre}`,
    });
  }

  protected quitar(meta: MetaAhorro): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: 'Quitar meta',
          mensaje: `${meta.nombre} deja de contar en tu ahorro. Su bolsillo y la plata que tiene se quedan en Cuentas.`,
          textoConfirmar: 'Quitar',
          peligro: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        const metasAhorro = this.preferencias().metasAhorro.filter((m) => m.id !== meta.id);
        this.preferenciasApi.actualizar({ metasAhorro }).subscribe(() => {
          this.snackBar.open('Meta quitada', undefined, { duration: 3000 });
        });
      });
  }
}
