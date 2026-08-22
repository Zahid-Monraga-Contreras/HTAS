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
          observer.next(true);
          observer.complete();
        } else {
          const savedUser = localStorage.getItem('user_htas');
          if (savedUser) {
            try {
              const userData = JSON.parse(savedUser);
              if (userData && (userData.uid || userData.idusuario)) {
                observer.next(true);
                observer.complete();
                return;
              }
            } catch (e) {
              // Error al parsear localStorage
            }
          }

          router.navigate(['/login']);
          observer.next(false);
          observer.complete();
        }
      }
    }, (error) => {
      if (!isResolved) {
        isResolved = true;
        unsubscribe();
        router.navigate(['/login']);
        observer.next(false);
        observer.complete();
      }
    });
  });
};