import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Nosotros } from './pages/nosotros/nosotros';
import { Recursos } from './pages/recursos/recursos';
import { Contacto } from './pages/contacto/contacto';
import { Pagos } from './pages/pagos/pagos';
import { Success } from './pages/success/success';
import { Error404 } from './pages/error-404/error-404';

export const LANDING_ROUTES: Routes = [
    // Ruta principal del landing
    {
        path: '',
        component: Landing,
        title: 'HTAS - Inicio'
    },
    // Páginas estáticas
    {
        path: 'nosotros',
        component: Nosotros,
        title: 'HTAS - Sobre Nosotros'
    },
    {
        path: 'recursos',
        component: Recursos,
        title: 'HTAS - Recursos'
    },
    {
        path: 'contactos',
        component: Contacto,
        title: 'HTAS - Contacto'
    },
    {
        path: 'pagos',
        component: Pagos,
        title: 'HTAS - Pagos'
    },
    {
        path: 'success',
        component: Success,
        title: 'HTAS - Éxito'
    },
    // Ruta 404 dentro del landing (opcional)
    {
        path: '404',
        component: Error404,
        title: 'HTAS - Página no encontrada'
    }
];