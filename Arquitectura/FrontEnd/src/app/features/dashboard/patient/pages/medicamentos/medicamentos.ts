import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientMenu } from "../../template/menu/menu";
import { Users } from '../../../../../core/services/users.service';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';

interface Medicamento {
    idmedicamento: number;
    nombrecomercial: string;
    sustanciaactiva: string;
    presentacion: string;
    concentracion: string;
    laboratorio: string;
    indicacionesgenerales: string;
    totaltratamientos: number;
    tratamientosactivos: number;
}

interface TratamientoRelacionado {
    idtratamiento: number;
    paciente: string;
    activo: boolean;
    fechainicio: string;
    fechafin: string;
}

@Component({
    selector: 'app-patient-medicamentos',
    standalone: true,
    imports: [CommonModule, FormsModule, PatientMenu],
    templateUrl: './medicamentos.html',
    styleUrls: ['./medicamentos.css']
})
export class PatientMedicamentos implements OnInit {
    private usersService = inject(Users);
    private auth = inject(Auth);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    patientId: number | null = null;
    patientName: string = '';
    patientFullName: string = '';
    userEmail: string = '';

    medicamentos: Medicamento[] = [];
    medicamentosFiltrados: Medicamento[] = [];
    filterEstado: string = 'todos';

    estadisticas = {
        total: 0,
        activos: 0,
        inactivos: 0
    };

    mostrarModalDetalle = false;
    medicamentoSeleccionado: Medicamento | null = null;
    tratamientosRelacionados: TratamientoRelacionado[] = [];

    searchTerm: string = '';
    cargandoDetalle = false;

    async ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            this.isLoading = true;

            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    this.userEmail = userData.correo || '';
                    this.patientName = userData.nombre || 'Paciente';
                    this.patientFullName = userData.nombreCompleto || userData.nombre || 'Paciente';
                    this.patientId = userData.idusuario || userData.uid || null;
                } catch (e) {
                    // Error al parsear localStorage
                }
            }

            if (!this.userEmail) {
                const user = this.auth.currentUser;
                if (user) {
                    this.userEmail = user.email || '';
                    this.patientName = user.displayName || 'Paciente';
                    this.patientFullName = user.displayName || 'Paciente';
                }
            }

            await this.cargarMedicamentos();

        } catch (error) {
            // Error al cargar medicamentos
        } finally {
            this.isLoading = false;
            this.cdr.markForCheck();
        }
    }

    private async cargarMedicamentos() {
        try {
            const response = await firstValueFrom(
                this.usersService.getMedicamentos()
            );

            if (response && Array.isArray(response)) {
                this.medicamentos = response.map((m: any) => ({
                    idmedicamento: m.idmedicamento,
                    nombrecomercial: m.nombrecomercial || 'Sin nombre',
                    sustanciaactiva: m.sustanciaactiva || 'No especificada',
                    presentacion: m.presentacion || 'No especificada',
                    concentracion: m.concentracion || 'No especificada',
                    laboratorio: m.laboratorio || 'No especificado',
                    indicacionesgenerales: m.indicacionesgenerales || '',
                    totaltratamientos: m.totaltratamientos || 0,
                    tratamientosactivos: m.tratamientosactivos || 0
                }));

                this.calcularEstadisticas();
                this.aplicarFiltro('todos');
                this.cdr.markForCheck();
            }
        } catch (error) {
            this.medicamentos = [];
        }
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.medicamentos.length;
        this.estadisticas.activos = this.medicamentos.filter(m =>
            m.tratamientosactivos > 0
        ).length;
        this.estadisticas.inactivos = this.medicamentos.filter(m =>
            m.tratamientosactivos === 0
        ).length;
    }

    aplicarFiltro(estado: string) {
        this.filterEstado = estado;
        if (estado === 'todos') {
            this.medicamentosFiltrados = [...this.medicamentos];
        } else if (estado === 'activos') {
            this.medicamentosFiltrados = this.medicamentos.filter(m =>
                m.tratamientosactivos > 0
            );
        } else if (estado === 'inactivos') {
            this.medicamentosFiltrados = this.medicamentos.filter(m =>
                m.tratamientosactivos === 0
            );
        }
        this.cdr.markForCheck();
    }

    get medicamentosPaginados() {
        const busqueda = this.searchTerm.toLowerCase().trim();
        if (!busqueda) return this.medicamentosFiltrados;

        return this.medicamentosFiltrados.filter(m =>
            m.nombrecomercial.toLowerCase().includes(busqueda) ||
            m.sustanciaactiva.toLowerCase().includes(busqueda) ||
            m.laboratorio.toLowerCase().includes(busqueda) ||
            m.presentacion.toLowerCase().includes(busqueda)
        );
    }

    verDetalle(medicamento: Medicamento) {
        this.medicamentoSeleccionado = medicamento;
        this.mostrarModalDetalle = true;
        document.body.style.overflow = 'hidden';
        this.cargarDetalleMedicamento(medicamento.idmedicamento);
    }

    cerrarModalDetalle() {
        this.mostrarModalDetalle = false;
        this.medicamentoSeleccionado = null;
        this.tratamientosRelacionados = [];
        document.body.style.overflow = '';
        this.cdr.markForCheck();
    }

    private async cargarDetalleMedicamento(idMedicamento: number) {
        try {
            this.cargandoDetalle = true;
            this.cdr.markForCheck();

            const response = await firstValueFrom(
                this.usersService.getMedicamentoById(idMedicamento)
            );

            if (response) {
                const tratamientos = response.tratamientosrelacionados || [];

                this.tratamientosRelacionados = tratamientos.map((t: any) => ({
                    idtratamiento: t.idtratamiento || t.IdTratamiento || 0,
                    paciente: t.paciente || t.Paciente || 'Paciente sin nombre',
                    activo: t.activo === true || t.activo === 'true' ||
                        t.Activo === true || t.Activo === 'true',
                    fechainicio: t.fechainicio || t.FechaInicio || '',
                    fechafin: t.fechafin || t.FechaFin || ''
                }));

                this.cdr.markForCheck();
            }
        } catch (error) {
            // Error al cargar detalle del medicamento
        } finally {
            this.cargandoDetalle = false;
            this.cdr.markForCheck();
        }
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    formatearFechaCompleta(fecha: string): string {
        if (!fecha) return 'Sin fecha';
        try {
            const d = new Date(fecha);
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return `${diasSemana[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch {
            return fecha;
        }
    }

    getEstadoClass(activo: boolean): string {
        return activo ? 'estado-activo' : 'estado-inactivo';
    }

    getEstadoTexto(activo: boolean): string {
        return activo ? 'Activo' : 'Inactivo';
    }

    getEstadoIcon(activo: boolean): string {
        return activo ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
    }
}