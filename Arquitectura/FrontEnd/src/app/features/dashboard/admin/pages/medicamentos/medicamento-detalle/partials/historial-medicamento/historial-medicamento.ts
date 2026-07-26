import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Users } from '../../../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Medicamento, HistorialMedicamentoItem, TratamientoAsociado, EstadisticasMedicamento } from '../../medicamento-detalle';

@Component({
    selector: 'app-historial-medicamento',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './historial-medicamento.html',
    styleUrls: ['./historial-medicamento.css']
})
export class HistorialMedicamento implements OnChanges {
    private usersService = inject(Users);
    private cdr = inject(ChangeDetectorRef);

    @Input() medicamento!: Medicamento;
    @Output() volver = new EventEmitter<void>();

    historialCambios: HistorialMedicamentoItem[] = [];
    tratamientosAsociados: TratamientoAsociado[] = [];
    estadisticas: EstadisticasMedicamento | null = null;

    cargandoEstadisticas = false;
    cargandoTratamientos = false;

    get nombreFormateado(): string {
        if (!this.medicamento) return '';
        const nombre = this.medicamento.nombrecomercial || '';
        const sustancia = this.medicamento.sustanciaactiva || '';
        return sustancia ? `${nombre} (${sustancia})` : nombre;
    }

    get infoPresentacion(): string {
        if (!this.medicamento) return '';
        const partes = [];
        if (this.medicamento.presentacion) partes.push(this.medicamento.presentacion);
        if (this.medicamento.concentracion) partes.push(this.medicamento.concentracion);
        return partes.join(' - ');
    }

    get totalTratamientos(): number {
        return this.tratamientosAsociados.length;
    }

    get ultimoUsoFormateado(): string {
        if (!this.estadisticas?.ultimoUso) return 'Sin registros';

        try {
            const fecha = new Date(this.estadisticas.ultimoUso);
            if (isNaN(fecha.getTime())) return 'Sin registros';

            const dia = String(fecha.getDate()).padStart(2, '0');
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const anio = fecha.getFullYear();
            return `${dia}/${mes}/${anio}`;
        } catch {
            return 'Sin registros';
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['medicamento'] && this.medicamento) {
            const idMedicamento = this.medicamento.idmedicamento;
            if (idMedicamento) {
                this.cargarDatos(idMedicamento);
            }
        }
    }

    async cargarDatos(idMedicamento: number) {
        // Resetear datos antes de cargar
        this.tratamientosAsociados = [];
        this.estadisticas = null;
        this.historialCambios = [];

        await this.cargarTratamientos(idMedicamento);
        await this.cargarEstadisticas(idMedicamento);
        this.inicializarHistorial();
        this.cdr.detectChanges();
    }

    async cargarEstadisticas(idMedicamento: number) {
        if (!idMedicamento) return;

        this.cargandoEstadisticas = true;

        try {
            const response = await firstValueFrom(
                this.usersService.getEstadisticasMedicamento(idMedicamento)
            );

            if (response) {
                this.estadisticas = {
                    totalTratamientos: response.totalTratamientos || 0,
                    tratamientosActivos: response.tratamientosActivos || 0,
                    ultimoUso: response.ultimoUso || null,
                    pacientesActivos: response.pacientesActivos || 0
                };
            } else {
                this.calcularEstadisticasDesdeTratamientos();
            }
        } catch (error) {
            console.warn('No se pudieron cargar estadísticas:', error);
            this.calcularEstadisticasDesdeTratamientos();
        } finally {
            this.cargandoEstadisticas = false;
            this.cdr.detectChanges();
        }
    }

    calcularEstadisticasDesdeTratamientos() {
        const activos = this.tratamientosAsociados.filter(t => t.activo);
        const pacientes = new Set(this.tratamientosAsociados.map(t => t.idPaciente));

        this.estadisticas = {
            totalTratamientos: this.tratamientosAsociados.length,
            tratamientosActivos: activos.length,
            ultimoUso: this.tratamientosAsociados.length > 0
                ? this.tratamientosAsociados[0].fechaInicio
                : null,
            pacientesActivos: pacientes.size
        };
    }

