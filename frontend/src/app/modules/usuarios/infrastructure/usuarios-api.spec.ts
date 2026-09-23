import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { UsuariosApi } from './usuarios-api';
import { ApiConfig } from '../../../core/shared/infrastructure/api/api.config';
import { MockDbService } from '../../../core/shared/infrastructure/mock/mock-db.service';
import { UsuarioRequest } from '../../../core/shared/domain/models/common.models';

describe('UsuariosApi', () => {
  let api: UsuariosApi;
  let config: ApiConfig;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(UsuariosApi);
    config = TestBed.inject(ApiConfig);
    http = TestBed.inject(HttpTestingController);
    config.setUseMocks(false);
  });

  afterEach(() => http.verify());

  it('login hace POST /api/usuarios/login', async () => {
    const promise = firstValueFrom(api.login('a@x.co', 'secreta'));
    const req = http.expectOne('/api/usuarios/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ correo: 'a@x.co', password: 'secreta' });
    req.flush({ token: 't', expiracion: 'e', rol: 'CLIENTE' });
    expect(await promise).toEqual({ token: 't', expiracion: 'e', rol: 'CLIENTE' });
  });

  it('registro hace POST /api/usuarios y traduce la respuesta', async () => {
    const request: UsuarioRequest = {
      nombre: 'Ana',
      correo: 'a@x.co',
      password: 'p',
      rol: 'CLIENTE',
      aceptaHabeasData: true,
    };
    const promise = firstValueFrom(api.registro(request));
    const req = http.expectOne('/api/usuarios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ nombre: 'Ana', correo: 'a@x.co', aceptaHabeasData: true });
    req.flush({
      id: 1,
      nombre: 'Ana',
      correo: 'a@x.co',
      telefono: null,
      fotoUrl: null,
      rol: 'CLIENTE',
      fechaRegistro: '2026-01-01T00:00:00',
      habeasDataAceptado: true,
      activo: true,
    });
    const usuario = await promise;
    expect(usuario.id).toBe(1);
    expect(usuario.telefono).toBeUndefined();
  });

  it('solicitarRecuperacion sintetiza el mensaje', async () => {
    const promise = firstValueFrom(api.solicitarRecuperacion('a@x.co'));
    const req = http.expectOne('/api/usuarios/recuperar-contrasena');
    expect(req.request.method).toBe('POST');
    req.flush(null);
    expect((await promise).mensaje).toContain('instrucciones');
  });

  it('resetPassword envía nuevaPassword', async () => {
    const promise = firstValueFrom(api.resetPassword('tok', 'nueva'));
    const req = http.expectOne('/api/usuarios/reset-contrasena');
    expect(req.request.body).toEqual({ token: 'tok', nuevaPassword: 'nueva' });
    req.flush(null);
    expect((await promise).mensaje).toContain('actualizada');
  });

  it('login en modo mock devuelve el usuario existente', async () => {
    config.setUseMocks(true);
    const res = await firstValueFrom(api.login('maria.gomez@gmail.com', 'x'));
    expect(res.token).toContain('mock-jwt-token-3');
    expect(res.rol).toBe('CLIENTE');
  });

  it('login en modo mock rechaza credenciales desconocidas', async () => {
    config.setUseMocks(true);
    await expect(firstValueFrom(api.login('nadie@x.co', 'x'))).rejects.toThrow('Credenciales inválidas');
  });

  it('registro en modo mock agrega el usuario', async () => {
    config.setUseMocks(true);
    const mockDb = TestBed.inject(MockDbService);
    const antes = mockDb.usuarios().length;
    const usuario = await firstValueFrom(
      api.registro({ nombre: 'Nuevo', correo: 'nuevo@x.co', password: 'p', rol: 'CLIENTE', aceptaHabeasData: true }),
    );
    expect(usuario.correo).toBe('nuevo@x.co');
    expect(mockDb.usuarios().length).toBe(antes + 1);
  });

  it('recuperación y reset en modo mock responden mensajes', async () => {
    config.setUseMocks(true);
    const recuperacion = await firstValueFrom(api.solicitarRecuperacion('a@x.co'));
    expect(recuperacion.tokenSimulado).toContain('CD-RESET-');
    const reset = await firstValueFrom(api.resetPassword('tok', 'nueva'));
    expect(reset.mensaje).toContain('actualizada');
  });
});
