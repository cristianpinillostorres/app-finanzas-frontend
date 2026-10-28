import { describe, expect, it } from 'vitest';

import { categoriasParaElegir } from './categorias-api';
import {
  CATALOGO_CATEGORIAS,
  combinarCategorias,
  hayCategoriasAjustadas,
} from './categorias-catalogo';

describe('combinarCategorias', () => {
  it('sin nada guardado devuelve el catálogo base', () => {
    expect(combinarCategorias(CATALOGO_CATEGORIAS, [])).toEqual(CATALOGO_CATEGORIAS);
  });

  it('aplica a una categoría base solo los campos guardados', () => {
    const resultado = combinarCategorias(CATALOGO_CATEGORIAS, [
      { id: 'cat-mercado', datos: { nombre: 'Supermercado' } },
      { id: 'cat-salud', datos: { archivada: true } },
    ]);
    const mercado = resultado.find((c) => c.id === 'cat-mercado')!;
    expect(mercado.nombre).toBe('Supermercado');
    expect(mercado.icono).toBe('shopping_cart');
    expect(mercado.personalizada).toBe(false);
    expect(resultado.find((c) => c.id === 'cat-salud')!.archivada).toBe(true);
    expect(resultado).toHaveLength(CATALOGO_CATEGORIAS.length);
  });

  it('agrega las propias después del catálogo, en orden alfabético, e ignora las incompletas', () => {
    const resultado = combinarCategorias(CATALOGO_CATEGORIAS, [
      { id: 'b', datos: { nombre: 'Mascotas', tipo: 'GASTO', icono: 'pets' } },
      { id: 'a', datos: { nombre: 'Gimnasio', tipo: 'GASTO' } },
      { id: 'c', datos: { icono: 'pets' } },
    ]);
    const propias = resultado.slice(CATALOGO_CATEGORIAS.length);
    expect(propias.map((c) => c.nombre)).toEqual(['Gimnasio', 'Mascotas']);
    expect(propias[0]).toMatchObject({ icono: 'sell', archivada: false, personalizada: true });
  });
});

describe('hayCategoriasAjustadas', () => {
  it('no con el catálogo tal cual', () => {
    expect(hayCategoriasAjustadas(CATALOGO_CATEGORIAS)).toBe(false);
  });

  it('sí con una renombrada, una oculta o una propia', () => {
    const conAjuste = (id: string, datos: object) =>
      combinarCategorias(CATALOGO_CATEGORIAS, [{ id, datos }]);
    expect(hayCategoriasAjustadas(conAjuste('cat-mercado', { nombre: 'Súper' }))).toBe(true);
    expect(hayCategoriasAjustadas(conAjuste('cat-salud', { archivada: true }))).toBe(true);
    expect(hayCategoriasAjustadas(conAjuste('x', { nombre: 'Gym', tipo: 'GASTO' }))).toBe(true);
  });
});

describe('categoriasParaElegir', () => {
  const categorias = combinarCategorias(CATALOGO_CATEGORIAS, [
    { id: 'cat-salud', datos: { archivada: true } },
  ]);

  it('deja fuera las ocultas y las del otro tipo', () => {
    const ids = categoriasParaElegir(categorias, 'GASTO').map((c) => c.id);
    expect(ids).not.toContain('cat-salud');
    expect(ids).not.toContain('cat-salario');
  });

  it('conserva la oculta que ya está elegida', () => {
    const ids = categoriasParaElegir(categorias, 'GASTO', 'cat-salud').map((c) => c.id);
    expect(ids).toContain('cat-salud');
  });
});
