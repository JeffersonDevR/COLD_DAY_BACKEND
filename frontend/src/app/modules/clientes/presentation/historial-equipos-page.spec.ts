import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HistorialEquiposPage } from './historial-equipos-page';
import { AuthService } from '../../../core/shared/infrastructure/auth/auth.service';

describe('HistorialEquiposPage', () => {
  async function create() {
    await TestBed.configureTestingModule({
      imports: [HistorialEquiposPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser: () => null } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(HistorialEquiposPage);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra el inventario de equipos', async () => {
    const fixture = await create();
    expect(fixture.componentInstance.equipos().length).toBe(3);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Historial de Equipos y Garantías');
    expect(text).toContain('LG Dual Inverter');
    expect(text).toContain('Garantía Vencida');
  });
});
