import { libreDelMes } from './libre-del-mes';

describe('libreDelMes', () => {
  it('resta lo que falta por pagar del disponible', () => {
    expect(libreDelMes(1_500_000, 600_000)).toBe(900_000);
  });

  it('puede quedar negativo si falta más de lo disponible', () => {
    expect(libreDelMes(200_000, 600_000)).toBe(-400_000);
  });

  it('es igual al disponible si no falta nada por pagar', () => {
    expect(libreDelMes(1_000_000, 0)).toBe(1_000_000);
  });
});
