import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login.page';

/** Doble de `AuthService` (sin Supabase real), con espías en las acciones. */
function crearAuthFalso() {
  return {
    iniciandoCon: signal<'correo' | 'google' | null>(null),
    iniciandoSesion: signal(false),
    error: signal<string | null>(null),
    errorGoogle: signal<string | null>(null),
    errorRegistro: signal<string | null>(null),
    entrarConGoogle: vi.fn(async () => {}),
    iniciarSesion: vi.fn(async () => {}),
  };
}

describe('LoginPage', () => {
  async function montar() {
    const auth = crearAuthFalso();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    return { fixture, auth, elemento: fixture.nativeElement as HTMLElement };
  }

  function boton(elemento: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from(elemento.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!encontrado) throw new Error(`No hay botón "${texto}"`);
    return encontrado;
  }

  it('entra con Google desde el botón principal', async () => {
    const { auth, elemento } = await montar();
    boton(elemento, 'Continuar con Google').click();
    expect(auth.entrarConGoogle).toHaveBeenCalled();
  });

  it('entra con correo y contraseña desde el formulario', async () => {
    const { fixture, auth, elemento } = await montar();
    const correo = elemento.querySelector<HTMLInputElement>('#l-email')!;
    const clave = elemento.querySelector<HTMLInputElement>('#l-password')!;

    correo.value = 'ana@ejemplo.com';
    correo.dispatchEvent(new Event('input'));
    clave.value = 'secreta';
    clave.dispatchEvent(new Event('input'));
    boton(elemento, 'Entrar').click();
    await fixture.whenStable();

    expect(auth.iniciarSesion).toHaveBeenCalledWith('ana@ejemplo.com', 'secreta');
  });

  it('muestra el error de Google junto al botón de Google', async () => {
    const { fixture, auth, elemento } = await montar();
    auth.errorGoogle.set('No hay conexión. Revisa tu internet e intenta de nuevo.');
    await fixture.whenStable();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain('No hay conexión');
  });
});
