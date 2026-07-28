import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, Observer } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Observable<boolean>((observer: Observer<boolean>) => {
    let isResolved = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isResolved) {
        isResolved = true;
        unsubscribe();

        if (user) {
          console.log('AuthGuard: Usuario autenticado:', user.uid);
          observer.next(true);
          observer.complete();
        } else {
          console.warn('AuthGuard: Usuario no autenticado, verificando localStorage...');

          const savedUser = localStorage.getItem('user_htas');
          if (savedUser) {
            try {
              const userData = JSON.parse(savedUser);
              if (userData && userData.uid) {
                console.log('AuthGuard: Usuario encontrado en localStorage, permitiendo acceso');
                observer.next(true);
                observer.complete();
                return;
              }
            } catch (e) {
              console.warn('AuthGuard: Error al parsear localStorage');
            }
          }

          console.warn('AuthGuard: Redirigiendo a login');
          router.navigate(['/login']);
          observer.next(false);
          observer.complete();
        }
      }
    }, (error) => {
      if (!isResolved) {
        isResolved = true;
        unsubscribe();
        console.error('Error en AuthGuard:', error);
        router.navigate(['/login']);
        observer.next(false);
        observer.complete();
      }
    });
  });
};