    async cargarTratamientos(idMedicamento: number) {
        if (!idMedicamento) return;

        this.cargandoTratamientos = true;

        try {
            const response = await firstValueFrom(
                this.usersService.getTratamientos()
            );

            const tratamientosFiltrados = response.filter((t: any) =>
                t.idmedicamento === idMedicamento ||
                t.IdMedicamento === idMedicamento ||
                t.idMedicamento === idMedicamento
            );

            if (tratamientosFiltrados && tratamientosFiltrados.length > 0) {
                this.tratamientosAsociados = tratamientosFiltrados.map((t: any) => ({
                    id: t.idtratamiento || t.IdTratamiento || t.id || 0,
                    paciente: this.getNombreCompletoPaciente(t),
                    nombre: t.nombre || t.Nombre || t.nombrepaciente || t.NombrePaciente || '',
                    apPaterno: t.appaterno || t.ApPaterno || t.appaternopaciente || t.ApPaternoPaciente || '',
                    apMaterno: t.apmaterno || t.ApMaterno || t.apmaternopaciente || t.ApMaternoPaciente || '',
                    idPaciente: t.idpaciente || t.IdPaciente || 0,
                    fechaInicio: this.formatearFecha(t.fechainicio || t.FechaInicio || ''),
                    fechaFin: this.formatearFecha(t.fechafin || t.FechaFin || ''),
                    activo: t.activo !== undefined ? t.activo : true,
                    dosis: t.dosis || t.Dosis || 'Sin dosis especificada',
                    idMedicamento: t.idmedicamento || t.IdMedicamento || idMedicamento
                }));

                this.tratamientosAsociados.sort((a, b) => {
                    return new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime();
                });

                this.calcularEstadisticasDesdeTratamientos();
            } else {
                this.tratamientosAsociados = [];
                this.estadisticas = {
                    totalTratamientos: 0,
                    tratamientosActivos: 0,
                    ultimoUso: null,
                    pacientesActivos: 0
                };
            }
        } catch (error) {
            console.warn('No se pudieron cargar tratamientos:', error);
            this.tratamientosAsociados = [];
        } finally {
            this.cargandoTratamientos = false;
            this.cdr.detectChanges();
        }
    }

    getNombreCompletoPaciente(t: any): string {
        const nombre = t.nombre || t.Nombre || t.nombrepaciente || t.NombrePaciente || '';
        const apPaterno = t.appaterno || t.ApPaterno || t.appaternopaciente || t.ApPaternoPaciente || '';
        const apMaterno = t.apmaterno || t.ApMaterno || t.apmaternopaciente || t.ApMaternoPaciente || '';

        if (nombre && apPaterno) {
            return `${nombre} ${apPaterno} ${apMaterno || ''}`.trim();
        }

        if (nombre) {
            return nombre;
        }

        if (t.nombrepaciente || t.NombrePaciente) {
            return t.nombrepaciente || t.NombrePaciente;
        }

        return 'Paciente sin nombre';
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return '';

        try {
            if (fecha.includes('T')) {
                const fechaObj = new Date(fecha);
                if (!isNaN(fechaObj.getTime())) {
                    const dia = String(fechaObj.getDate()).padStart(2, '0');
                    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                    const anio = fechaObj.getFullYear();
                    return `${dia}/${mes}/${anio}`;
                }
            }

            if (fecha.includes('-')) {
                const partes = fecha.split('-');
                if (partes.length === 3) {
                    return `${partes[2]}/${partes[1]}/${partes[0]}`;
                }
            }

            return fecha;
        } catch (error) {
            return fecha;
        }
    }

    inicializarHistorial() {
        if (!this.medicamento) return;

        const ahora = new Date();
        const fechaStr = ahora.toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        this.historialCambios = [];

        this.historialCambios.push({
            fecha: fechaStr,
            accion: 'Medicamento registrado',
            detalle: `Registrado: ${this.medicamento.nombrecomercial}`,
            usuario: 'Sistema'
        });

        if (this.medicamento.laboratorio) {
            this.historialCambios.push({
                fecha: fechaStr,
                accion: 'Laboratorio asignado',
                detalle: `Laboratorio: ${this.medicamento.laboratorio}`,
                usuario: 'Sistema'
            });
        }

        if (this.tratamientosAsociados.length > 0) {
            const activos = this.tratamientosAsociados.filter(t => t.activo).length;
            this.historialCambios.push({
                fecha: fechaStr,
                accion: 'Tratamientos asociados',
                detalle: `${this.tratamientosAsociados.length} tratamientos (${activos} activos)`,
                usuario: 'Sistema'
            });

            this.tratamientosAsociados.forEach(t => {
                const estado = t.activo ? 'Activo' : 'Inactivo';
                this.historialCambios.push({
                    fecha: t.fechaInicio || fechaStr,
                    accion: `Tratamiento ${estado}`,
                    detalle: `Paciente: ${t.paciente} - Dosis: ${t.dosis} - ${t.fechaInicio} al ${t.fechaFin}`,
                    usuario: 'Sistema'
                });
            });
        }

        this.historialCambios.sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });
    }

    onVolver() {
        this.volver.emit();
    }
}