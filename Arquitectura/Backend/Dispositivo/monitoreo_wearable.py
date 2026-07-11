import asyncio
import json
import requests
import sys
from datetime import datetime
from bleak import BleakScanner, BleakClient

# --- CONFIGURACIÓN ---
DEVICE_ADDRESS = None  # Se obtendrá por escaneo

# UUIDs correctos para tu dispositivo FEMMTO KF-DT65X
BPM_SERVICE_UUID = "cdeacd80-5235-4c07-8846-93a37ee6b86d"
BPM_MEASUREMENT_UUID = "cdeacd81-5235-4c07-8846-93a37ee6b86d"

# Nombres comunes para dispositivos de presión arterial
DEVICE_NAME_PATTERNS = ["FEMMTO", "BPM", "BP", "MEDISANA", "OMRON", "BEURER", "BLEMODULE", "KF-DT"]

# --- CONFIGURACIÓN DEL BACKEND ---
BACKEND_URL = "http://localhost:3000/api/mediciones"

# ID del paciente (se pasa como argumento)
ID_PACIENTE = None

# Evento que se activa cuando ya se obtuvo una medición válida.
# Se inicializa dentro de main() porque necesita el event loop de asyncio ya corriendo.
medicion_lista = None

def get_patient_id():
    """Obtiene el ID del paciente desde argumentos"""
    global ID_PACIENTE
    if len(sys.argv) > 1:
        try:
            ID_PACIENTE = int(sys.argv[1])
            print(f"[OK] ID del paciente: {ID_PACIENTE}")
            return ID_PACIENTE
        except ValueError:
            print("[ERROR] El argumento debe ser un numero entero")
            print("[INFO] Uso: python monitoreo_wearable.py [ID_PACIENTE]")
            sys.exit(1)
    else:
        print("[ERROR] Se requiere el ID del paciente como argumento")
        print("[INFO] Uso: python monitoreo_wearable.py [ID_PACIENTE]")
        sys.exit(1)

async def encontrar_dispositivo():
    """Escanea y encuentra el primer tensiómetro compatible"""
    print("\n[INFO] Escaneando dispositivos Bluetooth...")
    print("[INFO] Asegurate de que el tensiometro este ENCENDIDO")
    print("[INFO] Presiona START en el tensiometro si es necesario\n")
    
    devices = await BleakScanner.discover(timeout=12)
    
    print("[INFO] Dispositivos encontrados:")
    dispositivos_compatibles = []
    
    for d in devices:
        nombre = d.name if d.name else "(Sin nombre)"
        print(f"   - {nombre} ({d.address})")
        if d.name:
            nombre_upper = d.name.upper()
            for pattern in DEVICE_NAME_PATTERNS:
                if pattern.upper() in nombre_upper:
                    dispositivos_compatibles.append((d.name, d.address))
                    break
    
    if dispositivos_compatibles:
        print(f"\n[OK] Encontrados {len(dispositivos_compatibles)} dispositivos compatibles:")
        for i, (nombre, mac) in enumerate(dispositivos_compatibles, 1):
            print(f"   {i}. {nombre} ({mac})")
        
        if len(dispositivos_compatibles) > 1:
            try:
                seleccion = input(f"\n[INFO] Selecciona un dispositivo (1-{len(dispositivos_compatibles)}): ")
                idx = int(seleccion) - 1
                if 0 <= idx < len(dispositivos_compatibles):
                    nombre, mac = dispositivos_compatibles[idx]
                    print(f"[OK] Seleccionado: {nombre} ({mac})")
                    return mac
                else:
                    print("[WARN] Seleccion invalida. Usando el primero.")
                    return dispositivos_compatibles[0][1]
            except:
                print("[WARN] Seleccion invalida. Usando el primero.")
                return dispositivos_compatibles[0][1]
        else:
            return dispositivos_compatibles[0][1]
    else:
        print("\n[ERROR] No se encontraron dispositivos compatibles")
        print("[INFO] Sugerencias:")
        print("   1. Enciende el tensiometro (presiona START)")
        print("   2. Espera a que termine la medicion")
        print("   3. Manten presionado START por 3 segundos para activar Bluetooth")
        print("   4. Acerca el tensiometro a la computadora")
        print("   5. Verifica que el Bluetooth de la PC este activado")
        return None

