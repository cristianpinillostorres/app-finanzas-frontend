export type TipoCategoria = 'GASTO' | 'INGRESO';

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  /** Nombre del ícono de Material Symbols Outlined. */
  icono: string;
  /**
   * Oculta en los formularios (no se ofrece para movimientos nuevos), pero
   * sigue existiendo: los movimientos viejos la conservan con su nombre.
   * Por eso las categorías nunca se borran.
   */
  archivada: boolean;
  /** Creada por la persona; `false` para las del catálogo base. */
  personalizada: boolean;
  /**
   * Presupuesto: lo máximo que la persona quiere gastar al mes en esta
   * categoría. `null` sin presupuesto. Solo tiene sentido en las de gasto.
   */
  topeMensual: number | null;
}

/** Lo que pide el formulario para crear una categoría propia. */
export type NuevaCategoria = Pick<Categoria, 'nombre' | 'tipo' | 'icono' | 'topeMensual'>;

/** Lo que se puede cambiar de cualquier categoría, base o propia. */
export type CambiosCategoria = Partial<
  Pick<Categoria, 'nombre' | 'icono' | 'archivada' | 'topeMensual'>
>;
