import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, map, startWith } from 'rxjs';

import { CATEGORIAS_API, categoriasParaElegir } from '../core/api/categorias/categorias-api';
import { COMPRAS_API } from '../core/api/compras/compras-api';
import { CREDITOS_API } from '../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../core/api/movimientos/movimientos-api';
import { PREFERENCIAS_API } from '../core/api/preferencias/preferencias-api';
import {
  deudaCredito,
  descripcionAutomaticaTransferencia,
  esInterno,
  fechaIsoDesdeLocal,
  gruposPagarCon,
  gruposTransferenciaHacia,
  opcionesCuentasYBolsillos,
  saldoCuenta,
  type GrupoOpcionesMovimiento,
  type OpcionMovimiento,
} from '../core/domain';
import {
  type CompraCuotas,
  type Credito,
  type Cuenta,
  type Movimiento,
  PREFERENCIAS_INICIALES,
} from '../core/models';
import { MontoInput } from '../shared/forms/monto-input';
import { mostrarErrorGuardado } from '../shared/guardado/guardado.util';
import { MonedaCopPipe } from '../shared/pipes/moneda-cop.pipe';
import { formatearCop } from '../shared/format/moneda';
import type { MovimientoFormData, TipoFormularioMovimiento } from './movimiento-form-data';
import { HojaCabecera } from '../shared/hoja-cabecera/hoja-cabecera';

/**
 * Formulario de movimiento: gasto, ingreso o transferencia. Un solo
 * componente reutilizado desde el botón "+" (fase 2), el atajo "Agregar
 * compra" de un crédito (fase 5) y "Pagar" de un pago fijo (fase 6) — ver
 * `NuevoMovimientoService`, que lo abre en `MatDialog` o `MatBottomSheet`
 * según el tamaño de pantalla.
 */
