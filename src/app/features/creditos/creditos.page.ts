import { AparicionEscalonada } from '../../shared/motion/aparicion-escalonada';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { cambiosTasaDeBancos } from '../../core/api/creditos/cambios-tasa.util';
import { COMPRAS_API } from '../../core/api/compras/compras-api';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import {
  agruparCreditosPorTipo,
  creditosConCuotasPendientes,
  cuotasFaltantesCompra,
  cuotasPagadasBanco,
  diasEntre,
  inicioDelDia,
  tablaAmortizacion,
  tasaEaVigente,
  tasaMensual,
  type CreditoConEstado,
  type CreditoConProgreso,
} from '../../core/domain';
import type {
  CambioTasa,
  CompraCuotas,
  Credito,
  CreditoBanco,
  ExtractoTarjeta,
  Movimiento,
} from '../../core/models';
import { HeaderActionService } from '../../layout/header-action.service';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { Amount } from '../../shared/amount/amount';
import { ConfirmDialog } from '../../shared/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { PantallaVacia } from '../../shared/pantalla-vacia/pantalla-vacia';
import { PageHead } from '../../shared/page-head/page-head';
import { formatearDiaMes, formatearMesAnio } from '../../shared/format/fecha';
import { formatearPorcentaje } from '../../shared/format/porcentaje';
import { textoVencimiento } from '../../shared/format/texto-vencimiento';
import { CambioTasaForm } from './cambio-tasa-form/cambio-tasa-form';
import { CreditoForm } from './credito-form/credito-form';
import { primeraCarga } from '../../shared/carga/primera-carga';
import { SkeletonRows } from '../../shared/skeleton-rows/skeleton-rows';

const FECHA_HERO = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

/**
 * Tab Créditos: deuda total y por pagar este mes arriba, créditos
 * agrupados por tipo (Tarjetas, Bancos, Plataformas, Personas) con su
 * semáforo de fecha límite (ver `notas-app-finanzas.md`, "Tab Créditos").
 * "Agregar compra" y "Registrar abono" reutilizan el formulario de
 * movimiento (gasto y transferencia respectivamente); crear/editar/archivar
 * el crédito en sí usa su propio `CreditoForm`, igual patrón que `CuentaForm`
 * en Cuentas.
 */
