import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, Observer } from 'rxjs';
import { Users } from '../services/users.service';
import { firstValueFrom } from 'rxjs';

export const roleGuard: CanActivateFn = (route, state) => {
    const auth = inject(Auth);
    const router = inject(Router);
    const usersService = inject(Users);

    const expectedRoles = route.data['roles'] as string[];

    if (!expectedRoles || expectedRoles.length === 0) {
        return new Observable<boolean>((observer) => {
            observer.next(true);
            observer.complete();
        });
    }

    return new Observable<boolean>((observer: Observer<boolean>) => {
        let isResolved = false;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!isResolved) {
                isResolved = true;
                unsubscribe();

                let userRole = '';
                let userId = null;

                // 1. Intentar obtener de localStorage primero
                const savedUser = localStorage.getItem('user_htas');
                if (savedUser) {
                    try {
                        const userData = JSON.parse(savedUser);
                        userRole = userData.rol?.toLowerCase() || '';
                        userId = userData.idusuario || userData.id || null;
                        console.log('RoleGuard: Datos de localStorage:', { userRole, userId });
                    } catch (error) {
                        console.warn('RoleGuard: Error al parsear localStorage:', error);
                    }
                }

                // 2. Si no hay rol en localStorage, obtener del backend
                if (!userRole && user) {
                    try {
                        console.log('RoleGuard: Consultando backend para obtener perfil...');
                        const usuarioData = await firstValueFrom(
                            usersService.getPerfilUsuario(user.uid)
                        );

                        if (usuarioData) {
                            userRole = usuarioData.rol?.toLowerCase() || '';
                            userId = usuarioData.idusuario || usuarioData.id || null;

                            // Guardar en localStorage para futuras veces
                            const updatedUser = {
                                idusuario: userId,
                                nombre: usuarioData.nombre || '',
                                correo: usuarioData.correo || '',
                                rol: userRole,
                                uid: user.uid
                            };
                            localStorage.setItem('user_htas', JSON.stringify(updatedUser));
                            console.log('RoleGuard: Datos actualizados en localStorage:', updatedUser);
                        }
                    } catch (error) {
                        console.warn('RoleGuard: Error al obtener perfil del backend:', error);
                    }
                }

                // 3. Si aún no hay rol, verificar en localStorage nuevamente (por si se actualizó)
                if (!userRole) {
                    const savedUserAgain = localStorage.getItem('user_htas');
                    if (savedUserAgain) {
                        try {
                            const userData = JSON.parse(savedUserAgain);
                            userRole = userData.rol?.toLowerCase() || '';
                            console.log('RoleGuard: Rol desde localStorage (segunda lectura):', userRole);
                        } catch (error) {
                            console.warn('RoleGuard: Error al parsear localStorage:', error);
                        }
                    }
                }

                console.log('RoleGuard: Rol final:', userRole);

                // 4. Verificar acceso según rol
                if (userRole && expectedRoles.includes(userRole)) {
                    console.log('RoleGuard: Acceso permitido para rol:', userRole);
                    observer.next(true);
                    observer.complete();
                } else if (userRole) {
                    console.log('RoleGuard: Rol no autorizado:', userRole);
                    redirectBasedOnRole(userRole, router);
                    observer.next(false);
                    observer.complete();
                } else {
                    console.error('RoleGuard: No se pudo determinar el rol');

                    // Verificar si hay usuario autenticado pero sin rol
                    if (user) {
                        console.log('RoleGuard: Usuario autenticado pero sin rol, redirigiendo a landing');
                        router.navigate(['/landing']);
                    } else {
                        router.navigate(['/login']);
                    }
                    observer.next(false);
                    observer.complete();
                }
            }
        });
    });
};

function redirectBasedOnRole(role: string, router: Router): void {
    const roleMap: { [key: string]: string } = {
        'admin': '/admin',
        'administrador': '/admin',
        'paciente': '/patient',
        'patient': '/patient',
        'doctor': '/doctor',
        'medico': '/doctor',
        'acompanante': '/caregiver',
        'acompañante': '/caregiver',
        'caregiver': '/caregiver'
    };
    const route = roleMap[role] || '/landing';
    console.log('RoleGuard redirigiendo a:', route);
    router.navigate([route]);
}