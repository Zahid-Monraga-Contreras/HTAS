import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Register } from './register/register';
import { AvisoPrivacidad } from './legal/aviso-privacidad/aviso-privacidad';
import { TerminosCondiciones } from './legal/terminos-condiciones/terminos-condiciones';

export const AUTH_ROUTES: Routes = [
    // Ruta principal de auth (redirección)
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Rutas de autenticación
    { path: 'login', component: Login, title: 'HTAS - Iniciar Sesión' },
    { path: 'register', component: Register, title: 'HTAS - Registrarse' },

    // Rutas legales dentro de auth
    { path: 'aviso-privacidad', component: AvisoPrivacidad, title: 'HTAS - Aviso de Privacidad' },
    { path: 'terminos-condiciones', component: TerminosCondiciones, title: 'HTAS - Términos y Condiciones' },
];