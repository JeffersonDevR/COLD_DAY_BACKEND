import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly _isDark = signal<boolean>(false);
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('coldday.theme');
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      const isDark = saved ? saved === 'dark' : prefersDark;
      this.setTheme(isDark);
    }
  }

  toggleTheme(): void {
    this.setTheme(!this._isDark());
  }

  setTheme(isDark: boolean): void {
    this._isDark.set(isDark);
    if (typeof window !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        window.localStorage.setItem('coldday.theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        window.localStorage.setItem('coldday.theme', 'light');
      }
    }
  }
}
