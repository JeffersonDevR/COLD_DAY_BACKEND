import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SolicitudesPerfilApi } from './solicitudes-perfil-api';

describe('SolicitudesPerfilApi', () => {
  let api: SolicitudesPerfilApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SolicitudesPerfilApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('solicitar hace POST al endpoint con el body del contrato', async () => {
    const body = { perfilDeseado: 'TECNICO' as const, motivacion: 'Trabajo en refrigeración' };
    const promise = firstValueFrom(api.solicitar(body));

    const req = http.expectOne('/api/solicitudes-perfil');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ perfilDeseado: 'TECNICO', motivacion: 'Trabajo en refrigeración' });
    expect(req.request.body).not.toHaveProperty('perfil_deseado');
    req.flush(null);
    await promise;
  });

  it('propaga el 409 para que la pantalla muestre el mensaje de duplicado', async () => {
    const promise = firstValueFrom(
      api.solicitar({ perfilDeseado: 'CLIENTE', motivacion: 'Quiero pedir servicios' }),
    );
    const req = http.expectOne('/api/solicitudes-perfil');
    req.flush({ message: 'Ya existe' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toMatchObject({ status: 409 });
  });

  it('propaga el 422 de perfil igual al rol inicial', async () => {
    const promise = firstValueFrom(
      api.solicitar({ perfilDeseado: 'CLIENTE', motivacion: 'Ya soy cliente' }),
    );
    const req = http.expectOne('/api/solicitudes-perfil');
    req.flush({ message: 'El perfil ya es el inicial' }, { status: 422, statusText: 'Unprocessable' });

    await expect(promise).rejects.toMatchObject({ status: 422 });
  });
});