@Component({
  selector: 'app-creditos-page',
  imports: [
    PantallaVacia,
    MatIconModule,
    Amount,
    EmptyState,
    PageHead,
    SkeletonRows,
    AparicionEscalonada,
  ],
  templateUrl: './creditos.page.html',
  styleUrl: './creditos.page.scss',
})
export class CreditosPage {
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);
  private readonly dialog = inject(MatDialog);
  private readonly headerAction = inject(HeaderActionService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  private readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  /** Si ya llegó lo que pinta la pantalla; mientras tanto, esqueletos (ver `primeraCarga`). */
  protected readonly listo = primeraCarga(
    this.creditosApi.listar(),
    this.comprasApi.listar(),
    this.movimientosApi.listar(),
  );

  /** Sin ningún crédito: la pantalla muestra solo su presentación (ver `PantallaVacia`). */
  protected readonly sinDatos = computed(() => this.creditos().length === 0);

  // Los extractos son por crédito (`CreditosApi.listarExtractos(id)`, como
  // un endpoint anidado): se piden para cada tarjeta y se combinan en una
  // sola lista plana, re-consultando si cambia el set de tarjetas.
  private readonly tarjetas = computed(() => this.creditos().filter((c) => c.grupo === 'TARJETA'));
  private readonly extractos = toSignal(
    toObservable(this.tarjetas).pipe(
      switchMap((tarjetas) =>
        tarjetas.length === 0
          ? of([] as ExtractoTarjeta[])
          : combineLatest(tarjetas.map((t) => this.creditosApi.listarExtractos(t.id))).pipe(
              map((porTarjeta) => porTarjeta.flat()),
            ),
      ),
    ),
    { initialValue: [] as ExtractoTarjeta[] },
  );

  // `refrescoCambiosTasa` fuerza a volver a pedir el historial cuando el
  // diálogo de "Cambiar tasa" cierra con éxito (ver `cambiarTasa`): la API
  // no es un stream en vivo, así que un cambio recién guardado no se
  // reflejaría solo. Esta es la única pantalla que los edita.
  private readonly refrescoCambiosTasa = signal(0);
  private readonly cambiosTasa = cambiosTasaDeBancos(this.creditos, this.refrescoCambiosTasa);

  constructor() {
    // La misma acción que en escritorio ofrece `app-page-head`, que en
    // móvil no se dibuja: acá vive en el header, junto al botón de ocultar
    // montos (ver `Shell`).
    this.headerAction.establecer({
      icono: 'add',
      etiqueta: 'Agregar crédito',
      accion: () => this.agregarCredito(),
    });
    inject(DestroyRef).onDestroy(() => this.headerAction.limpiar());
  }

  protected readonly grupos = computed(() =>
    agruparCreditosPorTipo(this.creditos(), {
      compras: this.compras(),
      movimientos: this.movimientos(),
      extractos: this.extractos(),
      cambiosTasa: this.cambiosTasa(),
    }),
  );

  protected readonly todosLosCreditos = computed(() => this.grupos().flatMap((g) => g.creditos));
  protected readonly detalleCreditos = computed(() => {
    // Mientras carga, sin conteo: un "0" se leería como dato real.
    if (!this.listo()) return '';
    const total = this.todosLosCreditos().length;
    return `${total} ${total === 1 ? 'crédito activo' : 'créditos activos'}`;
  });
  protected readonly deudaTotal = computed(() =>
    this.todosLosCreditos().reduce((acc, c) => acc + c.deuda, 0),
  );
  /**
   * Tercer dato del encabezado: "cuánto debo", "cuánto sale este mes" y
   * "cuándo es lo próximo" son las tres preguntas que se hacen juntas. Si
   * hay cuotas vencidas, eso es lo próximo: antes el encabezado decía
   * "Próxima cuota 15 de octubre" en tono neutro con tres créditos
   * vencidos, y tranquilizaba justo cuando no debía.
   */
  protected readonly cuotaMasCercana = computed(() => {
    const hoy = inicioDelDia(new Date());
    // Un crédito sin cuota (tarjeta en $0) no tiene nada próximo que pagar.
    const conCuota = this.todosLosCreditos().filter((c) => c.cuota > 0);
    const pendientes = conCuota
      .map((c) => c.estadoPago)
      .filter((e): e is NonNullable<typeof e> => e !== null && !e.pagadoEsteMes);
    const vencidas = pendientes.filter((e) => e.fechaLimite.getTime() < hoy.getTime()).length;
    const fechas = conCuota
      .map((c) => c.estadoPago?.fechaLimite)
      .filter((f): f is Date => f !== undefined && f !== null)
      .filter((f) => f.getTime() >= hoy.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    if (vencidas === 0 && fechas.length === 0) return null;
    return { vencidas, fecha: fechas[0] ?? null };
  });

  /**
   * Solo las cuotas del mes que todavía no se pagan. Antes sumaba la cuota
   * de todos los créditos, incluidas las ya pagadas — cuyo `cuota` ya es la
   * del mes siguiente —, así que no coincidía con lo que falta en Pagos
   * fijos ni bajaba al registrar un pago.
   */
  protected readonly porPagarEsteMes = computed(() =>
    this.todosLosCreditos()
      .filter((c) => c.estadoPago !== null && !c.estadoPago.pagadoEsteMes)
      .reduce((acc, c) => acc + c.cuota, 0),
  );

  /** Ya pasó la fecha límite sin pagarse (el pie dice "Venció el…"). */
  protected vencida(item: CreditoConEstado): boolean {
    if (!item.estadoPago || item.estadoPago.pagadoEsteMes) return false;
    return item.estadoPago.fechaLimite.getTime() < inicioDelDia(new Date()).getTime();
  }

  /**
   * "Registrar pago" en relleno solo cuando urge (vencida o vence en menos
   * de 5 días, el amarillo/rojo del semáforo); el resto en contorno. Con
   * cinco botones primarios iguales nada decía por dónde empezar.
   */
  protected urgente(item: CreditoConEstado): boolean {
    if (!item.estadoPago || item.estadoPago.pagadoEsteMes) return false;
    return diasEntre(new Date(), item.estadoPago.fechaLimite) < 5;
  }

  /** La que está abierta: una a la vez, abrir otra cierra la anterior. */
  private readonly abierta = signal<string | null>(null);

  protected expandido(creditoId: string): boolean {
    return this.abierta() === creditoId;
  }

  protected alternarExpandido(creditoId: string): void {
    this.abierta.update((actual) => (actual === creditoId ? null : creditoId));
  }

  protected comprasDe(creditoId: string): CompraCuotas[] {
    return this.compras()
      .filter((c) => c.creditoId === creditoId)
      .filter((c) => cuotasFaltantesCompra(c) > 0);
  }

  protected cuotaActualCompra(compra: CompraCuotas): number {
    return compra.numCuotas - cuotasFaltantesCompra(compra) + 1;
  }

  /** "15 nov." para el héroe: con el mes entero, la cifra partía en dos renglones. */
  protected fechaHeroDe(fecha: Date): string {
    return FECHA_HERO.format(fecha).replace(' de ', ' ');
  }

  protected textoFecha(fechaLimite: Date): string {
    return textoVencimiento(fechaLimite, false);
  }

  protected claseBadge(item: CreditoConEstado): string {
    if (!item.estadoPago) return '';
    const dias = diasEntre(new Date(), item.estadoPago.fechaLimite);
    if (dias >= 5) return 'sem-verde';
    if (dias >= 2) return 'sem-amarillo';
    return 'sem-rojo';
  }

  protected cupoDisponible(credito: Credito, deuda: number): number {
    return credito.grupo === 'TARJETA' ? credito.cupo - deuda : 0;
  }

  protected valorExtracto(creditoId: string): number | null {
    const hoy = new Date();
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    return (
      this.extractos().find((e) => e.creditoId === creditoId && e.periodo === periodo)
        ?.valorAPagar ?? null
    );
  }

  protected cambiosTasaDe(creditoId: string): CambioTasa[] {
    return this.cambiosTasa()
      .filter((c) => c.creditoId === creditoId)
      .sort((a, b) => b.fechaDesde.localeCompare(a.fechaDesde));
  }

  protected tasaEaVigenteDe(credito: CreditoBanco): number {
    return tasaEaVigente(credito, this.cambiosTasa());
  }

  protected tasaEaTexto(tasaEa: number): string {
    return formatearPorcentaje(tasaEa);
  }

  protected tasaMensualTexto(tasaEa: number): string {
    return formatearPorcentaje(tasaMensual(tasaEa));
  }

  protected cambiarTasa(credito: CreditoBanco): void {
    this.dialog
      .open(CambioTasaForm, { width: '420px', maxHeight: '90vh', data: { credito } })
      .afterClosed()
      .subscribe((guardado) => {
        if (guardado) this.refrescoCambiosTasa.update((n) => n + 1);
      });
  }

  protected terminaTexto(credito: Credito, cuotasFaltantes: number | null): string {
    if (credito.grupo !== 'BANCO' || cuotasFaltantes === null) return '';
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + cuotasFaltantes);
    return formatearMesAnio(fecha);
  }

  protected proximaCuota(credito: Credito): { capital: number; interes: number } | null {
    if (credito.grupo !== 'BANCO') return null;
    const pagadas = cuotasPagadasBanco(credito, this.movimientos());
    if (pagadas >= credito.plazoMeses) return null;
    const tasaEa = this.tasaEaVigenteDe(credito);
    const tabla = tablaAmortizacion(
      credito.monto,
      tasaMensual(tasaEa),
      credito.plazoMeses,
      credito.seguroMensual,
    );
    const fila = tabla[pagadas];
    return { capital: fila.capital, interes: fila.interes };
  }

  /**
   * Progreso de cuotas por crédito, indexado por id.
   *
   * Reutiliza `creditosConCuotasPendientes` (la misma función que alimenta
   * "Cuotas que faltan" en General) para que tarjetas y plataformas tengan
   * su barra, no solo los bancos. Para un banco es el plazo del crédito;
   * para una tarjeta o plataforma, la compra con más cuotas por delante.
   *
   * La barra de los bancos sigue saliendo de `progresoPagoBanco`, que
   * cuenta las cuotas efectivamente pagadas en vez de las transcurridas:
   * son dos números distintos y no se cambia cuál ve el usuario.
   */
  private readonly progresoPorCredito = computed(() => {
    const mapa = new Map<string, CreditoConProgreso>();
    for (const item of creditosConCuotasPendientes(
      this.creditos(),
      this.compras(),
      this.movimientos(),
    )) {
      mapa.set(item.credito.id, item);
    }
    return mapa;
  });

  protected progresoCuotas(creditoId: string): CreditoConProgreso | undefined {
    return this.progresoPorCredito().get(creditoId);
  }

  protected progresoPagoBanco(credito: Credito): number {
    if (credito.grupo !== 'BANCO') return 0;
    const pagadas = cuotasPagadasBanco(credito, this.movimientos());
    return Math.round((pagadas / credito.plazoMeses) * 100);
  }

  protected abonosPersona(creditoId: string): Movimiento[] {
    return this.movimientos()
      .filter((m) => m.creditoDestinoId === creditoId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  protected fechaTexto(fechaIso: string): string {
    return formatearDiaMes(fechaIso);
  }

  protected agregarCompra(credito: Credito): void {
    this.nuevoMovimiento.abrir({ tipo: 'gasto', creditoId: credito.id });
  }

  protected registrarAbono(credito: Credito): void {
    this.nuevoMovimiento.abrir({ tipo: 'transferencia', cuentaDestinoId: credito.id });
  }

  /**
   * Registrar la cuota del mes desde la propia tarjeta del crédito. Es el
   * mismo movimiento que hace "Pagar" en Pagos fijos (una transferencia
   * hacia el crédito, con la cuota precargada); acá solo se acerca la
   * acción al sitio donde se está mirando la deuda.
   */
  protected registrarPago(item: CreditoConEstado): void {
    this.nuevoMovimiento.abrir({
      tipo: 'transferencia',
      cuentaDestinoId: item.credito.id,
      monto: item.cuota > 0 ? item.cuota : undefined,
      nombrePagoFijo: item.credito.nombre,
    });
  }

  protected agregarCredito(): void {
    this.dialog.open(CreditoForm, { width: '480px', maxHeight: '90vh', data: {} });
  }

  protected editar(credito: Credito): void {
    this.dialog.open(CreditoForm, { width: '480px', maxHeight: '90vh', data: { credito } });
  }

  protected archivar(credito: Credito): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxHeight: '90vh',
        data: {
          titulo: 'Archivar crédito',
          mensaje: `${credito.nombre} deja de verse en Créditos, pero su historial se conserva.`,
          textoConfirmar: 'Archivar',
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.creditosApi.archivar(credito.id).subscribe(() => {
          this.snackBar.open('Crédito archivado', undefined, { duration: 3000 });
        });
      });
  }
}
