import { TestBed } from '@angular/core/testing';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from './token-storage.service';

async function run(url: string, token: string | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TokenStorageService, useValue: { getRawToken: () => token } }],
  });
  const req = new HttpRequest('GET', url);
  const captured: { req: HttpRequest<unknown> | null } = { req: null };
  const next: HttpHandlerFn = (r) => {
    captured.req = r;
    return of(new HttpResponse({ status: 200 }));
  };
  await TestBed.runInInjectionContext(() => firstValueFrom(authInterceptor(req, next)));
  return captured.req;
}

describe('authInterceptor', () => {
  it('agrega el header Bearer en rutas /api', async () => {
    const req = await run('https://host.test/api/ot', 'tok-123');
    expect(req?.headers.get('Authorization')).toBe('Bearer tok-123');
  });

  it('no agrega header fuera de /api', async () => {
    const req = await run('https://host.test/public/health', 'tok-123');
    expect(req?.headers.has('Authorization')).toBe(false);
  });

  it('no agrega header si no hay token', async () => {
    const req = await run('https://host.test/api/ot', null);
    expect(req?.headers.has('Authorization')).toBe(false);
  });
});
