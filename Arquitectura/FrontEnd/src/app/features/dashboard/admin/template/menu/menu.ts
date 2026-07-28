import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription, Observable, combineLatest, of } from 'rxjs';
import { startWith, filter } from 'rxjs/operators';
import { GoogleService } from '../../../../../core/services/google.service';
import { Users } from '../../../../../core/services/users.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css',
})
export class Menu implements OnInit, OnDestroy {
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private authSub?: Subscription;
  private routerSub?: Subscription;

  isCollapsed = false;
  showSearch = false;
  currentRoute: string = '';

  public user$: Observable<any> = this.googleService.user$;
  userName: string = 'Usuario';
  userPhoto: string = '';
  userRol: string = '';
  searchTerm: string = '';

  // ESTRUCTURA CON RUTAS /admin/ Y PERMISOS POR DEFECTO PARA ADMIN
  private allNavItems = [
    {
      category: 'General',
      items: [
        {
          route: '/admin/inicio',
          icon: 'bi bi-house-heart',
          label: 'Inicio',
          queryParams: { canAdd: false, canEdit: false, canDelete: false }
        }
      ]
    },
    {
      category: 'Administración',
      items: [
        {
          route: '/admin/usuarios',
          icon: 'bi-people',
          label: 'Usuarios',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/medicos',
          icon: 'bi-person-badge',
          label: 'Medicos',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/pacientes',
          icon: 'bi-person-heart',
          label: 'Pacientes',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/acompanantes',
          icon: 'bi-person-fill-add',
          label: 'Acompanantes',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        }
      ]
    },
    {
      category: 'Seguimiento',
      items: [
        {
          route: '/admin/citas',
          icon: 'bi-calendar-check',
          label: 'Citas',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/tratamientos',
          icon: 'bi-clipboard-data',
          label: 'Tratamientos',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/medicamentos',
          icon: 'bi-capsule',
          label: 'Medicamentos',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
        {
          route: '/admin/dispositivos',
          icon: 'bi-heart-pulse',
          label: 'Dispositivos',
          queryParams: { canAdd: true, canEdit: true, canDelete: true }
        },
      ]
    },
    {
      category: 'Cuenta',
      items: [
        {
          route: '/admin/configuracion',
          icon: 'bi-gear',
          label: 'Configuracion',
          queryParams: { canAdd: false, canEdit: true, canDelete: false }
        }
      ]
    }
  ];

  menuFiltrado: any[] = [];

  ngOnInit() {
    const uService = this.usersService as any;
    const isBrowser = typeof window !== 'undefined';

    this.currentRoute = this.router.url;

    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects || event.url;
      this.cdr.detectChanges();
    });

    if (isBrowser && uService.cargarSesionPersistente) {
      uService.cargarSesionPersistente();
    }

