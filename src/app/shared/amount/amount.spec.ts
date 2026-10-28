import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Amount } from './amount';

describe('Amount', () => {
  async function montar(entradas: { valor: number; cargando?: boolean }) {
    await TestBed.configureTestingModule({
      imports: [Amount],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Amount);
    fixture.componentRef.setInput('valor', entradas.valor);
    if (entradas.cargando !== undefined)
      fixture.componentRef.setInput('cargando', entradas.cargando);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('se lee como texto corrido aunque el "$" vaya aparte', async () => {
    const elemento = await montar({ valor: -1250000 });
    expect(elemento.textContent?.trim()).toBe('-$1.250.000');
    expect(elemento.querySelector('.amount__moneda')?.textContent).toBe('$');
  });

  it('muestra un esqueleto en vez del monto mientras carga', async () => {
    const elemento = await montar({ valor: 0, cargando: true });
    expect(elemento.querySelector('.skeleton')).toBeTruthy();
    expect(elemento.textContent?.trim()).toBe('');
  });
});
