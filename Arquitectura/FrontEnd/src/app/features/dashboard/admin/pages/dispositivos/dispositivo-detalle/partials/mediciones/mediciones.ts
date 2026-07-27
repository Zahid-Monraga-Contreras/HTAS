import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MedicionTensiometro {
    id: number;
    sistolica: number;
    diastolica: number;
    pulso: number;
    fecha: string;
    guardada: boolean;
}

export interface UltimaMedicion {
    sistolica: number;
    diastolica: number;
    pulso: number;
    fechahoralectura?: string;
    fecha?: string;
}

@Component({
    selector: 'app-mediciones',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './mediciones.html',
    styleUrls: ['./mediciones.css']
})
export class Mediciones implements OnChanges {
    @Input() dispositivo: any = null;
    @Input() estadoConexion: 'conectado' | 'desconectado' | 'sincronizando' = 'desconectado';
    @Input() ultimaSincronizacion: string | null = null;
    @Input() ultimaMedicion: UltimaMedicion | null = null;
    @Input() ultimaMedicionTensiometro: { sistolica: number; diastolica: number; pulso: number; fecha: string } | null = null;
    @Input() medicionesTensiometro: MedicionTensiometro[] = [];
    @Input() progresoLog: string[] = [];
    @Input() progresoLogVisible: boolean = false;
    @Input() isObteniendoMedicion: boolean = false;
    @Input() isSaving: boolean = false;
    @Input() esPacienteOAcompanante: boolean = false;

    @Output() obtenerMedicion = new EventEmitter<void>();
    @Output() sincronizar = new EventEmitter<void>();
    @Output() volver = new EventEmitter<void>();

    // ==========================================================================
    // MÉTODO PARA FORMATEAR FECHA DE FORMA SEGURA
    // ==========================================================================

    formatearFecha(fecha: string | null | undefined): string {
        if (!fecha) {
            return 'Fecha no disponible';
        }
        try {
            const date = new Date(fecha);
            if (isNaN(date.getTime())) {
                console.warn('⚠️ Fecha inválida:', fecha);
                try {
                    const partes = fecha.split('/');
                    if (partes.length === 3) {
                        const dia = parseInt(partes[0]);
                        const mes = parseInt(partes[1]) - 1;
                        const anio = parseInt(partes[2].split(' ')[0]);
                        const horaPartes = partes[2].split(' ')[1]?.split(':') || [];
                        const horas = parseInt(horaPartes[0]) || 0;
                        const minutos = parseInt(horaPartes[1]) || 0;
                        const segundos = parseInt(horaPartes[2]) || 0;

                        const fechaObj = new Date(anio, mes, dia, horas, minutos, segundos);
                        if (!isNaN(fechaObj.getTime())) {
                            return fechaObj.toLocaleString('es-MX', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Error parseando fecha en formato DD/MM/YYYY:', e);
                }
                return 'Fecha no disponible';
            }

            return date.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('❌ Error al formatear fecha:', error);
            return 'Fecha no disponible';
        }
    }

    // ==========================================================================
    // VERIFICAR SI UNA MEDICIÓN TIENE DATOS VÁLIDOS
    // ==========================================================================

    tieneDatosValidos(med: MedicionTensiometro): boolean {
        return med &&
            med.sistolica > 0 &&
            med.diastolica > 0 &&
            med.pulso > 0 &&
            med.fecha !== null &&
            med.fecha !== undefined &&
            med.fecha !== '';
    }

    // ==========================================================================
    // CICLO DE VIDA - OnChanges
    // ==========================================================================

    ngOnChanges(changes: SimpleChanges) {
        if (changes['medicionesTensiometro']) {
            console.log('📊 Mediciones recibidas en componente:', this.medicionesTensiometro);
            if (this.medicionesTensiometro) {
                this.medicionesTensiometro.forEach((med, index) => {
                    if (!med.fecha) {
                        console.warn(`⚠️ Medición ${index + 1} sin fecha:`, med);
                    }
                });
            }
        }
        if (changes['ultimaMedicion']) {
            console.log('📈 Última medición recibida:', this.ultimaMedicion);
        }
    }

    // ==========================================================================
    // MÉTODOS DE UTILIDAD
    // ==========================================================================

    obtenerNombreCompleto(paciente: any): string {
        if (!paciente) return '';
        const nombre = paciente?.nombre || this.dispositivo?.nombrepaciente || '';
        const apPaterno = paciente?.appaterno || paciente?.apPaterno || this.dispositivo?.appaternopaciente || '';
        const apMaterno = paciente?.apmaterno || paciente?.apMaterno || this.dispositivo?.apmaternopaciente || '';
        return `${nombre} ${apPaterno} ${apMaterno}`.trim();
    }

    getEstadoConexionClass(): string {
        const clases = {
            'conectado': 'estado-conectado',
            'desconectado': 'estado-desconectado',
            'sincronizando': 'estado-sincronizando'
        };
        return clases[this.estadoConexion] || 'estado-desconectado';
    }

    getEstadoConexionTexto(): string {
        const textos = {
            'conectado': 'Conectado',
            'desconectado': 'Desconectado',
            'sincronizando': 'Sincronizando...'
        };
        return textos[this.estadoConexion] || 'Desconectado';
    }

    getEstadoConexionIcono(): string {
        const iconos = {
            'conectado': 'bi-wifi',
            'desconectado': 'bi-wifi-off',
            'sincronizando': 'bi-arrow-repeat'
        };
        return iconos[this.estadoConexion] || 'bi-wifi-off';
    }

    getEstadoBotonMedicion(): string {
        if (this.isObteniendoMedicion) return 'bi-arrow-repeat spin';
        return 'bi-heart-pulse';
    }

    getEstadoBotonTexto(): string {
        if (this.isObteniendoMedicion) return 'Obteniendo medición...';
        return 'Obtener Medición';
    }

    // ==========================================================================
    // MÉTODOS DE EVENTOS
    // ==========================================================================

    onObtenerMedicion() {
        this.obtenerMedicion.emit();
    }

    onSincronizar() {
        this.sincronizar.emit();
    }

    onVolver() {
        this.volver.emit();
    }
}