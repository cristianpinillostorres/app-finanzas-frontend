import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';

import { CREDITOS_API } from '../../../core/api/creditos/creditos-api';
import type { Credito, GrupoCredito, NuevoCredito, TipoTasa } from '../../../core/models';
import { campoInvalido } from '../../../shared/forms/campo.util';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { GuardandoOverlay } from '../../../shared/guardando-overlay/guardando-overlay';
import type { CreditoFormData } from './credito-form-data';

interface OpcionGrupo {
  valor: GrupoCredito;
  etiqueta: string;
}

interface OpcionTipoTasa {
  valor: TipoTasa;
  etiqueta: string;
}

/**
 * Crear o editar un crédito. El grupo (tarjeta/banco/plataforma/persona)
 * decide qué campos aplican — mismo patrón que `MovimientoForm` con su
 * `tipo` (validadores dinámicos vía `actualizarValidadores`) — y a
 * diferencia de ese `tipo`, aquí el grupo no se puede cambiar al editar:
 * son formas de deuda demasiado distintas (cupo vs. tabla de amortización
 * vs. abonos libres) como para migrar una a otra sin dejar huérfanas las
 * compras o los cambios de tasa que ya cuelgan del crédito.
 */
@Component({
  selector: 'app-credito-form',
  imports: [ReactiveFormsModule, MatIconModule, MatButtonModule, GuardandoOverlay],
  templateUrl: './credito-form.html',
  styleUrl: './credito-form.scss',
})
export class CreditoForm {
  private readonly fb = inject(FormBuilder);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<CreditoForm>);
  private readonly datos = inject<CreditoFormData>(MAT_DIALOG_DATA);

  protected readonly opcionesGrupo: OpcionGrupo[] = [
    { valor: 'TARJETA', etiqueta: 'Tarjeta de crédito' },
    { valor: 'BANCO', etiqueta: 'Préstamo con banco' },
    { valor: 'PLATAFORMA', etiqueta: 'Plataforma de cuotas' },
    { valor: 'PERSONA', etiqueta: 'Persona' },
  ];

  protected readonly opcionesTipoTasa: OpcionTipoTasa[] = [
    { valor: 'FIJA', etiqueta: 'Fija' },
    { valor: 'VARIABLE', etiqueta: 'Variable' },
  ];

  private readonly creditoEditando = this.datos.credito;
  protected readonly modoEdicion = this.creditoEditando !== undefined;
  protected readonly guardando = signal(false);
  protected readonly invalido = campoInvalido;

  protected readonly form = this.fb.nonNullable.group({
    grupo: this.fb.nonNullable.control<GrupoCredito>(
      this.creditoEditando?.grupo ?? this.datos.grupo ?? 'TARJETA',
      Validators.required,
    ),
    nombre: this.fb.nonNullable.control(this.creditoEditando?.nombre ?? '', Validators.required),
    entidad: this.fb.nonNullable.control(this.creditoEditando?.entidad ?? ''),
    diaPago: this.fb.nonNullable.control(this.creditoEditando?.diaPago ?? 15, [
      Validators.required,
      Validators.min(1),
      Validators.max(31),
    ]),

    // Tarjeta
    ultimos4: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'TARJETA' ? (this.creditoEditando.ultimos4 ?? '') : '',
    ),
    diaCorte: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'TARJETA' ? this.creditoEditando.diaCorte : 20,
    ),

    // Tarjeta / Plataforma
    cupo: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'TARJETA' || this.creditoEditando?.grupo === 'PLATAFORMA'
        ? this.creditoEditando.cupo
        : 0,
    ),

    // Banco / Persona
    monto: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'BANCO' || this.creditoEditando?.grupo === 'PERSONA'
        ? this.creditoEditando.monto
        : 0,
    ),

    // Banco
    tasaEaPorcentaje: this.fb.control<number | null>(
      this.creditoEditando?.grupo === 'BANCO' ? this.creditoEditando.tasaEa * 100 : null,
    ),
    tipoTasa: this.fb.nonNullable.control<TipoTasa>(
      this.creditoEditando?.grupo === 'BANCO' ? this.creditoEditando.tipoTasa : 'FIJA',
    ),
    plazoMeses: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'BANCO' ? this.creditoEditando.plazoMeses : 12,
    ),
    cuotasPagadasIniciales: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'BANCO' ? this.creditoEditando.cuotasPagadasIniciales : 0,
    ),
    seguroMensual: this.fb.nonNullable.control(
      this.creditoEditando?.grupo === 'BANCO' ? this.creditoEditando.seguroMensual : 0,
    ),

    // Persona
    fechaAcordada: this.fb.control<string | null>(
      this.creditoEditando?.grupo === 'PERSONA'
        ? (this.creditoEditando.fechaAcordada ?? null)
        : null,
    ),
  });

  private readonly grupoSeleccionado = toSignal(
    this.form.controls.grupo.valueChanges.pipe(startWith(this.form.controls.grupo.value)),
    { initialValue: this.form.controls.grupo.value },
  );

  protected readonly esTarjeta = computed(() => this.grupoSeleccionado() === 'TARJETA');
  protected readonly esBanco = computed(() => this.grupoSeleccionado() === 'BANCO');
  protected readonly esPersona = computed(() => this.grupoSeleccionado() === 'PERSONA');
  protected readonly pideCupo = computed(() => {
    const grupo = this.grupoSeleccionado();
    return grupo === 'TARJETA' || grupo === 'PLATAFORMA';
  });
  protected readonly pideEntidad = computed(() => !this.esPersona());

  constructor() {
    if (this.modoEdicion) {
      // El grupo queda fijo: se deshabilita en vez de ocultarse para que
      // `getRawValue()` lo siga incluyendo al construir el payload.
      this.form.controls.grupo.disable();
    } else {
      this.form.controls.grupo.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe((grupo) => this.actualizarValidadores(grupo));
    }
    this.actualizarValidadores(this.form.controls.grupo.value);
  }

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const datos = this.construirDatos(this.form.getRawValue());

    const guardar$ = this.creditoEditando
      ? this.creditosApi.actualizar(this.creditoEditando.id, datos)
      : this.creditosApi.crear(datos);

    guardarConFeedback(
      this.snackBar,
      this.guardando,
      guardar$,
      this.modoEdicion ? 'Crédito actualizado' : 'Crédito creado',
      () => this.dialogRef.close(true),
    );
  }

  private construirDatos(v: ReturnType<typeof this.form.getRawValue>): NuevoCredito {
    const base = {
      nombre: v.nombre,
      entidad: v.entidad || undefined,
      diaPago: v.diaPago,
    };

    switch (v.grupo) {
      case 'TARJETA':
        return {
          ...base,
          grupo: 'TARJETA',
          ultimos4: v.ultimos4 || undefined,
          cupo: v.cupo,
          diaCorte: v.diaCorte,
        };
      case 'PLATAFORMA':
        return { ...base, grupo: 'PLATAFORMA', cupo: v.cupo };
      case 'BANCO':
        return {
          ...base,
          grupo: 'BANCO',
          monto: v.monto,
          tasaEa: (v.tasaEaPorcentaje ?? 0) / 100,
          tipoTasa: v.tipoTasa,
          plazoMeses: v.plazoMeses,
          cuotasPagadasIniciales: v.cuotasPagadasIniciales,
          seguroMensual: v.seguroMensual,
        };
      case 'PERSONA':
        return {
          ...base,
          grupo: 'PERSONA',
          monto: v.monto,
          fechaAcordada: v.fechaAcordada || undefined,
        };
    }
  }

  private actualizarValidadores(grupo: GrupoCredito): void {
    const c = this.form.controls;
    c.diaCorte.clearValidators();
    c.cupo.clearValidators();
    c.monto.clearValidators();
    c.tasaEaPorcentaje.clearValidators();
    c.plazoMeses.clearValidators();
    c.cuotasPagadasIniciales.clearValidators();
    c.seguroMensual.clearValidators();

    if (grupo === 'TARJETA') {
      c.diaCorte.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      c.cupo.setValidators([Validators.required, Validators.min(1)]);
    } else if (grupo === 'PLATAFORMA') {
      c.cupo.setValidators([Validators.required, Validators.min(1)]);
    } else if (grupo === 'BANCO') {
      c.monto.setValidators([Validators.required, Validators.min(1)]);
      c.tasaEaPorcentaje.setValidators([Validators.required, Validators.min(0)]);
      c.plazoMeses.setValidators([Validators.required, Validators.min(1), Validators.max(360)]);
      c.cuotasPagadasIniciales.setValidators([Validators.required, Validators.min(0)]);
      c.seguroMensual.setValidators([Validators.required, Validators.min(0)]);
    } else if (grupo === 'PERSONA') {
      c.monto.setValidators([Validators.required, Validators.min(1)]);
    }

    for (const control of Object.values(c)) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }
}
