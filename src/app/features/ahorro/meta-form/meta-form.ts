import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CUENTAS_API } from '../../../core/api/cuentas/cuentas-api';
import { PREFERENCIAS_API } from '../../../core/api/preferencias/preferencias-api';
import { type Cuenta, type MetaAhorro, PREFERENCIAS_INICIALES } from '../../../core/models';
import { idNuevo } from '../../../core/sync/tablas';
import { campoInvalido } from '../../../shared/forms/campo.util';
import { MontoInput } from '../../../shared/forms/monto-input';
import { Selector } from '../../../shared/forms/selector';
import { mostrarErrorGuardado } from '../../../shared/guardado/guardado.util';
import { GuardandoOverlay } from '../../../shared/guardando-overlay/guardando-overlay';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';
import type { MetaFormData } from './meta-form-data';

/** Valor de "Crear uno nuevo" en la lista de bolsillos. */
const NUEVO = 'nuevo';

/**
 * Crea o edita una meta de ahorro. Su plata vive en un bolsillo reservado:
 * uno que ya tengas (con lo que ya ahorraste en él) o uno nuevo en la cuenta
 * que se elija, así lo ahorrado nunca se anota dos veces. Al editar solo
 * cambian el nombre, el objetivo y el aporte; el bolsillo y su saldo no se
 * tocan.
 */
@Component({
  selector: 'app-meta-form',
  imports: [HojaCabecera, ReactiveFormsModule, GuardandoOverlay, MontoInput, Selector],
  templateUrl: './meta-form.html',
  styleUrl: './meta-form.scss',
})
export class MetaForm {
  private readonly fb = inject(FormBuilder);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<MetaForm, boolean>);
  private readonly datos = inject<MetaFormData>(MAT_DIALOG_DATA);

  protected readonly meta = this.datos.meta;
  protected readonly modoEdicion = this.meta !== undefined;
  protected readonly guardando = signal(false);
  protected readonly invalido = campoInvalido;

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  /** Las cuentas donde puede vivir el bolsillo de una meta nueva. */
  protected readonly opcionesCuenta = computed(() =>
    this.cuentas()
      .filter((c) => c.cuentaPadreId === null && !c.archivada)
      .map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  );

  /** Los bolsillos que ya existen y todavía no son la plata de otra meta. */
  protected readonly bolsillosLibres = computed(() => {
    const usados = new Set(this.preferencias().metasAhorro.map((m) => m.bolsilloId));
    return this.cuentas().filter((c) => c.cuentaPadreId !== null && !c.archivada && !usados.has(c.id));
  });
  protected readonly opcionesDestino = computed(() => [
    { valor: NUEVO, etiqueta: 'Crear uno nuevo' },
    ...this.bolsillosLibres().map((b) => {
      const madre = this.cuentas().find((c) => c.id === b.cuentaPadreId);
      return { valor: b.id, etiqueta: madre ? `${b.nombre} · ${madre.nombre}` : b.nombre };
    }),
  ]);

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control(this.meta?.nombre ?? '', Validators.required),
    // Opcional: sin cifra final la meta solo ahorra (ver `ProgresoMeta.sinObjetivo`).
    objetivo: this.fb.control<number | null>(
      this.meta?.objetivo ? this.meta.objetivo : null,
      Validators.min(0),
    ),
    aporteMensual: this.fb.control<number | null>(
      this.meta?.aporteMensual ?? null,
      Validators.min(0),
    ),
    /** `NUEVO` o el id de un bolsillo que ya existe. */
    destino: this.fb.nonNullable.control(NUEVO),
    cuentaId: this.fb.control<string | null>(null),
  });

  private readonly destino = toSignal(
    this.form.controls.destino.valueChanges.pipe(startWith(NUEVO)),
    { initialValue: NUEVO },
  );
  /** Con un bolsillo nuevo hay que decir en qué cuenta va; con uno existente ya lo sabe. */
  protected readonly creaBolsillo = computed(() => this.destino() === NUEVO);
  protected readonly faltaCuenta = signal(false);

  protected cerrar(): void {
    this.dialogRef.close(false);
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const valores = this.form.getRawValue();
    const nombre = valores.nombre.trim();
    const objetivo = valores.objetivo ?? 0;
    const aporteMensual = valores.aporteMensual ?? 0;
    this.guardando.set(true);

    if (this.meta) {
      const editada: MetaAhorro = { ...this.meta, nombre, objetivo, aporteMensual };
      this.guardarLista(
        this.preferencias().metasAhorro.map((m) => (m.id === editada.id ? editada : m)),
        'Meta actualizada',
      );
      return;
    }

    const nueva = (bolsilloId: string): MetaAhorro[] => [
      ...this.preferencias().metasAhorro,
      { id: idNuevo(), nombre, objetivo, aporteMensual, bolsilloId },
    ];

    // Un bolsillo que ya existe: la meta lo toma tal cual, con lo que ya tiene.
    if (valores.destino !== NUEVO) {
      const bolsillo = this.bolsillosLibres().find((b) => b.id === valores.destino);
      if (!bolsillo) {
        this.guardando.set(false);
        return;
      }
      // Si no estaba reservado, su saldo contaba como plata para gastar y
      // además como ahorro: se reserva para que no cuente dos veces.
      if (bolsillo.reservado) {
        this.guardarLista(nueva(bolsillo.id), 'Meta creada');
      } else {
        this.cuentasApi.actualizar(bolsillo.id, { reservado: true }).subscribe({
          next: () => this.guardarLista(nueva(bolsillo.id), 'Meta creada'),
          error: (error) => this.fallo(error),
        });
      }
      return;
    }

    const cuenta = this.cuentas().find((c) => c.id === valores.cuentaId);
    if (!cuenta) {
      this.guardando.set(false);
      this.faltaCuenta.set(true);
      return;
    }
    // Reservado: lo ahorrado sale de "lo que puedes gastar" desde el primer día.
    this.cuentasApi
      .crearBolsillo({
        nombre,
        cuentaPadreId: cuenta.id,
        color: cuenta.color,
        saldoInicial: 0,
        reservado: true,
      })
      .subscribe({
        next: (bolsillo) => this.guardarLista(nueva(bolsillo.id), 'Meta creada'),
        error: (error) => this.fallo(error),
      });
  }

  private guardarLista(metasAhorro: MetaAhorro[], aviso: string): void {
    this.preferenciasApi.actualizar({ metasAhorro }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open(aviso, undefined, { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error) => this.fallo(error),
    });
  }

  private fallo(error: unknown): void {
    this.guardando.set(false);
    mostrarErrorGuardado(this.snackBar, error);
  }
}
