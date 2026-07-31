import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Intentar obtener el token de diferentes lugares donde podría estar guardado
    const token = localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');

    console.log('Interceptor - Token encontrado:', token ? 'Sí' : 'No');

    // Si hay token, clonar la petición y agregar el header Authorization
    if (token) {
        const clonedRequest = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`)
        });
        return next(clonedRequest);
    }

    // Si no hay token, enviar la petición sin modificar
    console.warn('Interceptor - No se encontró token');
    return next(req);
};