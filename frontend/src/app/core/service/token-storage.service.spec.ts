import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

const TOKEN_KEY = 'coldday.token';

function jwtWith(payload: Record<string, unknown>): string {
  return `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.signature`;
}

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  it('arranca sin token', () => {
    expect(service.currentToken()).toBeNull();
    expect(service.getRawToken()).toBeNull();
    expect(service.getDecodedToken()).toBeNull();
  });

  it('guarda y lee el token de localStorage', () => {
    service.saveToken('a.b.c');
    expect(service.currentToken()).toBe('a.b.c');
    expect(service.getRawToken()).toBe('a.b.c');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('a.b.c');
  });

  it('limpia el token', () => {
    service.saveToken('a.b.c');
    service.clearToken();
    expect(service.currentToken()).toBeNull();
    expect(service.getRawToken()).toBeNull();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('decodifica el payload de un JWT estándar', () => {
    service.saveToken(jwtWith({ sub: '7', rol: 'TECNICO', exp: 9999999999 }));
    const decoded = service.getDecodedToken();
    expect(decoded?.sub).toBe('7');
    expect(decoded?.rol).toBe('TECNICO');
    expect(decoded?.exp).toBe(9999999999);
  });

  it('decodifica el formato simulado (base64 simple)', () => {
    service.saveToken(btoa(JSON.stringify({ rol: 'CLIENTE', nombre: 'Ana' })));
    const decoded = service.getDecodedToken();
    expect(decoded?.rol).toBe('CLIENTE');
    expect(decoded?.nombre).toBe('Ana');
  });

  it('devuelve null si el token es inválido', () => {
    service.saveToken('no-es-un-token');
    expect(service.getDecodedToken()).toBeNull();
  });

  it('createMockJwt genera un token decodificable', () => {
    const token = service.createMockJwt({ id: 3, nombre: 'Ana', correo: 'ana@coldday.co', rol: 'CLIENTE' });
    service.saveToken(token);
    const decoded = service.getDecodedToken();
    expect(decoded?.id).toBe(3);
    expect(decoded?.rol).toBe('CLIENTE');
    expect(decoded?.nombre).toBe('Ana');
    expect(decoded?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
