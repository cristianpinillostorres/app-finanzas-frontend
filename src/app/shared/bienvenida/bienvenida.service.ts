import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { CATEGORIAS_API } from '../../core/api/categorias/categorias-api';
import { hayCategoriasAjustadas } from '../../core/api/categorias/categorias-catalogo';
import { CREDITOS_API } from '../../core/api/creditos/creditos-api';
import { CUENTAS_API } from '../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../core/api/movimientos/movimientos-api';
import { PAGOS_FIJOS_API } from '../../core/api/pagos-fijos/pagos-fijos-api';
import { PREFERENCIAS_API } from '../../core/api/preferencias/preferencias-api';
import { type CambiosPreferencias, PREFERENCIAS_INICIALES } from '../../core/models';
import { NuevoMovimientoService } from '../../layout/nuevo-movimiento/nuevo-movimiento.service';
import { primeraCarga } from '../carga/primera-carga';
import {
  type ContextoBienvenida,
  type PasoBienvenida,
  PASOS_BIENVENIDA,
  estadoBienvenida,
} from './pasos-bienvenida';

/** Secciones que no sirven de nada sin una cuenta: ahí se registra la plata que sale y entra. */
const SECCIONES_QUE_PIDEN_CUENTA = ['movimientos', 'pagos-fijos'];

/** Parámetro de la URL que abre la franja guía de un paso (`?guia=categorias`). */
export const PARAM_GUIA = 'guia';

/**
 * Estado del recorrido de bienvenida, compartido entre el checklist de
 * General (`PrimerosPasos`) y la franja guía de cada pantalla (`GuiaPaso`):
 * qué pasos hay, cuáles están hechos, cuáles saltó la persona, y cómo ir
 * de uno al siguiente.
 *
 * Lo que la persona decide ("Saltar recorrido", "No tengo deudas") se
 * guarda en su cuenta (`PreferenciasApi`): la sigue en cualquier navegador
 * o dispositivo, en vez de volver a preguntarle.
 */
