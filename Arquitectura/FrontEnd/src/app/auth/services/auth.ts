import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.baseUrl}/api/auth`;
  private currentUser = new BehaviorSubject<any>(null);
  private authToken: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.authToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        this.currentUser.next(JSON.parse(savedUser));
      }
    }
  }

  login(Correo: string, Contrasenia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { Correo, Contrasenia }).pipe(
      tap((response: any) => {
        if (response.token) {
          this.authToken = response.token;
          this.currentUser.next(response.user);

          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          this.setUserRole(response.user.Rol || 'Paciente');
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${environment.baseUrl}/api/usersroles`, userData);
  }

  logout(): void {
    this.authToken = null;
    this.currentUser.next(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.authToken;
  }

  isLoggedIn(): boolean {
    return this.authToken !== null;
  }

  getUser(): any {
    return this.currentUser.value;
  }

  getUserRole(): string {
    const user = this.getUser();
    return user?.Rol ? user.Rol.toLowerCase() : 'paciente';
  }

  private setUserRole(role: string): void {
    const user = this.getUser();
    if (user) {
      user.Rol = role;
      this.currentUser.next(user);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
  }
}