def parse_blood_pressure_data(data):
    """
    Parsea los datos de presión arterial del dispositivo FEMMTO
    Formato: [flags][SYS][DIA][PULSO]...
    Ejemplo: [129, 117, 73, 87, 0, ...] -> SYS=117, DIA=73, PULSO=87
    """
    print(f"[INFO] Datos crudos: {data.hex()} | Longitud: {len(data)}")
    
    if len(data) < 4:
        print("[WARN] Datos insuficientes")
        return None, None, None
    
    try:
        bytes_list = list(data)
        print(f"   Bytes (decimal): {bytes_list}")
        
        # Formato: [flags][SYS][DIA][PULSO]
        flags = bytes_list[0] if len(bytes_list) > 0 else 0
        
        # Sistólica está en el byte 1
        sistolica = bytes_list[1] if len(bytes_list) > 1 else 0
        
        # Diastólica está en el byte 2
        diastolica = bytes_list[2] if len(bytes_list) > 2 else 0
        
        # Pulso está en el byte 3
        pulso = bytes_list[3] if len(bytes_list) > 3 else 0
        
        # Si el pulso es 0, buscar en otros bytes
        if pulso == 0:
            for i in range(4, min(8, len(bytes_list))):
                if 30 <= bytes_list[i] <= 160:
                    pulso = bytes_list[i]
                    print(f"   [PULSO] Detectado en byte {i}: {pulso}")
                    break
        
        # Verificar que los valores sean razonables
        if 40 <= sistolica <= 280 and 30 <= diastolica <= 200:
            if pulso == 0:
                print("[INFO] No se detecto pulso")
            
            print(f"   [OK] SYS={sistolica}, DIA={diastolica}, PULSO={pulso}")
            return sistolica, diastolica, pulso
        
        # Intentar otra interpretación: [flags][0][DIA][0][SYS][PULSO]...
        if len(bytes_list) >= 5:
            sistolica_alt = bytes_list[4] if len(bytes_list) > 4 else 0
            diastolica_alt = bytes_list[2] if len(bytes_list) > 2 else 0
            pulso_alt = bytes_list[5] if len(bytes_list) > 5 else 0
            
            if 40 <= sistolica_alt <= 280 and 30 <= diastolica_alt <= 200:
                if pulso_alt == 0 and len(bytes_list) > 6:
                    pulso_alt = bytes_list[6]
                if 30 <= pulso_alt <= 160 or pulso_alt == 0:
                    print(f"   [OK] SYS={sistolica_alt}, DIA={diastolica_alt}, PULSO={pulso_alt}")
                    return sistolica_alt, diastolica_alt, pulso_alt
        
        print("[ERROR] No se pudo decodificar los datos")
        return None, None, None
        
    except Exception as e:
        print(f"[ERROR] Error al decodificar: {e}")
        return None, None, None

