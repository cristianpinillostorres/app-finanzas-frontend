import type { Categoria } from '../../models';

/**
 * Catálogo base de categorías, el mismo para todos. Vive como constante en
 * el código y no en Firestore: lo que cada persona personaliza se guarda
 * aparte, en `usuarios/{uid}/categorias`, y se combina encima (ver
 * `combinarCategorias`). Así un cambio al catálogo llega a todos sin
 * migrar datos, y los ids `cat-*` de los movimientos viejos siguen valiendo.
 */
export const CATALOGO_CATEGORIAS: Categoria[] = (
  [
    ['cat-mercado', 'Mercado', 'GASTO', 'shopping_cart'],
    ['cat-restaurantes', 'Restaurantes', 'GASTO', 'restaurant'],
    ['cat-transporte', 'Transporte', 'GASTO', 'directions_bus'],
    ['cat-entretenimiento', 'Entretenimiento', 'GASTO', 'movie'],
    ['cat-salud', 'Salud', 'GASTO', 'medical_services'],
    ['cat-hogar', 'Hogar', 'GASTO', 'home'],
    ['cat-servicios', 'Servicios', 'GASTO', 'bolt'],
    ['cat-tecnologia', 'Tecnología', 'GASTO', 'devices'],
    ['cat-otros-gastos', 'Otros gastos', 'GASTO', 'more_horiz'],
    ['cat-salario', 'Salario', 'INGRESO', 'payments'],
    ['cat-freelance', 'Freelance', 'INGRESO', 'work'],
    ['cat-reembolso', 'Reembolso', 'INGRESO', 'undo'],
    ['cat-otros-ingresos', 'Otros ingresos', 'INGRESO', 'more_horiz'],
  ] as const
).map(([id, nombre, tipo, icono]) => ({
  id,
  nombre,
  tipo,
  icono,
  archivada: false,
  personalizada: false,
  topeMensual: null,
}));

/**
 * Si la persona ya adaptó las categorías: creó una propia, o renombró,
 * cambió el ícono u ocultó una del catálogo.
 */
export function hayCategoriasAjustadas(categorias: readonly Categoria[]): boolean {
  const base = new Map(CATALOGO_CATEGORIAS.map((c) => [c.id, c]));
  return categorias.some((c) => {
    const original = base.get(c.id);
    return (
      !original ||
      c.nombre !== original.nombre ||
      c.icono !== original.icono ||
      c.archivada !== original.archivada
    );
  });
}

/** Íconos que ofrece el formulario de categoría. */
export const ICONOS_CATEGORIA: string[] = [
  'shopping_cart',
  'restaurant',
  'local_cafe',
  'directions_bus',
  'local_gas_station',
  'directions_car',
  'home',
  'bolt',
  'wifi',
  'smartphone',
  'devices',
  'medical_services',
  'fitness_center',
  'school',
  'child_care',
  'pets',
  'checkroom',
  'content_cut',
  'movie',
  'sports_esports',
  'flight',
  'card_giftcard',
  'volunteer_activism',
  'savings',
  'payments',
  'work',
  'storefront',
  'trending_up',
  'undo',
  'more_horiz',
];

/** Lo que guarda Firestore por categoría: completa si es propia, solo los cambios si es del catálogo. */
export type DocCategoria = Partial<Omit<Categoria, 'id'>>;

/**
 * Catálogo base + lo guardado por la persona. Un documento con id `cat-*`
 * es un ajuste a una categoría base (renombrarla, cambiarle el ícono,
 * ocultarla); cualquier otro id es una categoría propia. Una propia sin
 * nombre o tipo (documento a medio escribir) se ignora.
 */
export function combinarCategorias(
  catalogo: readonly Categoria[],
  docs: ReadonlyArray<{ id: string; datos: DocCategoria }>,
): Categoria[] {
  const porId = new Map(docs.map((d) => [d.id, d.datos]));
  const base = catalogo.map((c) => {
    const ajuste = porId.get(c.id);
    return ajuste
      ? {
          ...c,
          nombre: ajuste.nombre ?? c.nombre,
          icono: ajuste.icono ?? c.icono,
          archivada: ajuste.archivada ?? c.archivada,
          // `null` guardado quiere decir "quitó el tope": no es lo mismo que
          // no haberlo tocado nunca.
          topeMensual: ajuste.topeMensual !== undefined ? ajuste.topeMensual : c.topeMensual,
        }
      : c;
  });
  const idsBase = new Set(catalogo.map((c) => c.id));
  const propias = docs
    .filter((d) => !idsBase.has(d.id) && d.datos.nombre && d.datos.tipo)
    .map((d): Categoria => ({
      id: d.id,
      nombre: d.datos.nombre!,
      tipo: d.datos.tipo!,
      icono: d.datos.icono ?? 'sell',
      archivada: d.datos.archivada ?? false,
      personalizada: true,
      topeMensual: d.datos.topeMensual ?? null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return [...base, ...propias];
}
