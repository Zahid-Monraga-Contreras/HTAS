import { Injectable } from '@angular/core';

export interface MedicionBluetoothResult {
  sistolica: number;
  diastolica: number;
  pulso: number;
  nombreDispositivo?: string;
  direccionMac?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BluetoothService {
  // UUIDs específicos para dispositivos FEMMTO KF-DT65X y compatibles
  private readonly FEMMTO_SERVICE_UUID = 'cdeacd80-5235-4c07-8846-93a37ee6b86d';
  private readonly FEMMTO_CHARACTERISTIC_UUID = 'cdeacd81-5235-4c07-8846-93a37ee6b86d';

  // UUIDs estándar GATT de Presión Arterial (Bluetooth SIG)
  private readonly STANDARD_SERVICE_UUID = '00001810-0000-1000-8000-00805f9b34fb';
  private readonly STANDARD_CHARACTERISTIC_UUID = '00002a35-0000-1000-8000-00805f9b34fb';

  private activeDevice: any = null;
  private activeCharacteristic: any = null;

  /**
   * Verifica si el navegador actual soporta Web Bluetooth API
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Solicita al usuario seleccionar el tensiómetro, se conecta vía BLE,
   * escucha las notificaciones de medición, y resuelve con los valores obtenidos.
   *
   * @param onLog Callback opcional para mostrar mensajes en tiempo real en la UI
   * @param timeoutSegundos Tiempo máximo de espera antes de cancelar (por defecto 90s)
   */
  async solicitarMedicion(
    onLog?: (mensaje: string) => void,
    timeoutSegundos = 90
  ): Promise<MedicionBluetoothResult> {
    const log = (msg: string) => {
      console.log(`[BluetoothService] ${msg}`);
      if (onLog) {
        onLog(msg);
      }
    };

    if (!this.isSupported()) {
      throw new Error(
        'Tu navegador no soporta Web Bluetooth API. Por favor utiliza Google Chrome o Microsoft Edge en tu computadora o dispositivo Android.'
      );
    }

    log('Buscando tensiómetro Bluetooth...');
    log('Asegúrate de que el tensiómetro esté ENCENDIDO');

    let device: any = null;

    try {
      device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: 'FEMMTO' },
          { namePrefix: 'BPM' },
          { namePrefix: 'BP' },
          { namePrefix: 'MEDISANA' },
          { namePrefix: 'OMRON' },
          { namePrefix: 'BEURER' },
          { namePrefix: 'BLEMODULE' },
          { namePrefix: 'KF-DT' }
        ],
        optionalServices: [
          this.FEMMTO_SERVICE_UUID,
          this.STANDARD_SERVICE_UUID
        ]
      });
    } catch (filterError: any) {
      // Si el usuario canceló el diálogo, no reintentamos
      if (
        filterError.name === 'NotFoundError' ||
        filterError.message?.toLowerCase().includes('cancelled') ||
        filterError.message?.toLowerCase().includes('cancel')
      ) {
        throw new Error('Selección de dispositivo cancelada por el usuario');
      }

      // Reintentar mostrando todos los dispositivos como fallback
      log('Mostrando todos los dispositivos cercanos...');
      device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          this.FEMMTO_SERVICE_UUID,
          this.STANDARD_SERVICE_UUID
        ]
      });
    }

    if (!device) {
      throw new Error('No se seleccionó ningún dispositivo Bluetooth');
    }

    this.activeDevice = device;
    const deviceName = device.name || 'Tensiómetro Bluetooth';
    log(`Dispositivo seleccionado: ${deviceName}`);
    log('Conectando al dispositivo...');

    // Listener para desconexión inesperada
    device.addEventListener('gattserverdisconnected', () => {
      log('Dispositivo Bluetooth desconectado');
    });

    const server = await device.gatt.connect();
    log('Conexión BLE establecida con éxito');

    // Buscar el servicio GATT correspondiente
    let service: any = null;
    let charUuidToUse = this.FEMMTO_CHARACTERISTIC_UUID;

    try {
      service = await server.getPrimaryService(this.FEMMTO_SERVICE_UUID);
      charUuidToUse = this.FEMMTO_CHARACTERISTIC_UUID;
      log('Servicio FEMMTO detectado');
    } catch {
      try {
        service = await server.getPrimaryService(this.STANDARD_SERVICE_UUID);
        charUuidToUse = this.STANDARD_CHARACTERISTIC_UUID;
        log('Servicio estándar de Presión Arterial detectado');
      } catch (err: any) {
        this.desconectar();
        throw new Error('El dispositivo no contiene los servicios de presión arterial compatibles');
      }
    }

    // Obtener la característica de lectura/notificación
    const characteristic = await service.getCharacteristic(charUuidToUse);
    this.activeCharacteristic = characteristic;
    await characteristic.startNotifications();

    log('Esperando medición... Presiona START en el tensiómetro');

    return new Promise<MedicionBluetoothResult>((resolve, reject) => {
      let finalizado = false;

      const timerId = setTimeout(() => {
        if (!finalizado) {
          finalizado = true;
          this.limpiar(characteristic, handleNotification);
          reject(new Error('Tiempo de espera agotado sin recibir una medición válida'));
        }
      }, timeoutSegundos * 1000);

      const handleNotification = (event: any) => {
        if (finalizado) return;

        const dataView: DataView = event.target.value;
        const bytes: number[] = [];
        for (let i = 0; i < dataView.byteLength; i++) {
          bytes.push(dataView.getUint8(i));
        }

        // Si es actualización de presión durante el inflado (flags = 128 / 0x80)
        if (bytes.length >= 3 && bytes[0] === 128 && bytes[2] > 0) {
          log(`Midiendo presión... Presión actual: ${bytes[2]} mmHg`);
          return;
        }

        // Intentar decodificar medición final
        const resultado = this.parseBloodPressureData(dataView);

        if (resultado) {
          finalizado = true;
          clearTimeout(timerId);

          log(`¡Medición detectada! Sistólica: ${resultado.sistolica} mmHg | Diastólica: ${resultado.diastolica} mmHg | Pulso: ${resultado.pulso} bpm`);

          this.limpiar(characteristic, handleNotification);

          resolve({
            sistolica: resultado.sistolica,
            diastolica: resultado.diastolica,
            pulso: resultado.pulso,
            nombreDispositivo: deviceName,
            direccionMac: device.id
          });
        }
      };

      characteristic.addEventListener('characteristicvaluechanged', handleNotification);
    });
  }

  /**
   * Decodifica los bytes recibidos del tensiómetro
   */
  private parseBloodPressureData(
    dataView: DataView
  ): { sistolica: number; diastolica: number; pulso: number } | null {
    if (dataView.byteLength < 4) {
      return null;
    }

    const bytes: number[] = [];
    for (let i = 0; i < dataView.byteLength; i++) {
      bytes.push(dataView.getUint8(i));
    }

    const flags = bytes[0];
    const sistolica = bytes[1];
    const diastolica = bytes[2];
    let pulso = bytes[3];

    // Buscar pulso en otros bytes si viene en 0
    if (pulso === 0) {
      for (let i = 4; i < Math.min(8, bytes.length); i++) {
        if (bytes[i] >= 30 && bytes[i] <= 160) {
          pulso = bytes[i];
          break;
        }
      }
    }

    // Validación de rangos válidos para FEMMTO
    if (
      sistolica >= 40 &&
      sistolica <= 280 &&
      diastolica >= 30 &&
      diastolica <= 200
    ) {
      return {
        sistolica,
        diastolica,
        pulso: pulso || 0
      };
    }

    // Formato alternativo de dispositivos BLE [flags][0][DIA][0][SYS][PULSO]
    if (bytes.length >= 5) {
      const sistolicaAlt = bytes[4];
      const diastolicaAlt = bytes[2];
      let pulsoAlt = bytes.length > 5 ? bytes[5] : 0;
      if (pulsoAlt === 0 && bytes.length > 6) {
        pulsoAlt = bytes[6];
      }

      if (
        sistolicaAlt >= 40 &&
        sistolicaAlt <= 280 &&
        diastolicaAlt >= 30 &&
        diastolicaAlt <= 200
      ) {
        return {
          sistolica: sistolicaAlt,
          diastolica: diastolicaAlt,
          pulso: pulsoAlt || 0
        };
      }
    }

    return null;
  }

  /**
   * Limpieza de listeners y desconexión segura
   */
  private async limpiar(characteristic: any, listener: (ev: any) => void) {
    try {
      if (characteristic) {
        characteristic.removeEventListener('characteristicvaluechanged', listener);
        await characteristic.stopNotifications();
      }
    } catch {
      // Ignorar errores al detener notificaciones
    }

    this.desconectar();
  }

  /**
   * Desconecta el dispositivo activo
   */
  desconectar(): void {
    try {
      if (this.activeDevice && this.activeDevice.gatt && this.activeDevice.gatt.connected) {
        this.activeDevice.gatt.disconnect();
      }
    } catch (e) {
      console.warn('[BluetoothService] Error al desconectar:', e);
    } finally {
      this.activeDevice = null;
      this.activeCharacteristic = null;
    }
  }
}
