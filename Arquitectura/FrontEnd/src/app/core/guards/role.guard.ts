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

                const savedUser = localStorage.getItem('user_htas');
                if (savedUser) {
                    try {
                        const userData = JSON.parse(savedUser);
                        userRole = userData.rol?.toLowerCase() || '';
                        userId = userData.idusuario || userData.id || null;
                    } catch (error) {
                        // Error al parsear localStorage
                    }
                }

                if (!userRole && user) {
                    try {
                        const usuarioData = await firstValueFrom(
                            usersService.getPerfilUsuario(user.uid)
                        );

                        if (usuarioData) {
                            userRole = usuarioData.rol?.toLowerCase() || '';
                            userId = usuarioData.idusuario || usuarioData.id || null;

                            const updatedUser = {
                                idusuario: userId,
                                nombre: usuarioData.nombre || '',
                                correo: usuarioData.correo || '',
                                rol: userRole,
                                uid: user.uid
                            };
                            localStorage.setItem('user_htas', JSON.stringify(updatedUser));
                        }
                    } catch (error) {
                        // Error al obtener perfil del backend
                    }
                }

                if (!userRole) {
                    const savedUserAgain = localStorage.getItem('user_htas');
                    if (savedUserAgain) {
                        try {
                            const userData = JSON.parse(savedUserAgain);
                            userRole = userData.rol?.toLowerCase() || '';
                        } catch (error) {
                            // Error al parsear localStorage
                        }
                    }
                }

                if (userRole && expectedRoles.includes(userRole)) {
                    observer.next(true);
                    observer.complete();
                } else if (userRole) {
                    redirectBasedOnRole(userRole, router);
                    observer.next(false);
                    observer.complete();
                } else {
                    if (user) {
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
    router.navigate([route]);
}