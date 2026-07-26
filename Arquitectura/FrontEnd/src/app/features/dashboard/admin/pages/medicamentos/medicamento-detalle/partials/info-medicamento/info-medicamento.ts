import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../../../../../core/services/users.service';
import { firstValueFrom } from 'rxjs';
import { Medicamento, EstadisticasMedicamento } from '../../medicamento-detalle';

@Component({
    selector: 'app-info-medicamento',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './info-medicamento.html',
    styleUrls: ['./info-medicamento.css']
})
export class InfoMedicamento {
    private usersService = inject(Users);
    private cdr = inject(ChangeDetectorRef);

    @Input() medicamento!: Medicamento;
    @Output() guardar = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();

    isSaving = false;
    estadisticas: EstadisticasMedicamento | null = null;
    cargandoEstadisticas = false;

    // Cache para saber qué medicamento está cargado
    private ultimoIdCargado: number | null = null;

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

    async cargarDatos(idMedicamento: number) {
        // Si ya tenemos datos de este medicamento y no es una recarga forzada, no hacer nada
        if (this.ultimoIdCargado === idMedicamento && this.estadisticas) {
            console.log('Datos ya cargados para el medicamento:', idMedicamento);
            return;
        }

        // Si es un medicamento diferente, resetear y cargar
        if (this.ultimoIdCargado !== idMedicamento) {
            this.estadisticas = null;
            this.ultimoIdCargado = idMedicamento;
        }

        await this.cargarEstadisticas(idMedicamento);
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
                    totalTratamientos: response.totalTratamientos ?? 0,
                    tratamientosActivos: response.tratamientosActivos ?? 0,
                    ultimoUso: response.ultimoUso || null,
                    pacientesActivos: response.pacientesActivos ?? 0
                };
                console.log('Estadísticas cargadas:', this.estadisticas);
            } else {
                this.estadisticas = {
                    totalTratamientos: 0,
                    tratamientosActivos: 0,
                    ultimoUso: null,
                    pacientesActivos: 0
                };
            }
        } catch (error) {
            console.warn('No se pudieron cargar estadísticas:', error);
            this.estadisticas = {
                totalTratamientos: 0,
                tratamientosActivos: 0,
                ultimoUso: null,
                pacientesActivos: 0
            };
        } finally {
            this.cargandoEstadisticas = false;
            this.cdr.detectChanges();
        }
    }

    validarCampos(): { valido: boolean; mensaje: string } {
        if (!this.medicamento) {
            return { valido: false, mensaje: 'No hay medicamento seleccionado' };
        }

        const m = this.medicamento;

        if (!m.nombrecomercial || m.nombrecomercial.trim().length < 2) {
            return { valido: false, mensaje: 'El nombre comercial debe tener al menos 2 caracteres' };
        }

        if (!m.presentacion || m.presentacion.trim().length < 2) {
            return { valido: false, mensaje: 'La presentación es obligatoria' };
        }

        return { valido: true, mensaje: '' };
    }

    formatearIndicaciones(texto: string): string {
        if (!texto) return '';
        return texto.split('. ').map(oracion =>
            oracion.charAt(0).toUpperCase() + oracion.slice(1)
        ).join('. ');
    }

    async guardarCambios(): Promise<{ exito: boolean; mensaje: string }> {
        if (!this.medicamento) {
            return { exito: false, mensaje: 'No hay medicamento seleccionado' };
        }

        const id = this.medicamento.idmedicamento;
        if (!id) {
            return { exito: false, mensaje: 'Error: No se encontró el identificador del medicamento.' };
        }

        const nombreComercial = (this.medicamento.nombrecomercial || '').trim();
        if (!nombreComercial) {
            return { exito: false, mensaje: 'El nombre comercial del medicamento es obligatorio.' };
        }

        const validacion = this.validarCampos();
        if (!validacion.valido) {
            return { exito: false, mensaje: validacion.mensaje };
        }

        this.isSaving = true;
        this.cdr.detectChanges();

        try {
            const payload = {
                nombreComercial: nombreComercial,
                sustanciaActiva: (this.medicamento.sustanciaactiva || '').trim(),
                presentacion: (this.medicamento.presentacion || '').trim(),
                concentracion: (this.medicamento.concentracion || '').trim(),
                laboratorio: (this.medicamento.laboratorio || '').trim(),
                indicacionesGenerales: (this.medicamento.indicacionesgenerales || '').trim()
            };

            await firstValueFrom(this.usersService.actualizarMedicamento(id, payload));

            // Forzar recarga después de guardar
            this.ultimoIdCargado = null;
            await this.cargarEstadisticas(id);

            return { exito: true, mensaje: '¡Éxito! El medicamento ha sido actualizado correctamente.' };
        } catch (error: any) {
            console.error("Error al guardar cambios del medicamento:", error);
            const msgErr = error.error?.error || error.message || "Error interno del servidor";
            return { exito: false, mensaje: `No se pudo guardar: ${msgErr}` };
        } finally {
            this.isSaving = false;
            this.cdr.detectChanges();
        }
    }

    onGuardar() {
        this.guardar.emit();
    }

    onVolver() {
        this.volver.emit();
    }
}