@Component({
  selector: 'app-movimiento-form',
  imports: [HojaCabecera, 
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MonedaCopPipe,
    MontoInput,
  ],
  templateUrl: './movimiento-form.html',
  styleUrl: './movimiento-form.scss',
})
export class MovimientoForm {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly comprasApi = inject(COMPRAS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  /**
   * Última cuenta usada para pagar un gasto y para recibir un ingreso:
   * casi siempre es la misma, y elegirla cada vez alargaba "registrar en
   * segundos". Se guarda en la cuenta, así sirve en cualquier dispositivo.
   */
  private readonly ultimaCuenta = toSignal(
    this.preferenciasApi.obtener().pipe(map((p) => p.ultimaCuenta)),
    { initialValue: PREFERENCIAS_INICIALES.ultimaCuenta },
  );
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly bottomSheetRef = inject(MatBottomSheetRef, { optional: true });
  private readonly datosIniciales: MovimientoFormData =
    inject<MovimientoFormData | null>(MAT_DIALOG_DATA, { optional: true }) ??
    inject<MovimientoFormData | null>(MAT_BOTTOM_SHEET_DATA, { optional: true }) ??
    {};

  protected readonly opcionesCuotas: number[] = Array.from({ length: 48 }, (_, i) => i + 1);
  protected readonly guardando = signal(false);

  private readonly movimientoEditando = this.datosIniciales.movimiento;
  private readonly compraEditandoId = signal<string | null>(null);
  protected readonly modoEdicion = this.movimientoEditando !== undefined;

  // Pago fijo/periodo que este movimiento marca como pagado: no son campos
  // del formulario (el usuario no los edita), vienen del atajo "Pagar" de
  // Pagos fijos, o se conservan si se está editando un movimiento que ya los tenía.
  private readonly pagoFijoId =
    this.datosIniciales.pagoFijoId ?? this.movimientoEditando?.pagoFijoId;
  private readonly periodo = this.datosIniciales.periodo ?? this.movimientoEditando?.periodo;

  // Nombre del pago fijo que se está saldando, solo para el aviso al
  // guardar. Sin respaldo desde `movimientoEditando`: editar un movimiento
  // viejo no es "marcar como pagado" y no debe anunciarse como tal.
  private readonly nombrePagoFijo = this.datosIniciales.nombrePagoFijo;

  // — datos —
  protected readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  protected readonly creditos = toSignal(this.creditosApi.listar(), {
    initialValue: [] as Credito[],
  });
  protected readonly compras = toSignal(this.comprasApi.listar(), {
    initialValue: [] as CompraCuotas[],
  });
  protected readonly categorias = toSignal(this.categoriasApi.listar(), { initialValue: [] });
  protected readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });

  protected readonly categoriasGasto = computed(() =>
    categoriasParaElegir(this.categorias(), 'GASTO', this.valorFormulario().categoriaId),
  );
  protected readonly categoriasIngreso = computed(() =>
    categoriasParaElegir(this.categorias(), 'INGRESO', this.valorFormulario().categoriaId),
  );
  protected readonly opcionesCuentas = computed(() => opcionesCuentasYBolsillos(this.cuentas()));
  protected readonly gruposPagarCon = computed(() =>
    gruposPagarCon(this.cuentas(), this.creditos()),
  );
  protected readonly gruposHacia = computed(() =>
    gruposTransferenciaHacia(this.cuentas(), this.creditos()),
  );

  // — formulario —
  protected readonly form = this.fb.group({
    tipo: this.fb.nonNullable.control<TipoFormularioMovimiento>('gasto'),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    fecha: this.fb.nonNullable.control(this.fechaHoyIso(), Validators.required),
    descripcion: this.fb.nonNullable.control(''),
    categoriaId: this.fb.control<string | null>(null),
    pagarConId: this.fb.control<string | null>(null),
    cuotas: this.fb.nonNullable.control(1),
    valorCuota: this.fb.control<number | null>(null),
    destinoId: this.fb.control<string | null>(null),
    desdeId: this.fb.control<string | null>(null),
    haciaId: this.fb.control<string | null>(null),
  });

  private readonly valorFormulario = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );
  private readonly estadoFormulario = toSignal(
    this.form.statusChanges.pipe(startWith(this.form.status)),
    { initialValue: this.form.status },
  );

  protected readonly tipo = computed(() => this.valorFormulario().tipo);

  /**
   * Los errores salen solo después de tocar "Registrar": antes, con solo
   * pasar por un campo, la hoja se llenaba de rojo sin que la persona
   * hubiera hecho nada mal.
   */
  private readonly intento = signal(false);

  // Valores elegidos en las filas de la lista: el menú de cada una marca el suyo.
  protected readonly valorCategoria = computed(() => this.valorFormulario().categoriaId);
  protected readonly valorPagarCon = computed(() => this.valorFormulario().pagarConId);
  protected readonly valorDestino = computed(() => this.valorFormulario().destinoId);
  protected readonly valorDesde = computed(() => this.valorFormulario().desdeId);
  protected readonly valorHacia = computed(() => this.valorFormulario().haciaId);
  protected readonly valorCuotas = computed(() => this.valorFormulario().cuotas);

  protected readonly etiquetaCategoria = computed(
    () => this.categorias().find((c) => c.id === this.valorCategoria())?.nombre,
  );

  /** Cifras del monto con sus puntos ("150.000" son 7): el ancho del campo sale de ahí. */
  protected readonly cifrasMonto = computed(() => {
    const monto = this.valorFormulario().monto;
    return monto ? formatearCop(monto).replace(/[^\d.]/g, '').length : 1;
  });

  /** El aviso de la lista agrupada: el primer dato que falta, en una sola línea. */
  protected readonly errorGrupo = computed(() => {
    if (!this.intento()) return null;
    this.estadoFormulario();
    const c = this.form.controls;
    const tipo = this.tipo();
    if (tipo !== 'transferencia' && c.categoriaId.invalid) {
      return tipo === 'gasto' ? 'Elige en qué gastaste.' : 'Elige de dónde viene.';
    }
    if (tipo === 'gasto' && c.pagarConId.invalid) return 'Elige con qué pagas.';
    if (tipo === 'ingreso' && c.destinoId.invalid) return 'Elige dónde entra la plata.';
    if (tipo === 'transferencia' && (c.desdeId.invalid || c.haciaId.invalid)) {
      return 'Elige de dónde sale y a dónde va.';
    }
    return null;
  });

  protected readonly opcionPagarCon = computed(() =>
    this.buscarOpcion(this.valorFormulario().pagarConId, this.gruposPagarCon()),
  );
  protected readonly creditoSeleccionado = computed(() => {
    const opcion = this.opcionPagarCon();
    if (!opcion || opcion.tipo !== 'credito') return undefined;
    return this.creditos().find((c) => c.id === opcion.id);
  });
  protected readonly esPlataforma = computed(
    () => this.creditoSeleccionado()?.grupo === 'PLATAFORMA',
  );

  protected readonly cupoDisponible = computed(() => {
    const credito = this.creditoSeleccionado();
    if (!credito || credito.grupo !== 'TARJETA') return undefined;
    const comprasCredito = this.compras().filter(
      (c) => c.creditoId === credito.id && c.id !== this.compraEditandoId(),
    );
    return credito.cupo - deudaCredito(credito, { compras: comprasCredito, hoy: new Date() });
  });

  protected readonly cuotaAproximada = computed(() => {
    const { monto, cuotas } = this.valorFormulario();
    if (!monto || !cuotas) return null;
    return Math.round(monto / cuotas);
  });

  protected readonly opcionHacia = computed(() =>
    this.buscarOpcion(this.valorFormulario().haciaId, this.gruposHacia()),
  );
  protected readonly esTransferenciaInterna = computed(() => {
    const { desdeId, haciaId } = this.valorFormulario();
    const desde = this.cuentas().find((c) => c.id === desdeId);
    const hacia = this.cuentas().find((c) => c.id === haciaId);
    return !!desde && !!hacia && esInterno(desde, hacia);
  });

  protected readonly textoAyuda = computed(() => {
    const tipo = this.tipo();
    if (tipo === 'gasto') {
      const opcion = this.opcionPagarCon();
      if (opcion?.tipo === 'credito') {
        const palabra = this.esPlataforma() ? 'la plataforma' : 'la tarjeta';
        return `Compra a cuotas: cuenta como gasto del mes y suma a la deuda de ${palabra}.`;
      }
      return 'Sale de tu cuenta y cuenta como gasto del mes.';
    }
    if (tipo === 'ingreso') {
      return 'Entra a la cuenta o al bolsillo que elijas.';
    }
    const haciaOpcion = this.opcionHacia();
    if (haciaOpcion?.tipo === 'credito') {
      return 'Pago de una deuda: la baja, y no cuenta como gasto del mes.';
    }
    if (this.esTransferenciaInterna()) {
      return 'Mueves plata entre tu cuenta y uno de sus bolsillos: no es ingreso ni gasto.';
    }
    return 'Mueves plata entre tus cuentas: no cuenta como gasto. Para pagar una tarjeta o un crédito, elígelo en "Hacia".';
  });

  protected readonly errorMontoCupo = computed(() => {
    if (this.tipo() !== 'gasto' || this.creditoSeleccionado()?.grupo !== 'TARJETA') return null;
    const cupo = this.cupoDisponible();
    const monto = this.valorFormulario().monto;
    if (cupo === undefined || !monto) return null;
    return monto > cupo ? `El monto supera el cupo disponible de ${formatearCop(cupo)}` : null;
  });

  protected readonly errorOrigenDestino = computed(() => {
    if (this.tipo() !== 'transferencia') return null;
    const { desdeId, haciaId } = this.valorFormulario();
    return desdeId && haciaId && desdeId === haciaId
      ? 'El origen y el destino deben ser distintos.'
      : null;
  });

  protected readonly errorSaldoInsuficiente = computed(() => {
    if (this.tipo() !== 'transferencia' || !this.esTransferenciaInterna()) return null;
    const { desdeId, monto } = this.valorFormulario();
    const desde = this.cuentas().find((c) => c.id === desdeId);
    if (!desde || !monto) return null;
    const saldo = saldoCuenta(desde, this.movimientos());
    return monto > saldo ? `${desde.nombre} no tiene ${formatearCop(monto)} disponibles.` : null;
  });

  /** "Mercado" si ya eligió la categoría: es lo que se guarda si no escribe nada. */
  protected readonly placeholderDescripcion = computed(() => {
    const categoria = this.categorias().find((c) => c.id === this.valorFormulario().categoriaId);
    return categoria ? `${categoria.nombre}, si no escribes nada` : 'Ej.: almuerzo con el equipo';
  });

  protected readonly formularioValido = computed(
    () =>
      this.estadoFormulario() === 'VALID' &&
      !this.errorMontoCupo() &&
      !this.errorOrigenDestino() &&
      !this.errorSaldoInsuficiente(),
  );

  constructor() {
    if (this.movimientoEditando) {
      this.prellenarDesdeMovimiento(this.movimientoEditando);
    } else {
      this.prellenarDesdeAtajo(this.datosIniciales);
    }

    this.actualizarValidadores(this.form.controls.tipo.value);
    this.form.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tipo) => this.actualizarValidadores(tipo));

    // La última cuenta usada, en cuanto llegan las opciones (con Firestore no
    // están al construir el componente). Solo en un movimiento nuevo y si el
    // campo sigue vacío: un atajo ("Pagar", "Agregar compra") o lo que el
    // usuario ya eligió mandan.
    if (!this.modoEdicion) {
      effect(() => {
        const pagarCon = this.ultimaCuenta().gasto;
        const control = this.form.controls.pagarConId;
        if (
          pagarCon &&
          control.value === null &&
          this.buscarOpcion(pagarCon, this.gruposPagarCon())
        ) {
          control.setValue(pagarCon);
        }
        const destino = this.ultimaCuenta().ingreso;
        const controlDestino = this.form.controls.destinoId;
        if (
          destino &&
          controlDestino.value === null &&
          this.opcionesCuentas().some((o) => o.id === destino)
        ) {
          controlDestino.setValue(destino);
        }
      });
    }

    // Tocar fuera de la hoja ya no borra lo escrito: solo cierra si no se
    // ha tocado nada. La X y Escape siguen cerrando siempre (ver
    // `NuevoMovimientoService`, que abre con `disableClose`).
    const ref = this.dialogRef ?? this.bottomSheetRef;
    ref
      ?.backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.form.dirty) this.cerrar();
      });
    ref
      ?.keydownEvents()
      .pipe(
        filter((e) => e.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cerrar());
  }

  protected invalido(control: AbstractControl): boolean {
    return control.invalid && this.intento();
  }

  protected cambiarTipo(tipo: TipoFormularioMovimiento): void {
    // Gasto e ingreso comparten el campo de categoría pero no el catálogo:
    // la categoría de uno no vale en el otro.
    if (tipo !== this.tipo()) this.form.controls.categoriaId.setValue(null);
    this.form.controls.tipo.setValue(tipo);
  }

  protected cerrar(): void {
    this.dialogRef?.close();
    this.bottomSheetRef?.dismiss();
  }

  /** Lo que se elige en el menú de una fila. */
  protected elegir(
    campo: 'categoriaId' | 'pagarConId' | 'destinoId' | 'desdeId' | 'haciaId' | 'cuotas',
    valor: string | number,
  ): void {
    const control = this.form.controls[campo] as AbstractControl;
    control.setValue(valor);
    control.markAsDirty();
  }

  protected etiquetaCuenta(id: string | null | undefined): string | undefined {
    return this.opcionesCuentas().find((o) => o.id === id)?.etiqueta;
  }

  protected registrar(): void {
    this.intento.set(true);
    this.form.markAllAsTouched();
    if (!this.formularioValido()) {
      // Al primer campo con error, para no buscarlo a ojo (ni a ciegas con
      // un lector de pantalla). Espera a que la vista pinte `aria-invalid`.
      setTimeout(() => this.host.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (this.guardando()) return;

    const valores = this.form.getRawValue();
    if (valores.tipo === 'gasto') this.registrarGasto(valores);
    else if (valores.tipo === 'ingreso') this.registrarIngreso(valores);
    else this.registrarTransferencia(valores);
  }

  // — construcción del movimiento por tipo —

  /** La descripción escrita o, si quedó vacía, el nombre de la categoría. */
  private descripcionDe(valores: ReturnType<typeof this.form.getRawValue>): string {
    const escrita = valores.descripcion.trim();
    if (escrita) return escrita;
    return this.categorias().find((c) => c.id === valores.categoriaId)?.nombre ?? '';
  }

  private guardarUltimaCuenta(cambios: { gasto?: string; ingreso?: string }): void {
    this.preferenciasApi.actualizar({ ultimaCuenta: cambios }).subscribe();
  }

  private registrarGasto(valores: ReturnType<typeof this.form.getRawValue>): void {
    const opcion = this.opcionPagarCon();
    if (!opcion || valores.monto === null) return;
    const esCredito = opcion.tipo === 'credito';
    const descripcion = this.descripcionDe(valores);
    if (!this.modoEdicion && !esCredito) this.guardarUltimaCuenta({ gasto: opcion.id });

    const datos: Omit<Movimiento, 'id' | 'creadoEn'> = {
      fecha: valores.fecha,
      tipo: 'GASTO',
      monto: valores.monto,
      descripcion,
      categoriaId: valores.categoriaId ?? undefined,
      cuentaOrigenId: esCredito ? undefined : opcion.id,
      creditoOrigenId: esCredito ? opcion.id : undefined,
      pagoFijoId: this.pagoFijoId,
      periodo: this.periodo,
    };

    this.guardando.set(true);
    const guardarMovimiento$ = this.movimientoEditando
      ? this.movimientosApi.actualizar(this.movimientoEditando.id, datos)
      : this.movimientosApi.crear(datos);

    guardarMovimiento$.subscribe({
      next: (movimiento) => {
        if (!esCredito) {
          this.finalizar('Gasto registrado');
          return;
        }

        const datosCompra: Omit<CompraCuotas, 'id'> = {
          creditoId: opcion.id,
          movimientoId: movimiento.id,
          descripcion,
          monto: valores.monto!,
          numCuotas: valores.cuotas,
          valorCuota:
            this.esPlataforma() && valores.valorCuota !== null ? valores.valorCuota : undefined,
          fecha: valores.fecha,
        };
        const guardarCompra$ = this.compraEditandoId()
          ? this.comprasApi.actualizar(this.compraEditandoId()!, datosCompra)
          : this.comprasApi.crear(datosCompra);
        guardarCompra$.subscribe({
          next: () => this.finalizar('Gasto registrado'),
          error: (error) => this.fallo(error),
        });
      },
      error: (error) => this.fallo(error),
    });
  }

  private registrarIngreso(valores: ReturnType<typeof this.form.getRawValue>): void {
    if (!valores.destinoId || valores.monto === null) return;
    if (!this.modoEdicion) this.guardarUltimaCuenta({ ingreso: valores.destinoId });

    const datos: Omit<Movimiento, 'id' | 'creadoEn'> = {
      fecha: valores.fecha,
      tipo: 'INGRESO',
      monto: valores.monto,
      descripcion: this.descripcionDe(valores),
      categoriaId: valores.categoriaId ?? undefined,
      cuentaDestinoId: valores.destinoId,
    };

    this.guardando.set(true);
    const guardar$ = this.movimientoEditando
      ? this.movimientosApi.actualizar(this.movimientoEditando.id, datos)
      : this.movimientosApi.crear(datos);
    guardar$.subscribe({
      next: () => this.finalizar('Ingreso registrado'),
      error: (error) => this.fallo(error),
    });
  }

  private registrarTransferencia(valores: ReturnType<typeof this.form.getRawValue>): void {
    const opcionHacia = this.opcionHacia();
    if (!opcionHacia || !valores.desdeId || valores.monto === null) return;

    const haciaEsCredito = opcionHacia.tipo === 'credito';
    const credito = haciaEsCredito
      ? this.creditos().find((c) => c.id === opcionHacia.id)
      : undefined;
    const cuentaHacia = !haciaEsCredito
      ? this.cuentas().find((c) => c.id === opcionHacia.id)
      : undefined;
    const interno = !haciaEsCredito && this.esTransferenciaInterna();

    const descripcion = descripcionAutomaticaTransferencia({
      nombreCreditoDestino: credito?.nombre,
      destinoEsEfectivo: cuentaHacia?.tipo === 'EFECTIVO',
    });

    const datos: Omit<Movimiento, 'id' | 'creadoEn'> = {
      fecha: valores.fecha,
      tipo: interno ? 'INTERNO' : 'TRANSFERENCIA',
      monto: valores.monto,
      descripcion,
      cuentaOrigenId: valores.desdeId,
      cuentaDestinoId: haciaEsCredito ? undefined : opcionHacia.id,
      creditoDestinoId: haciaEsCredito ? opcionHacia.id : undefined,
      periodo: this.periodo,
    };

    this.guardando.set(true);
    const guardar$ = this.movimientoEditando
      ? this.movimientosApi.actualizar(this.movimientoEditando.id, datos)
      : this.movimientosApi.crear(datos);
    guardar$.subscribe({
      next: () => this.finalizar(haciaEsCredito ? 'Pago registrado' : 'Transferencia registrada'),
      error: (error) => this.fallo(error),
    });
  }

  private finalizar(mensaje: string): void {
    this.guardando.set(false);
    this.snackBar.open(this.mensajeDeExito(mensaje), undefined, { duration: 3000 });
    this.cerrar();
  }

  /**
   * El aviso de éxito, nombrando el pago fijo cuando el movimiento viene
   * del botón "Pagar" de Pagos fijos.
   *
   * Quien pulsa "Pagar" no fue a "registrar un gasto": fue a saldar el
   * arriendo. Un "Gasto registrado" genérico no confirma lo que acaba de
   * hacer, sobre todo porque la fila desaparece de "Por pagar" y aparece
   * en "Pagados" mientras el formulario todavía se está cerrando encima.
   *
   * Basta con mirar `nombrePagoFijo`: es el único dato que llega
   * exclusivamente desde ese atajo, y no se hereda al editar un movimiento
   * viejo (editar no es marcar nada como pagado).
   *
   * La frase evita concordancia de género a propósito: los nombres van
   * desde "Arriendo" hasta "Visa Bancolombia", y "marcado como pagado"
   * chirría con la mitad de ellos.
   */
  private mensajeDeExito(porDefecto: string): string {
    return this.nombrePagoFijo ? `Pago de ${this.nombrePagoFijo} registrado` : porDefecto;
  }

  private fallo(error: unknown): void {
    this.guardando.set(false);
    mostrarErrorGuardado(this.snackBar, error);
  }

  // — helpers —

  private buscarOpcion(
    id: string | null | undefined,
    grupos: GrupoOpcionesMovimiento[],
  ): OpcionMovimiento | undefined {
    if (!id) return undefined;
    for (const grupo of grupos) {
      const encontrada = grupo.opciones.find((o) => o.id === id);
      if (encontrada) return encontrada;
    }
    return undefined;
  }

  private fechaHoyIso(): string {
    return fechaIsoDesdeLocal(new Date());
  }

  private prellenarDesdeAtajo(datos: MovimientoFormData): void {
    if (datos.tipo) this.form.controls.tipo.setValue(datos.tipo);
    if (datos.monto !== undefined) this.form.controls.monto.setValue(datos.monto);
    if (datos.descripcion) this.form.controls.descripcion.setValue(datos.descripcion);
    if (datos.categoriaId) this.form.controls.categoriaId.setValue(datos.categoriaId);
    if (datos.cuentaOrigenId) {
      this.form.controls.pagarConId.setValue(datos.cuentaOrigenId);
      this.form.controls.desdeId.setValue(datos.cuentaOrigenId);
    }
    if (datos.cuentaDestinoId) {
      this.form.controls.destinoId.setValue(datos.cuentaDestinoId);
      this.form.controls.haciaId.setValue(datos.cuentaDestinoId);
    }
    if (datos.creditoId) this.form.controls.pagarConId.setValue(datos.creditoId);
  }

  /**
   * Nota: asume que `cuentas`/`creditos`/`compras` ya están disponibles al
   * construir el componente: las pantallas que abren el formulario en modo
   * edición ya las tienen cargadas (Firestore las sirve desde su caché).
   */
  private prellenarDesdeMovimiento(movimiento: Movimiento): void {
    this.form.controls.monto.setValue(movimiento.monto);
    this.form.controls.fecha.setValue(movimiento.fecha);
    this.form.controls.descripcion.setValue(movimiento.descripcion);
    this.form.controls.categoriaId.setValue(movimiento.categoriaId ?? null);

    if (movimiento.tipo === 'GASTO') {
      this.form.controls.tipo.setValue('gasto');
      if (movimiento.creditoOrigenId) {
        this.form.controls.pagarConId.setValue(movimiento.creditoOrigenId);
        const compra = this.compras().find((c) => c.movimientoId === movimiento.id);
        if (compra) {
          this.form.controls.cuotas.setValue(compra.numCuotas);
          if (compra.valorCuota !== undefined)
            this.form.controls.valorCuota.setValue(compra.valorCuota);
          this.compraEditandoId.set(compra.id);
        }
      } else if (movimiento.cuentaOrigenId) {
        this.form.controls.pagarConId.setValue(movimiento.cuentaOrigenId);
      }
    } else if (movimiento.tipo === 'INGRESO') {
      this.form.controls.tipo.setValue('ingreso');
      if (movimiento.cuentaDestinoId)
        this.form.controls.destinoId.setValue(movimiento.cuentaDestinoId);
    } else if (movimiento.tipo === 'TRANSFERENCIA' || movimiento.tipo === 'INTERNO') {
      this.form.controls.tipo.setValue('transferencia');
      if (movimiento.cuentaOrigenId) this.form.controls.desdeId.setValue(movimiento.cuentaOrigenId);
      const haciaId = movimiento.cuentaDestinoId ?? movimiento.creditoDestinoId;
      if (haciaId) this.form.controls.haciaId.setValue(haciaId);
    }
    // AJUSTE no se edita desde este formulario: se corrige desde "Ajustar saldo" en Cuentas.
  }

  private actualizarValidadores(tipo: TipoFormularioMovimiento): void {
    const c = this.form.controls;
    c.descripcion.clearValidators();
    c.categoriaId.clearValidators();
    c.pagarConId.clearValidators();
    c.cuotas.clearValidators();
    c.destinoId.clearValidators();
    c.desdeId.clearValidators();
    c.haciaId.clearValidators();

    // La descripción ya no es obligatoria: si queda vacía se guarda el
    // nombre de la categoría (ver `descripcionDe`).
    if (tipo === 'gasto') {
      c.categoriaId.setValidators(Validators.required);
      c.pagarConId.setValidators(Validators.required);
      c.cuotas.setValidators([Validators.required, Validators.min(1), Validators.max(48)]);
    } else if (tipo === 'ingreso') {
      c.categoriaId.setValidators(Validators.required);
      c.destinoId.setValidators(Validators.required);
    } else {
      c.desdeId.setValidators(Validators.required);
      c.haciaId.setValidators(Validators.required);
    }

    for (const control of Object.values(c)) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }
}
