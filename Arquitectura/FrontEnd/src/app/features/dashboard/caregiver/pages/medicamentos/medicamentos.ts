import { Component, OnInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CaregiverMenu } from "../../template/menu/menu";
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../../../core/services/users.service';

interface ToastNotification {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
}

@Component({
    selector: 'app-caregiver-medicamentos',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        CaregiverMenu
    ],
    templateUrl: './medicamentos.html',
    styleUrls: ['./medicamentos.css']
})
export class CaregiverMedicamentos implements OnInit {
    private usersService = inject(Users);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private platformId = inject(PLATFORM_ID);

    isLoading = true;
    caregiverId: number | null = null;
    caregiverName: string = '';

    medicamentos: any[] = [];
    medicamentosFiltrados: any[] = [];
    filterTipo: string = 'todos';
    filterLaboratorio: string = 'todos';
    searchTerm: string = '';

    pacientesAsignados: Set<number> = new Set();
    pacientesConAcceso: Map<number, boolean> = new Map();
    private pacientesMap: Map<number, any> = new Map();

    estadisticas = {
        total: 0,
        conTratamientos: 0,
        sinTratamientos: 0,
        laboratorios: 0
    };

    laboratoriosDisponibles: string[] = [];

    notifications: ToastNotification[] = [];
    private notificationCounter = 0;

    // Modal de solicitud
    mostrarModalSolicitud: boolean = false;
    pacienteSolicitado: any = null;
    parentesco: string = '';
    notasSolicitud: string = '';
    enviandoSolicitud: boolean = false;
    solicitudPendiente: boolean = false;
    mensajeSolicitud: string = '';

