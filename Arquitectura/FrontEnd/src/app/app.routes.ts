import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing/landing';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Nosotros } from './features/landing/pages/nosotros/nosotros';
import { Recursos } from './features/landing/pages/recursos/recursos';
import { Contacto } from './features/landing/pages/contacto/contacto';
import { Pagos } from './features/landing/pages/pagos/pagos';
import { Error404 } from './features/landing/pages/error-404/error-404';
import { Success } from './features/landing/pages/success/success';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/landing'
  },
  {
    path: 'landing',
    component: Landing,
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'register',
    component: Register,
  },
  {
    path: 'nosotros',
    component: Nosotros,
  },
  {
    path: 'recursos',
    component: Recursos,
  },
  {
    path: 'contactos',
    component: Contacto,
  },
  {
    path: 'success',
    component: Success,
  },
  {
    path: 'pagos',
    component: Pagos,
  },

  // ==========================================
  // RUTAS CON LAZY LOADING PARA CADA ROL
  // ==========================================

  {
    path: 'admin',
    loadChildren: () => import('./features/dashboard/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  {
    path: 'patient',
    loadChildren: () => import('./features/dashboard/patient/patient.routes').then(m => m.PATIENT_ROUTES)
  },
  /*
  {
    path: 'doctor',
    loadChildren: () => import('./features/dashboard/doctor/doctor.routes').then(m => m.DOCTOR_ROUTES)
  },
  {
    path: 'caregiver',
    loadChildren: () => import('./features/dashboard/caregiver/caregiver.routes').then(m => m.CAREGIVER_ROUTES)
  },*/

  {
    path: '**',
    component: Error404
  }
];