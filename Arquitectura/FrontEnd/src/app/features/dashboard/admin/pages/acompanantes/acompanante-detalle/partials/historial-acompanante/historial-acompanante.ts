import { Component, Input, OnChanges, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface HistorialItem {
    fecha: string;
    accion: string;
    detalle: string;
    usuario: string;
    tipo?: 'visita' | 'cita' | 'tratamiento' | 'medicamento' | 'paciente' | 'doctor';
    id?: number;
    estado?: string;
}

@Component({
    selector: 'app-historial-acompanante',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './historial-acompanante.html',
    styleUrls: ['./historial-acompanante.css']
})
export class HistorialAcompanante implements OnChanges {
    private cdr = inject(ChangeDetectorRef);

    @Input() historialCambios: HistorialItem[] = [];
    @Input() visitasAcompanante: any[] = [];
    @Input() estadisticas: {
        totalVisitas: number;
        visitasCompletadas: number;
        visitasPendientes: number;
        visitasCanceladas: number;
        ultimaVisita: string | null;
        proximaVisita: string | null;
    } | null = null;

    @Input() acompananteId: number | null = null;
    @Input() isLoading: boolean = false;

    historialMostrar: HistorialItem[] = [];
    mostrarTodos: boolean = false;

    ngOnChanges(changes: SimpleChanges) {
        if (changes['historialCambios']) {
            this.inicializarDatos();
        }
        if (changes['estadisticas']) {
            this.cdr.detectChanges();
        }
        if (changes['visitasAcompanante']) {
            this.cdr.detectChanges();
        }
    }

    private inicializarDatos() {
        if (this.historialCambios && this.historialCambios.length > 0) {
            this.historialMostrar = [...this.historialCambios];
            this.historialMostrar.sort((a, b) => {
                return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
            });
        } else {
            this.historialMostrar = [];
        }
        this.cdr.detectChanges();
    }

    getHistorialVisible(): HistorialItem[] {
        if (this.mostrarTodos) {
            return this.historialMostrar;
        }
        return this.historialMostrar.slice(0, 10);
    }

    getTotalEventos(): number {
        return this.historialMostrar.length;
    }

    getEventosRestantes(): number {
        return Math.max(0, this.historialMostrar.length - 10);
    }

    toggleMostrarTodos() {
        this.mostrarTodos = !this.mostrarTodos;
    }

    getEstadisticasMostrar() {
        return this.estadisticas;
    }

    getVisitasMostrar() {
        return this.visitasAcompanante || [];
    }

    getIconoPorTipo(tipo?: string): string {
        switch (tipo) {
            case 'cita': return 'bi-calendar-event';
            case 'analisis': return 'bi-heart-pulse';
            case 'tratamiento': return 'bi-prescription';
            case 'medicamento': return 'bi-capsule';
            case 'paciente': return 'bi-person-plus';
            case 'doctor': return 'bi-person-badge';
            default: return 'bi-clock-history';
        }
    }

    getColorPorTipo(tipo?: string): string {
        switch (tipo) {
            case 'cita': return '#4f46e5';
            case 'analisis': return '#dc3545';
            case 'tratamiento': return '#0d6efd';
            case 'medicamento': return '#198754';
            case 'paciente': return '#6f42c1';
            case 'doctor': return '#b0001e';
            default: return '#6c757d';
        }
    }

    getBadgeClass(tipo?: string): string {
        switch (tipo) {
            case 'cita': return 'badge-cita';
            case 'analisis': return 'badge-analisis';
            case 'tratamiento': return 'badge-tratamiento';
            case 'medicamento': return 'badge-medicamento';
            case 'paciente': return 'badge-paciente';
            case 'doctor': return 'badge-doctor';
            default: return 'badge-default';
        }
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return 'Fecha no disponible';
        try {
            const d = new Date(fecha);
            if (isNaN(d.getTime())) return fecha;

            const hoy = new Date();
            const diff = hoy.getTime() - d.getTime();
            const minutos = Math.floor(diff / 60000);
            const horas = Math.floor(diff / 3600000);
            const dias = Math.floor(diff / 86400000);

            if (minutos < 1) return 'Hace unos segundos';
            if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
            if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
            if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;

            return d.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return fecha;
        }
    }
}