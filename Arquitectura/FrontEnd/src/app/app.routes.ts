import { Routes } from '@angular/router';

export const routes: Routes = [
  // ==========================================
  // REDIRECCIÓN PRINCIPAL
  // ==========================================
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/landing'
  },

  // ==========================================
  // LANDING Y PÁGINAS PÚBLICAS
  // ==========================================
  {
    path: 'landing',
    loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES)
  },

  // ==========================================
  // RUTAS DE AUTENTICACIÓN
  // ==========================================
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // ==========================================
  // DASHBOARD
  // ==========================================
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },

  // ==========================================
  // RUTA 404 GLOBAL
  // ==========================================
  {
    path: '**',
    redirectTo: '/landing/404' // Redirige al 404 del landing
    // O si prefieres un componente 404 independiente:
    // component: Error404,
    // title: 'HTAS - Página no encontrada'
  }
];