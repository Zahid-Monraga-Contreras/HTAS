import { Component, inject, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Menu } from "../menu/menu";
import { GoogleService } from '../../../auth/services/google';
import { Users } from '../../../auth/services/users';
import { Firestore, doc, getDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Observable, Subscription, combineLatest, of } from 'rxjs';
import { startWith } from 'rxjs/operators';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, Menu],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit, OnDestroy {
  private googleService = inject(GoogleService);
  private usersService = inject(Users);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  private authSub?: Subscription;

  user$: Observable<any> = this.googleService.user$;

  userName: string = 'Cargando...';
  userEmail: string = '';
  userPhoto: string = '';
  userPhone: string = 'No registrado';
  userRole: string = 'Usuario';
  isActive: boolean = true;
  createdAt: string = 'Reciente';

  ngOnInit() {
    const uService = this.usersService as any;
    // 1. Detectamos si estamos en el navegador
    const isBrowser = typeof window !== 'undefined';

    this.authSub = combineLatest([
      this.googleService.user$.pipe(startWith(null)),
      (uService.currentUser$ || of(null)).pipe(startWith(null))
    ]).subscribe(async (res: any[]) => {
      const gUser = res[0];

      // 2. PROTECCIÓN SSR: Solo leemos localStorage si existe el objeto window
      let pUser = res[1];
      if (!pUser && isBrowser) {
        const saved = localStorage.getItem('user_htas');
        pUser = saved ? JSON.parse(saved) : null;
      }

      // 1. PRIORIDAD MÁXIMA: BACKEND (Postgres)
      if (pUser) {
        this.fillData(pUser);
        console.log('Perfil cargado desde Backend');
      }
      // 2. SEGUNDA PRIORIDAD: FIREBASE
      else if (gUser) {
        await this.fetchFromFirebase(gUser);
        console.log('Perfil cargado desde Firebase/Google');
      } else {
        this.userName = 'Invitado';
      }

      // 3. SOLUCIÓN AL ERROR NG0100
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 0);
    });
  }

  private fillData(data: any) {
    // Mapeo flexible para evitar problemas de mayúsculas/minúsculas
    const nombre = data.nombre || data.Nombre || '';
    const paterno = data.apPaterno || data.appaterno || data.ApPaterno || '';
    const materno = data.apMaterno || data.apmaterno || data.ApMaterno || '';

    this.userName = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
    this.userEmail = data.correo || data.Correo || data.email || 'No disponible';
    this.userPhone = data.telefono || data.Telefono || 'Sin registrar';
    this.userRole = data.rol || data.Rol || 'Usuario';

    // Foto (usando el nombre ya procesado)
    this.userPhoto = data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=b0001e&color=fff&bold=true`;
  }

  private async fetchFromFirebase(authUser: any) {
    this.userName = authUser.displayName || 'No disponible';
    this.userEmail = authUser.email || 'No disponible';
    this.userPhoto = authUser.photoURL || this.userPhoto;

    try {
      const userRef = doc(this.firestore, `usuarios/${authUser.uid}`);
      const snap = await getDoc(userRef);
      let fbData = snap.exists() ? snap.data() : null;

      if (!fbData) {
        const q = query(collection(this.firestore, 'usuarios'), where('correo', '==', this.userEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) fbData = qSnap.docs[0].data();
      }

      if (fbData) this.fillData(fbData);
    } catch (e) {
      console.error("Error Firebase:", e);
    }
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }
}