    parentescos = [
        'Padre', 'Madre', 'Hermano', 'Hermana', 'Tio', 'Tia',
        'Primo', 'Prima', 'Abuelo', 'Abuela', 'Conyuge', 'Otro'
    ];

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.cargarDatos();
    }

    private showToast(type: ToastNotification['type'], title: string, message: string, duration: number = 5000) {
        const id = ++this.notificationCounter;
        const notification: ToastNotification = {
            id,
            type,
            title,
            message,
            duration
        };

        this.notifications.unshift(notification);
        this.cdr.detectChanges();

        setTimeout(() => {
            this.removeToast(id);
        }, duration);
    }

    removeToast(id: number) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.cdr.detectChanges();
    }

    showSuccess(title: string, message: string, duration: number = 5000) {
        this.showToast('success', title, message, duration);
    }

    showError(title: string, message: string, duration: number = 7000) {
        this.showToast('error', title, message, duration);
    }

    showWarning(title: string, message: string, duration: number = 5000) {
        this.showToast('warning', title, message, duration);
    }

    showInfo(title: string, message: string, duration: number = 4000) {
        this.showToast('info', title, message, duration);
    }

    async cargarDatos() {
        this.isLoading = true;
        try {
            const storedUser = localStorage.getItem('user_htas');
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                this.caregiverId = userData.idusuario || userData.uid || null;
                this.caregiverName = userData.nombre || 'Acompanante';
            }

            if (this.caregiverId) {
                await this.cargarPacientesAsignados();
                await this.cargarPacientes();
                await this.cargarMedicamentos();
                await this.verificarSolicitudesPendientes();
            } else {
                this.showWarning('Sin datos', 'No se pudo identificar al acompanante');
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.showError('Error', 'No se pudieron cargar los medicamentos.');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private async cargarPacientesAsignados() {
        try {
            const pacientes = await firstValueFrom(
                this.usersService.getPacientesAsignados(this.caregiverId!)
            );

            if (Array.isArray(pacientes)) {
                this.pacientesAsignados.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesAsignados.add(id);
                        this.pacientesConAcceso.set(id, true);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes asignados:', error);
        }
    }

    private async cargarPacientes() {
        try {
            const usuarios = await firstValueFrom(this.usersService.getUsuariosBackend());
            if (Array.isArray(usuarios)) {
                const pacientes = usuarios.filter(u =>
                    u.rol?.toLowerCase() === 'paciente' && u.activo !== false
                );

                this.pacientesMap.clear();
                pacientes.forEach(p => {
                    const id = p.idusuario || p.id;
                    if (id) {
                        this.pacientesMap.set(id, p);
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar pacientes:', error);
        }
    }

    private async verificarSolicitudesPendientes() {
        try {
            const solicitudes = await firstValueFrom(
                this.usersService.getMisSolicitudes(this.caregiverId!)
            );

            if (Array.isArray(solicitudes)) {
                const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
                if (pendientes.length > 0) {
                    this.solicitudPendiente = true;
                    this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';
                } else {
                    this.solicitudPendiente = false;
                    this.mensajeSolicitud = '';
                }

                // Marcar medicamentos con solicitud pendiente
                const pacientesPendientes = new Set(pendientes.map(s => s.idpaciente));
                this.medicamentos.forEach(m => {
                    m.solicitudPendiente = pacientesPendientes.has(m.idpaciente);
                });
            }
        } catch (error) {
            console.error('Error al verificar solicitudes pendientes:', error);
        }
    }

    private async cargarMedicamentos() {
        try {
            const data = await firstValueFrom(this.usersService.getMedicamentos());

            if (Array.isArray(data)) {
                const tratamientos = await firstValueFrom(this.usersService.getTratamientos());
                const tratamientosMap = new Map<number, any[]>();

                if (Array.isArray(tratamientos)) {
                    tratamientos.forEach(t => {
                        const idMedicamento = t.idmedicamento || t.IdMedicamento;
                        const idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente;
                        if (idMedicamento && this.pacientesAsignados.has(idPaciente)) {
                            if (!tratamientosMap.has(idMedicamento)) {
                                tratamientosMap.set(idMedicamento, []);
                            }
                            tratamientosMap.get(idMedicamento)!.push(t);
                        }
                    });
                }

                this.medicamentos = data.map(m => {
                    const id = m.idmedicamento || m.id;
                    const tratamientosDelMedicamento = tratamientosMap.get(id) || [];
                    const totalTratamientos = tratamientosDelMedicamento.length;

                    // Obtener el paciente asociado al primer tratamiento
                    let pacienteAsociado = null;
                    let idPaciente = null;
                    if (tratamientosDelMedicamento.length > 0) {
                        const t = tratamientosDelMedicamento[0];
                        idPaciente = t.idpaciente || t.IdPaciente || t.idPaciente;
                        if (idPaciente && this.pacientesMap.has(idPaciente)) {
                            pacienteAsociado = this.pacientesMap.get(idPaciente);
                        }
                    }

                    let nombrePaciente = 'Paciente';
                    if (pacienteAsociado) {
                        const nombre = pacienteAsociado.nombre || '';
                        const apPaterno = pacienteAsociado.apPaterno || '';
                        const apMaterno = pacienteAsociado.apMaterno || '';
                        nombrePaciente = `${nombre} ${apPaterno} ${apMaterno}`.trim();
                        if (!nombrePaciente) {
                            nombrePaciente = pacienteAsociado.correo || 'Paciente';
                        }
                    }

                    return {
                        ...m,
                        idmedicamento: id,
                        idpaciente: idPaciente,
                        nombrePaciente: nombrePaciente,
                        nombreComercial: m.nombrecomercial || m.NombreComercial || 'Medicamento',
                        sustanciaActiva: m.sustanciaactiva || m.SustanciaActiva,
                        presentacion: m.presentacion || m.Presentacion,
                        concentracion: m.concentracion || m.Concentracion,
                        laboratorio: m.laboratorio || m.Laboratorio,
                        totalTratamientos: totalTratamientos,
                        tratamientosActivos: tratamientosDelMedicamento.filter(t => t.activo !== false && t.activo !== 0).length,
                        tieneAcceso: totalTratamientos > 0,
                        solicitudPendiente: false
                    };
                });

                this.medicamentos = this.medicamentos.filter(m => m.totalTratamientos > 0);

                this.calcularEstadisticas();
                this.obtenerLaboratorios();
                this.aplicarFiltros();
            } else {
                this.medicamentos = [];
            }
        } catch (error) {
            console.error('Error al cargar medicamentos:', error);
            this.medicamentos = [];
        }
    }

    private calcularEstadisticas() {
        this.estadisticas.total = this.medicamentos.length;
        this.estadisticas.conTratamientos = this.medicamentos.filter(m => m.totalTratamientos > 0).length;
        this.estadisticas.sinTratamientos = this.medicamentos.filter(m => m.totalTratamientos === 0).length;

        const laboratorios = new Set<string>();
        this.medicamentos.forEach(m => {
            if (m.laboratorio) {
                laboratorios.add(m.laboratorio);
            }
        });
        this.estadisticas.laboratorios = laboratorios.size;
    }

    private obtenerLaboratorios() {
        const labs = new Set<string>();
        this.medicamentos.forEach(m => {
            if (m.laboratorio) {
                labs.add(m.laboratorio);
            }
        });
        this.laboratoriosDisponibles = Array.from(labs).sort();
    }

    aplicarFiltroPorTipo(tipo: string) {
        this.filterTipo = tipo;
        this.aplicarFiltros();
    }

    aplicarFiltroPorLaboratorio(laboratorio: string) {
        this.filterLaboratorio = laboratorio;
        this.aplicarFiltros();
    }

    buscarMedicamentos() {
        this.aplicarFiltros();
    }

    private aplicarFiltros() {
        const term = this.searchTerm.toLowerCase().trim();

        this.medicamentosFiltrados = this.medicamentos.filter(m => {
            let matchTipo = true;
            if (this.filterTipo === 'con-uso') {
                matchTipo = m.totalTratamientos > 0;
            } else if (this.filterTipo === 'sin-uso') {
                matchTipo = m.totalTratamientos === 0;
            }

            let matchLaboratorio = true;
            if (this.filterLaboratorio !== 'todos') {
                matchLaboratorio = (m.laboratorio || '').toLowerCase() === this.filterLaboratorio.toLowerCase();
            }

            let matchSearch = true;
            if (term) {
                matchSearch =
                    (m.nombreComercial || '').toLowerCase().includes(term) ||
                    (m.sustanciaActiva || '').toLowerCase().includes(term) ||
                    (m.laboratorio || '').toLowerCase().includes(term) ||
                    (m.presentacion || '').toLowerCase().includes(term) ||
                    (m.nombrePaciente || '').toLowerCase().includes(term);
            }

            return matchTipo && matchLaboratorio && matchSearch;
        });
    }

    verDetalle(medicamento: any) {
        const id = medicamento.idmedicamento || medicamento.id;
        if (id) {
            this.router.navigate(['/caregiver/medicamentos/detalle', id]);
        }
    }

    // ============================================
    // MODAL DE SOLICITUD DE ACCESO
    // ============================================
    abrirModalSolicitud(medicamento: any, event: Event) {
        event.stopPropagation();
        if (this.solicitudPendiente) {
            this.showWarning('Solicitud pendiente',
                'Ya tienes una solicitud pendiente. Espera la aprobacion del administrador.');
            return;
        }
        this.pacienteSolicitado = medicamento;
        this.parentesco = '';
        this.notasSolicitud = '';
        this.mostrarModalSolicitud = true;
        this.cdr.detectChanges();
    }

    cerrarModalSolicitud() {
        this.mostrarModalSolicitud = false;
        this.pacienteSolicitado = null;
        this.parentesco = '';
        this.notasSolicitud = '';
        this.enviandoSolicitud = false;
    }

    async enviarSolicitud() {
        if (!this.parentesco) {
            this.showWarning('Campo requerido', 'Selecciona el parentesco con el paciente');
            return;
        }

        this.enviandoSolicitud = true;
        try {
            const paciente = this.pacienteSolicitado;
            const correoPaciente = paciente.correo || '';

            await firstValueFrom(
                this.usersService.solicitarAsignacionPaciente(this.caregiverId!, {
                    correoPaciente: correoPaciente,
                    parentesco: this.parentesco,
                    notas: this.notasSolicitud
                })
            );

            this.showSuccess('Solicitud enviada',
                'Tu solicitud ha sido enviada. Espera la aprobacion del administrador.');

            this.solicitudPendiente = true;
            this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';

            // Marcar el medicamento como con solicitud pendiente
            const index = this.medicamentos.findIndex(m => m.idmedicamento === this.pacienteSolicitado.idmedicamento);
            if (index !== -1) {
                this.medicamentos[index].solicitudPendiente = true;
            }

            this.cerrarModalSolicitud();

        } catch (error: any) {
            if (error.error?.error === 'Ya tienes una solicitud pendiente para este paciente') {
                this.showWarning('Solicitud pendiente',
                    'Ya tienes una solicitud pendiente para este paciente. Espera la aprobacion.');
                this.solicitudPendiente = true;
                this.mensajeSolicitud = 'Tienes una solicitud pendiente. Espera la aprobacion del administrador.';
            } else {
                const mensaje = error.error?.error || 'Error al enviar la solicitud';
                this.showError('Error', mensaje);
            }
        } finally {
            this.enviandoSolicitud = false;
        }
    }

    getAccesoStatus(medicamento: any): { texto: string; clase: string; icono: string; tieneAcceso: boolean } {
        if (medicamento.tieneAcceso) {
            return {
                texto: 'Tienes acceso',
                clase: 'acceso-si',
                icono: 'bi-check-circle-fill',
                tieneAcceso: true
            };
        }
        if (medicamento.solicitudPendiente) {
            return {
                texto: 'Solicitud enviada',
                clase: 'acceso-pendiente',
                icono: 'bi-clock-history',
                tieneAcceso: false
            };
        }
        return {
            texto: 'Sin acceso',
            clase: 'acceso-no',
            icono: 'bi-x-circle-fill',
            tieneAcceso: false
        };
    }
}