@Injectable({ providedIn: 'root' })
export class BienvenidaService {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly nuevoMovimiento = inject(NuevoMovimientoService);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly preferenciasApi = inject(PREFERENCIAS_API);

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] });
  private readonly categorias = toSignal(this.categoriasApi.listar(), { initialValue: [] });
  private readonly creditos = toSignal(this.creditosApi.listar(), { initialValue: [] });
  private readonly pagosFijos = toSignal(this.pagosFijosApi.listar(), { initialValue: [] });
  private readonly movimientos = toSignal(this.movimientosApi.listar(), { initialValue: [] });
  private readonly preferencias = toSignal(this.preferenciasApi.obtener(), {
    initialValue: PREFERENCIAS_INICIALES,
  });

  /** Hasta que llegan los datos no se sabe qué está hecho: nada se muestra. */
  readonly listo = primeraCarga(
    this.cuentasApi.listar(),
    this.categoriasApi.listar(),
    this.creditosApi.listar(),
    this.pagosFijosApi.listar(),
    this.movimientosApi.listar(),
    // Sin esto, "Saltar recorrido" valdría `false` hasta que llegue y la
    // app mandaría a la bienvenida a quien ya la saltó.
    this.preferenciasApi.obtener(),
  );

  /**
   * Los ajustes no cuentan como "primer movimiento": salen de cuadrar
   * saldos, no de registrar algo.
   */
  readonly contexto = computed<ContextoBienvenida>(() => ({
    cuentas: this.cuentas().length,
    categoriasAjustadas: hayCategoriasAjustadas(this.categorias()),
    creditos: this.creditos().length,
    pagosFijos: this.pagosFijos().length,
    movimientos: this.movimientos().filter((m) => m.tipo !== 'AJUSTE').length,
    presupuestos: this.categorias().filter((c) => c.topeMensual).length,
  }));

  /**
   * Lo guardado en la cuenta, pero se puede cambiar al instante: al saltar
   * el recorrido la app navega enseguida, y si esperara la respuesta de
   * Firestore el `Shell` alcanzaría a devolverla a la bienvenida.
   */
  private readonly _oculto = linkedSignal(() => this.preferencias().recorrido.oculto);
  readonly oculto = this._oculto.asReadonly();
  private readonly omitidos = computed<ReadonlySet<string>>(
    () => new Set(this.preferencias().recorrido.omitidos),
  );

  /** Lo que eligió en "¿Qué quieres lograr?"; se cambia al instante, como `oculto`. */
  private readonly _objetivos = linkedSignal(() => this.preferencias().objetivos);
  readonly objetivos = this._objetivos.asReadonly();
  /** Cómo prefiere que la llamemos (ver `Preferencias.nombre`). */
  private readonly _nombre = linkedSignal(() => this.preferencias().nombre);
  readonly nombre = this._nombre.asReadonly();

  /** El bloque que toca (ver `estadoBienvenida`), o `null` si no queda nada. */
  readonly estado = computed(() =>
    this.listo()
      ? estadoBienvenida(PASOS_BIENVENIDA, this.contexto(), this.omitidos(), this.objetivos())
      : null,
  );

  /** Mientras falte algo de lo esencial y la persona no haya saltado el recorrido. */
  readonly recorridoActivo = computed(() => !this.oculto() && this.estado()?.bloque === 'esencial');

  /**
   * Durante el recorrido, sin ninguna cuenta: registrar un movimiento o un
   * pago fijo no tiene a dónde ir, así que esas acciones se bloquean y
   * dicen qué falta (ver `avisarBloqueo`). Saltar el recorrido las abre.
   */
  readonly faltaCuenta = computed(
    () => this.listo() && this.recorridoActivo() && this.contexto().cuentas === 0,
  );

  /** Si una sección del menú está bloqueada por el recorrido. */
  seccionBloqueada(path: string): boolean {
    return this.faltaCuenta() && SECCIONES_QUE_PIDEN_CUENTA.includes(path);
  }

  /** Por qué algo está bloqueado: tooltip de lo bloqueado y texto del aviso al tocarlo. */
  readonly motivoBloqueo = 'Primero crea una cuenta: ahí es donde se registra tu plata.';

  /** Explica el bloqueo y ofrece ir directo a resolverlo. */
  avisarBloqueo(): void {
    const paso = PASOS_BIENVENIDA.find((p) => p.id === 'cuentas')!;
    this.snackBar
      .open(this.motivoBloqueo, 'Crear cuenta', {
        duration: 5000,
      })
      .onAction()
      .subscribe(() => this.irA(paso));
  }

  resuelto(paso: PasoBienvenida): boolean {
    return paso.hecho(this.contexto()) || (!!paso.omitir && this.omitidos().has(paso.id));
  }

  /** El primer paso pendiente del bloque que toca, o `null` si no queda ninguno. */
  siguientePendiente(): PasoBienvenida | null {
    return this.estado()?.pasos.find((p) => p.estado === 'pendiente')?.paso ?? null;
  }

  /** Lleva a la pantalla del paso, con su franja guía; o abre el formulario del "+". */
  irA(paso: PasoBienvenida): void {
    if (paso.destino === 'nuevo-movimiento') {
      if (this.faltaCuenta()) {
        this.avisarBloqueo();
        return;
      }
      this.nuevoMovimiento.abrir();
      return;
    }
    void this.router.navigate([paso.destino.ruta], { queryParams: { [PARAM_GUIA]: paso.id } });
  }

  omitir(paso: PasoBienvenida): void {
    if (this.omitidos().has(paso.id)) return;
    this.guardarRecorrido({ omitidos: [...this.omitidos(), paso.id] });
  }

  ocultar(): void {
    this._oculto.set(true);
    this.guardarRecorrido({ oculto: true });
  }

  /** Deshace "Ocultar": el recorrido vuelve a aparecer en General. */
  mostrar(): void {
    this._oculto.set(false);
    this.guardarRecorrido({ oculto: false });
  }

  /** Guarda en la cuenta el paso "Cuéntanos de ti"; reemplaza lo elegido antes. */
  guardarCaracterizacion(
    cambios: Required<Pick<CambiosPreferencias, 'nombre' | 'objetivos'>>,
  ): void {
    this._nombre.set(cambios.nombre);
    this._objetivos.set(cambios.objetivos);
    this.preferenciasApi.actualizar(cambios).subscribe();
  }

  /**
   * La caché de Firestore aplica la escritura al instante, así que
   * `oculto` y `omitidos` cambian sin esperar al servidor.
   */
  private guardarRecorrido(cambios: { oculto?: boolean; omitidos?: string[] }): void {
    this.preferenciasApi.actualizar({ recorrido: cambios }).subscribe();
  }
}
