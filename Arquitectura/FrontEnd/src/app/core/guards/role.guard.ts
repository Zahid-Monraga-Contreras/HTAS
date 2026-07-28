import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, Observer } from 'rxjs';

export const roleGuard: CanActivateFn = (route, state) => {
    const auth = inject(Auth);
    const firestore = inject(Firestore);
    const router = inject(Router);

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

                if (!user) {
                    console.warn('RoleGuard: Usuario no autenticado, verificando localStorage...');

                    const savedUser = localStorage.getItem('user_htas');
                    if (savedUser) {
                        try {
                            const userData = JSON.parse(savedUser);
                            if (userData && userData.rol) {
                                const userRole = userData.rol.toLowerCase();
                                console.log('RoleGuard: Usuario encontrado en localStorage con rol:', userRole);

                                if (expectedRoles.includes(userRole)) {
                                    console.log('RoleGuard: Acceso permitido');
                                    observer.next(true);
                                    observer.complete();
                                    return;
                                } else {
                                    console.log('RoleGuard: Rol no autorizado:', userRole);
                                    redirectBasedOnRole(userRole, router);
                                    observer.next(false);
                                    observer.complete();
                                    return;
                                }
                            }
                        } catch (error) {
                            console.warn('RoleGuard: Error al parsear localStorage:', error);
                        }
                    }

                    console.warn('RoleGuard: Redirigiendo a login');
                    router.navigate(['/login']);
                    observer.next(false);
                    observer.complete();
                    return;
                }

                try {
                    let userRole = '';
                    let encontrado = false;

                    try {
                        console.log('RoleGuard: Buscando en Firestore...');
                        const userDoc = doc(firestore, `users/${user.uid}`);
                        const docSnap = await getDoc(userDoc);
                        if (docSnap.exists()) {
                            const userData = docSnap.data();
                            userRole = userData['rol']?.toLowerCase() || '';
                            encontrado = true;
                            console.log('RoleGuard: Firestore - rol:', userRole);
                        }
                    } catch (error) {
                        console.warn('RoleGuard: Error en Firestore:', error);
                    }

                    if (!encontrado) {
                        try {
                            const savedUser = localStorage.getItem('user_htas');
                            if (savedUser) {
                                const parsedUser = JSON.parse(savedUser);
                                if (parsedUser && parsedUser.rol) {
                                    userRole = parsedUser.rol?.toLowerCase() || '';
                                    encontrado = true;
                                    console.log('RoleGuard: localStorage - rol:', userRole);
                                }
                            }
                        } catch (error) {
                            console.warn('RoleGuard: Error en localStorage:', error);
                        }
                    }

                    if (encontrado && userRole) {
                        if (expectedRoles.includes(userRole)) {
                            console.log('RoleGuard: Acceso permitido');
                            observer.next(true);
                            observer.complete();
                        } else {
                            console.log('RoleGuard: Rol no autorizado:', userRole);
                            redirectBasedOnRole(userRole, router);
                            observer.next(false);
                            observer.complete();
                        }
                    } else {
                        console.error('RoleGuard: No se pudo determinar el rol');
                        router.navigate(['/login']);
                        observer.next(false);
                        observer.complete();
                    }
                } catch (error) {
                    console.error('RoleGuard Error:', error);
                    router.navigate(['/login']);
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
        'paciente': '/patient',
        'doctor': '/doctor',
        'acompanante': '/caregiver',
        'acompañante': '/caregiver'
    };
    const route = roleMap[role] || '/landing';
    console.log('RoleGuard redirigiendo a:', route);
    router.navigate([route]);
}