def enviar_al_backend(sistolica, diastolica, pulso):
    """Envía los datos al backend"""
    pulso_valor = pulso if pulso else 0
    
    payload = {
        "idPaciente": ID_PACIENTE,
        "sistolica": sistolica,
        "diastolica": diastolica,
        "pulso": pulso_valor,
        "metodoSincronizacion": "Bluetooth"
    }
    
    print("\n[INFO] Enviando al backend:")
    print(f"   URL: {BACKEND_URL}")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=10)
        print(f"\n[INFO] Respuesta del backend:")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 201:
            print("[OK] Datos enviados correctamente")
            try:
                print(f"   Respuesta: {json.dumps(response.json(), indent=2)}")
            except:
                print(f"   Respuesta: {response.text}")
            return True
        else:
            print(f"[ERROR] Error: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False

def notification_handler(sender, data):
    """Se ejecuta automáticamente cuando llega una nueva medición"""
    print("\n" + "=" * 60)
    print(f"[INFO] Datos recibidos de: {sender.uuid}")
    print("=" * 60)
    
    sistolica, diastolica, pulso = parse_blood_pressure_data(data)
    
    if sistolica and diastolica:
        print("=" * 60)
        print("[OK] MEDICION EXITOSA")
        print("=" * 60)
        print(f"   Presion Sistolica: {sistolica} mmHg")
        print(f"   Presion Diastolica: {diastolica} mmHg")
        print(f"   Pulso: {pulso} bpm")
        print(f"   Hora: {datetime.now().strftime('%H:%M:%S')}")
        print("=" * 60)
        print("\n[INFO] Enviando al backend...")
        enviar_al_backend(sistolica, diastolica, pulso)

        # NUEVO: avisamos que ya tenemos la medición para que main() pueda
        # cerrar la conexión y terminar el script de inmediato, en vez de
        # quedarse esperando para siempre (lo cual hacia que el backend
        # tardara hasta 2 minutos en responder al frontend).
        if medicion_lista is not None:
            medicion_lista.set()

        return True
    else:
        print("=" * 60)
        print("[ERROR] NO SE PUDO DECODIFICAR")
        print("=" * 60)
        print(f"   Datos en hexadecimal: {data.hex()}")
        print(f"   Datos en decimal: {list(data)}")
        print("=" * 60)
        return False

async def main():
    global ID_PACIENTE, medicion_lista

    # NUEVO: inicializamos el evento aquí, dentro del event loop de asyncio.
    medicion_lista = asyncio.Event()
    
    print("=" * 60)
    print("MONITOR DE PRESION ARTERIAL")
    print("   Compatible con FEMMTO y otros tensiometros BLE")
    print("=" * 60)
    
    # Obtener ID del paciente
    ID_PACIENTE = get_patient_id()
    print(f"\n[INFO] ID del Paciente: {ID_PACIENTE}")
    print(f"[INFO] Backend URL: {BACKEND_URL}")
    
    # Encontrar dispositivo automáticamente
    address = await encontrar_dispositivo()
    if not address:
        print("\n[ERROR] No se encontro ningun dispositivo compatible.")
        print("[INFO] Asegurate de que el tensiometro este encendido y cerca.")
        return
    
    print(f"\n[INFO] Conectando a {address}...")
    device = await BleakScanner.find_device_by_address(address, timeout=10)
    if not device:
        print(f"[ERROR] Dispositivo {address} no encontrado")
        return
    
    print(f"[OK] Dispositivo encontrado: {device.name}")
    print("[INFO] Conectando...")
    
    try:
        async with BleakClient(device) as client:
            print(f"[OK] Conectado a {device.address}")
            
            # Verificar servicios
            services = client.services
            
            # Buscar el servicio de presión arterial
            bpm_service = None
            for service in services:
                if service.uuid == BPM_SERVICE_UUID:
                    bpm_service = service
                    break
            
            if not bpm_service:
                print(f"[ERROR] Servicio {BPM_SERVICE_UUID} no encontrado")
                return
            
            print(f"[OK] Servicio encontrado: {bpm_service.uuid}")
            
            # Obtener característica de medición
            characteristic = None
            for char in bpm_service.characteristics:
                if char.uuid == BPM_MEASUREMENT_UUID:
                    characteristic = char
                    break
            
            if not characteristic:
                print(f"[ERROR] Característica {BPM_MEASUREMENT_UUID} no encontrada")
                return
            
            print(f"[OK] Característica de medición encontrada: {characteristic.uuid}")
            print("\n" + "=" * 60)
            print("[INFO] ESPERANDO MEDICION")
            print("=" * 60)
            print("   Presiona START en el tensiometro")
            print("   Los datos se mostraran y enviaran automaticamente")
            print("   Presiona Ctrl+C para salir")
            print("=" * 60 + "\n")
            
            await client.start_notify(characteristic, notification_handler)
            
            try:
                # NUEVO: en vez de esperar para siempre, esperamos a que
                # notification_handler active medicion_lista (ya guardó la
                # medición en el backend). Si en 90s no llega nada, se
                # libera igual para no dejar el proceso colgado.
                await asyncio.wait_for(medicion_lista.wait(), timeout=90)
                print("\n[INFO] Medicion completada, cerrando conexion...")
            except asyncio.TimeoutError:
                print("\n[WARN] Tiempo de espera agotado sin recibir medicion valida")
            except KeyboardInterrupt:
                print("\n" + "=" * 60)
                print("[INFO] DESCONECTANDO...")
                print("=" * 60)
            finally:
                await client.stop_notify(characteristic)
                print("[OK] Desconectado")
                print("=" * 60)
                
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[INFO] Programa terminado")