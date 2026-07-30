import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DoctorMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

declare var flatpickr: any;

interface PerfilDoctor {
    idusuario: number;
    nombre: string;
    apPaterno: string;
    apMaterno: string;
    correo: string;
    telefono: string;
    fechaNacimiento: string;
    genero: string;
    curp: string;
    domicilio: string;
    codigoPostal: string;
    localidad: string;
    municipio: string;
    estado: string;
    especialidad: string;
    cedula: string;
    direccionClinica: string;
    tipoSangre: string;
    peso: number;
    altura: number;
    antecedentesFamiliares: string;
    activo: boolean;
    rol: string;
}

@Component({
    selector: 'app-doctor-perfil',
    standalone: true,
    imports: [CommonModule, FormsModule, DoctorMenu],
    templateUrl: './perfil.html',
    styleUrls: ['./perfil.css']
})
export class DoctorPerfil implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);
    private router = inject(Router);

    isLoading = true;
    isSaving = false;
    doctorId: number | null = null;
    doctorName: string = '';
    doctorFullName: string = '';
    userEmail: string = '';
    userRol: string = '';

    perfil: PerfilDoctor = {
        idusuario: 0,
        nombre: '',
        apPaterno: '',
        apMaterno: '',
        correo: '',
        telefono: '',
        fechaNacimiento: '',
        genero: '',
        curp: '',
        domicilio: '',
        codigoPostal: '',
        localidad: '',
        municipio: '',
        estado: '',
        especialidad: '',
        cedula: '',
        direccionClinica: '',
        tipoSangre: '',
        peso: 0,
        altura: 0,
        antecedentesFamiliares: '',
        activo: true,
        rol: 'Doctor'
    };

    mostrarModalEditar = false;
    perfilEditado: PerfilDoctor | null = null;

    mostrarModalCerrarSesion = false;

    mostrarToast = false;
    mensajeToast = '';
    tipoToast: 'success' | 'error' | 'warning' = 'success';
    private toastTimeout: any = null;

    private fpFechaInstance: any = null;

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.userEmail = userData.correo || '';
                    this.doctorName = userData.nombre || 'Doctor';
                    this.doctorFullName = userData.nombreCompleto || userData.nombre || 'Doctor';
                    this.doctorId = userData.idusuario || userData.uid || null;
                    this.userRol = userData.rol || 'Doctor';
                } catch (e) {
                    console.error('Error al parsear localStorage:', e);
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.doctorName = user.displayName || 'Doctor';
                    this.doctorFullName = user.displayName || 'Doctor';
                }
            }

            if (this.doctorId) {
                await this.cargarPerfil();
            } else if (this.userEmail) {
                await this.cargarPerfilPorEmail();
            }

        } catch (error) {
            console.error('Error al cargar perfil:', error);
            this.lanzarNotificacion('Error', 'No se pudo cargar el perfil', 'error');
        } finally {
            this.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    ngOnDestroy() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.destruirCalendarios();
    }

    private async cargarPerfil() {
        try {
            if (!this.doctorId) return;

            const userData = await firstValueFrom(
                this.usersService.getUsuarioById(this.doctorId)
            );

            if (userData) {
                this.perfil = {
                    idusuario: userData.idusuario || this.doctorId || 0,
                    nombre: userData.nombre || this.doctorName,
                    apPaterno: userData.apPaterno || '',
                    apMaterno: userData.apMaterno || '',
                    correo: userData.correo || this.userEmail,
                    telefono: userData.telefono || '',
                    fechaNacimiento: userData.fechaNacimiento || '',
                    genero: userData.genero || '',
                    curp: userData.curp || '',
                    domicilio: userData.domicilio || '',
                    codigoPostal: userData.codigoPostal || '',
                    localidad: userData.localidad || '',
                    municipio: userData.municipio || '',
                    estado: userData.estado || '',
                    especialidad: userData.especialidad || '',
                    cedula: userData.cedula || '',
                    direccionClinica: userData.direccionClinica || '',
                    tipoSangre: userData.tipoSangre || '',
                    peso: userData.peso || 0,
                    altura: userData.altura || 0,
                    antecedentesFamiliares: userData.antecedentesFamiliares || '',
                    activo: userData.activo !== false,
                    rol: userData.rol || 'Doctor'
                };

                if (this.perfil.nombre && this.perfil.apPaterno) {
                    this.doctorFullName = `${this.perfil.nombre} ${this.perfil.apPaterno} ${this.perfil.apMaterno || ''}`.trim();
                }

                this.cdr.markForCheck();
            }
        } catch (error) {
            console.error('Error al cargar perfil:', error);
        }
    }

    private async cargarPerfilPorEmail() {
        try {
            const allUsers = await firstValueFrom(
                this.usersService.getUsuariosBackend()
            );

            if (Array.isArray(allUsers) && allUsers.length > 0) {
                const foundUser = allUsers.find((u: any) =>
                    u.correo?.toLowerCase() === this.userEmail.toLowerCase()
                );

                if (foundUser) {
                    this.doctorId = foundUser.idusuario || foundUser.id || null;
                    if (this.doctorId) {
                        await this.cargarPerfil();
                    }
                }
            }
        } catch (error) {
            console.error('Error al cargar perfil por email:', error);
        }
    }

    abrirModalEditar() {
        this.perfilEditado = { ...this.perfil };
        this.mostrarModalEditar = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();

        setTimeout(() => {
            this.inicializarCalendarioNacimiento();
        }, 200);
    }

    cerrarModalEditar() {
        this.mostrarModalEditar = false;
        this.perfilEditado = null;
        document.body.style.overflow = '';
        this.destruirCalendarios();
        this.cdr.markForCheck();
    }

    inicializarCalendarioNacimiento() {
        if (!isPlatformBrowser(this.platformId) || !this.perfilEditado) return;

        this.destruirCalendarios();

        const elemento = document.querySelector('#editFechaNacimiento') as HTMLInputElement;
        if (!elemento) return;

        elemento.setAttribute('readonly', 'true');
        elemento.classList.add('picker-custom');

        let wrapper = elemento.parentElement;
        if (!wrapper || !wrapper.classList.contains('input-picker-wrapper')) {
            const nuevoWrapper = document.createElement('div');
            nuevoWrapper.className = 'input-picker-wrapper';
            elemento.parentNode?.insertBefore(nuevoWrapper, elemento);
            nuevoWrapper.appendChild(elemento);

            const icono = document.createElement('i');
            icono.className = 'bi bi-calendar3 icon-embed';
            nuevoWrapper.appendChild(icono);

            wrapper = nuevoWrapper;
        }

        const config: any = {
            locale: Spanish,
            dateFormat: "Y-m-d",
            defaultDate: this.perfilEditado?.fechaNacimiento || null,
            maxDate: "today",
            appendTo: document.body,
            static: false,
            disableMobile: true,
            onChange: (selectedDates: any, dateStr: string) => {
                if (this.perfilEditado) {
                    this.perfilEditado.fechaNacimiento = dateStr;
                    this.cdr.markForCheck();
                }
            }
        };

        try {
            this.fpFechaInstance = flatpickr(elemento, config);
        } catch (error) {
            console.error('Error al inicializar Flatpickr:', error);
        }
    }

    destruirCalendarios() {
        if (this.fpFechaInstance) {
            try {
                this.fpFechaInstance.destroy();
            } catch (e) { }
            this.fpFechaInstance = null;
        }
    }

    async guardarPerfil() {
        if (!this.perfilEditado) return;

        this.isSaving = true;
        this.cdr.markForCheck();

        try {
            const datosActualizados = {
                nombre: this.perfilEditado.nombre,
                apPaterno: this.perfilEditado.apPaterno,
                apMaterno: this.perfilEditado.apMaterno,
                telefono: this.perfilEditado.telefono,
                fechaNacimiento: this.perfilEditado.fechaNacimiento,
                genero: this.perfilEditado.genero,
                curp: this.perfilEditado.curp,
                domicilio: this.perfilEditado.domicilio,
                codigoPostal: this.perfilEditado.codigoPostal,
                localidad: this.perfilEditado.localidad,
                municipio: this.perfilEditado.municipio,
                estado: this.perfilEditado.estado,
                especialidad: this.perfilEditado.especialidad,
                cedula: this.perfilEditado.cedula,
                direccionClinica: this.perfilEditado.direccionClinica,
                tipoSangre: this.perfilEditado.tipoSangre,
                peso: this.perfilEditado.peso,
                altura: this.perfilEditado.altura,
                antecedentesFamiliares: this.perfilEditado.antecedentesFamiliares
            };

            await firstValueFrom(
                this.usersService.updateUsuario(this.perfilEditado.idusuario, datosActualizados)
            );

            this.perfil = { ...this.perfilEditado };

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    userData.nombre = this.perfilEditado.nombre;
                    userData.apPaterno = this.perfilEditado.apPaterno;
                    userData.apMaterno = this.perfilEditado.apMaterno;
                    userData.nombreCompleto = `${this.perfilEditado.nombre} ${this.perfilEditado.apPaterno} ${this.perfilEditado.apMaterno || ''}`.trim();
                    userData.telefono = this.perfilEditado.telefono;
                    localStorage.setItem('user_htas', JSON.stringify(userData));
                } catch (e) {
                    console.error('Error al actualizar localStorage:', e);
                }
            }

            this.cerrarModalEditar();
            this.lanzarNotificacion('Exito', 'Perfil actualizado correctamente', 'success');

        } catch (error) {
            console.error('Error al guardar perfil:', error);
            this.lanzarNotificacion('Error', 'Error al actualizar el perfil', 'error');
        } finally {
            this.isSaving = false;
            this.cdr.markForCheck();
        }
    }

    irANotificaciones() {
        this.router.navigate(['/doctor/notificaciones']);
    }

    abrirModalCerrarSesion() {
        this.mostrarModalCerrarSesion = true;
        document.body.style.overflow = 'hidden';
        this.cdr.markForCheck();
    }

    cerrarModalCerrarSesion() {
        this.mostrarModalCerrarSesion = false;
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    async cerrarSesion() {
        try {
            localStorage.removeItem('user_htas');
            localStorage.removeItem('token');

            this.usersService.limpiarSesion();

            try {
                await this.auth.signOut();
            } catch (e) {
                console.error('Error al cerrar sesión en Firebase:', e);
            }

            this.cerrarModalCerrarSesion();
            this.router.navigate(['/login']);

        } catch (error) {
            console.error('Error al cerrar sesion:', error);
            this.lanzarNotificacion('Error', 'Error al cerrar sesion', 'error');
            this.cerrarModalCerrarSesion();
        }
    }

    lanzarNotificacion(titulo: string, mensaje: string, tipo: 'success' | 'error' | 'warning' = 'success') {
        this.mensajeToast = `${titulo}: ${mensaje}`;
        this.tipoToast = tipo;
        this.mostrarToast = true;
        this.cdr.markForCheck();

        if (this.toastTimeout) clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.mostrarToast = false;
            this.cdr.markForCheck();
        }, 4000);
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'No especificada';
        try {
            const d = new Date(fecha);
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return `${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    getIniciales(nombre: string): string {
        if (!nombre) return '?';
        const partes = nombre.trim().split(' ');
        if (partes.length === 0) return '?';
        if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
        return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
    }

    getColorIniciales(nombre: string): string {
        const colores = ['#b0001e', '#d42a4a', '#8a0017', '#e85d7a', '#a0001a'];
        const hash = nombre.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colores[hash % colores.length];
    }

    getRolTexto(rol: string): string {
        const roles: { [key: string]: string } = {
            'Paciente': 'Paciente',
            'Doctor': 'Medico',
            'Admin': 'Administrador',
            'Acompanante': 'Acompanante'
        };
        return roles[rol] || rol;
    }
}