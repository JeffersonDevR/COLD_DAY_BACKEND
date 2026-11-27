import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/service/auth.service';
import { TokenStorageService } from './core/service/token-storage.service';

/** Navega con la tabla de rutas real y espera a terminar en `destino`. */
async function abrir(url: string, rol: 'CLIENTE' | null, destino: string): Promise<void> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideLocationMocks(),
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: () => rol !== null,
          getDashboardRouteForRole: () => '/usa-la-app',
        },
      },
      { provide: TokenStorageService, useValue: { getDecodedToken: () => (rol ? { rol } : null) } },
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const location = TestBed.inject(Location);
  await vi.waitFor(() => expect(location.path()).toBe(destino));
}

describe('rutas de la web', () => {
  it('la web solo expone acceso y administración', () => {
    expect(routes.map((r) => r.path)).toEqual([
      '', 'login', 'recuperar', 'panel', 'usa-la-app',
      'admin/dashboard', 'admin/validacion-tecnicos', 'admin/consignaciones',
      'admin/disputas', 'admin/monitoreo', 'admin/ot/:id', 'admin/proveedores', '**',
    ]);
  });

  it('un marcador a una pantalla retirada sin sesión llega al login', async () => {
    await abrir('/cliente/panel', null, '/login');
  });

  it('un marcador a una pantalla retirada con sesión de cliente llega a la pantalla de la app', async () => {
    await abrir('/cliente/panel', 'CLIENTE', '/usa-la-app');
  });
});
