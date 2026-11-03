import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';
import { resolverPanel } from './panel-resolver';

@Component({
  selector: 'app-panel-redirect',
  template: `
    <div class="min-h-[40vh] flex items-center justify-center">
      <div class="text-center space-y-2">
        <div class="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs text-slate-500">Cargando tu panel de control...</p>
      </div>
    </div>
  `
})
export class PanelRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // Un único resolutor: último panel visitado → rol primario → primer rol
    // enrutable. `/panel` nunca decide por su cuenta.
    this.router.navigate([resolverPanel(user.rol, this.auth.userRoles())]);
  }
}