    this.authSub = combineLatest([
      this.googleService.user$.pipe(startWith(null)),
      (uService.currentUser$ || of(null)).pipe(startWith(null))
    ]).subscribe((res: any[]) => {
      const gUser = res[0];
      let pUser = res[1];

      if (!pUser && isBrowser) {
        const saved = localStorage.getItem('user_htas');
        pUser = saved ? JSON.parse(saved) : null;
      }

      if (pUser) {
        this.userName = pUser.nombre || pUser.NombreCompleto || 'Usuario';
        this.userPhoto = pUser.photoURL || pUser.foto || this.generarAvatar(this.userName);
        this.userRol = pUser.rol || '';

        if (!uService.currentUserSubject.value) {
          uService.currentUserSubject.next(pUser);
        }
      }
      else if (gUser) {
        this.userName = gUser.nombre || gUser.displayName || 'Usuario';
        this.userPhoto = gUser.photoURL || this.generarAvatar(this.userName);
        this.userRol = 'Paciente';
      }
      else {
        this.userName = 'Invitado';
        this.userPhoto = this.generarAvatar('Invitado');
        this.userRol = 'Invitado';
      }

      this.generarMenuPorRol();

      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    });
  }

  private generarMenuPorRol() {
    const mapeoOriginal = JSON.parse(JSON.stringify(this.allNavItems));
    const rol = this.userRol.toLowerCase();

    this.menuFiltrado = mapeoOriginal.filter((section: any) => {

      // REGLAS PARA ROL: INVITADO
      if (rol === 'invitado') {
        if (section.category === 'Administración') return false;
        if (section.category === 'Seguimiento') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
          });
        }
        if (section.category === 'Cuenta') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
          });
        }
      }

      // REGLAS PARA ROL: PACIENTE
      if (rol === 'paciente') {
        if (section.category === 'Administración') {
          section.items = section.items.filter((i: any) => i.route === '/admin/usuarios');
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
          });
        }
        if (section.category === 'Seguimiento') {
          section.items.forEach((item: any) => {
            if (item.route === '/admin/citas') {
              item.queryParams = { canAdd: true, canEdit: false, canDelete: false };
            }
            if (item.route === '/admin/tratamientos' || item.route === '/admin/medicamentos') {
              item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
            }
            if (item.route === '/admin/dispositivos') {
              item.queryParams = { canAdd: true, canEdit: false, canDelete: false };
            }
          });
        }
        if (section.category === 'Cuenta') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: true, canDelete: false };
          });
        }
      }

      // REGLAS PARA ROL: ACOMPAÑANTE
      if (rol === 'acompañante' || rol === 'acompanante') {
        if (section.category === 'Administración') {
          section.items = section.items.filter((i: any) => i.route === '/admin/usuarios');
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
          });
        }
        if (section.category === 'Seguimiento') {
          section.items.forEach((item: any) => {
            if (item.route === '/admin/citas') {
              item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
            }
            if (item.route === '/admin/tratamientos' || item.route === '/admin/medicamentos') {
              item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
            }
            if (item.route === '/admin/dispositivos') {
              item.queryParams = { canAdd: false, canEdit: true, canDelete: false };
            }
          });
        }
        if (section.category === 'Cuenta') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: true, canDelete: false };
          });
        }
      }

      // REGLAS PARA ROL: MÉDICO / DOCTOR
      if (rol === 'doctor' || rol === 'medico') {
        if (section.category === 'Administración') {
          section.items = section.items.filter((i: any) => i.route !== '/admin/medicos');
          section.items.forEach((item: any) => {
            if (item.route === '/admin/pacientes' || item.route === '/admin/acompanantes') {
              item.queryParams = { canAdd: true, canEdit: true, canDelete: true };
            }
            if (item.route === '/admin/usuarios') {
              item.queryParams = { canAdd: false, canEdit: false, canDelete: false };
            }
          });
        }
        if (section.category === 'Seguimiento') {
          section.items.forEach((item: any) => {
            if (item.route === '/admin/tratamientos' || item.route === '/admin/medicamentos' || item.route === '/admin/dispositivos') {
              item.queryParams = { canAdd: true, canEdit: true, canDelete: true };
            }
            if (item.route === '/admin/citas') {
              item.queryParams = { canAdd: true, canEdit: true, canDelete: true };
            }
          });
        }
        if (section.category === 'Cuenta') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: true, canDelete: false };
          });
        }
      }

      // REGLAS PARA ROL: ADMIN (todos los permisos)
      if (rol === 'admin' || rol === 'administrador') {
        // Mantener todos los permisos por defecto (ya están en allNavItems)
        // Solo aseguramos que Cuenta tenga editar
        if (section.category === 'Cuenta') {
          section.items.forEach((item: any) => {
            item.queryParams = { canAdd: false, canEdit: true, canDelete: false };
          });
        }
      }

      return section.items.length > 0;
    });
  }

  isActive(route: string): boolean {
    if (!this.currentRoute) return false;

    if (route === '/admin/inicio') {
      return this.currentRoute === '/admin/inicio' || this.currentRoute === '/admin' || this.currentRoute === '/admin/';
    }

    return this.currentRoute.startsWith(route);
  }

  private generarAvatar(nombre: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=b0001e&color=fff&bold=true`;
  }

  public generarAvatarFallback(nombre: string): string {
    return this.generarAvatar(nombre);
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleSearch() {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) this.searchTerm = '';
  }

  onSearch(value: string) {
    this.searchTerm = value;
    const query = value.toLowerCase().trim();

    if (!query) return;

    for (const section of this.menuFiltrado) {
      const matchItem = section.items.find((item: any) =>
        item.label.toLowerCase().includes(query)
      );

      if (matchItem) {
        this.router.navigate([matchItem.route], { queryParams: matchItem.queryParams });
        this.searchTerm = '';
        this.showSearch = false;
        break;
      }
    }
  }

  logout() {
    this.googleService.logout();
    const service = this.usersService as any;
    if (service.limpiarSesion) service.limpiarSesion();
    this.router.navigate(['/login']);
  }
}