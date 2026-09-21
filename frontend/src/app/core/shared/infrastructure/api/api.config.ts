import { Injectable, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfig {
  private readonly _useMocks = signal<boolean>(environment.useMocks);
  readonly useMocks = this._useMocks.asReadonly();
  readonly useMock = this._useMocks.asReadonly();

  readonly baseUrl = environment.apiBaseUrl;

  setUseMocks(value: boolean): void {
    this._useMocks.set(value);
  }

  toggleMocks(): boolean {
    const next = !this._useMocks();
    this._useMocks.set(next);
    return next;
  }

  toggleMock(): boolean {
    return this.toggleMocks();
  }

  url(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }
}
