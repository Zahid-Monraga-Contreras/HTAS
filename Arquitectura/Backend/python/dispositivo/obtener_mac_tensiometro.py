import asyncio
from datetime import datetime
from bleak import BleakScanner, BleakClient

# --- CONFIGURACIÓN ---
# UUIDs correctos para tu dispositivo FEMMTO KF-DT65X
BPM_SERVICE_UUID = "cdeacd80-5235-4c07-8846-93a37ee6b86d"
BPM_MEASUREMENT_UUID = "cdeacd81-5235-4c07-8846-93a37ee6b86d"

# Nombres comunes para dispositivos de presión arterial
DEVICE_NAME_PATTERNS = ["FEMMTO", "BPM", "BP", "MEDISANA", "OMRON", "BEURER", "BLEMODULE", "KF-DT"]

# Evento que se activa cuando ya se obtuvo una medición válida.
# Se inicializa dentro de main() porque necesita el event loop de asyncio ya corriendo.
medicion_lista = None


def mostrar_mac(nombre, mac):
    """Imprime la dirección MAC del dispositivo bien visible"""
    print("\n" + "#" * 60)
    print("   DIRECCION MAC DEL DISPOSITIVO")
    print(f"   Nombre: {nombre}")
    print(f"   MAC:    {mac}")
    print("#" * 60)


async def encontrar_dispositivo():
    """Escanea y devuelve (nombre, mac) del tensiómetro compatible elegido"""
    print("\n[INFO] Escaneando dispositivos Bluetooth...")
    print("[INFO] Asegurate de que el tensiometro este ENCENDIDO")
    print("[INFO] Manten presionado START 3 segundos para activar el Bluetooth\n")

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

    if not dispositivos_compatibles:
        print("\n[ERROR] No se encontraron dispositivos compatibles")
        print("[INFO] Sugerencias:")
        print("   1. Enciende el tensiometro (presiona START)")
        print("   2. Espera a que termine la medicion")
        print("   3. Manten presionado START por 3 segundos para activar Bluetooth")
        print("   4. Acerca el tensiometro a la computadora")
        print("   5. Verifica que el Bluetooth de la PC este activado")
        print("   6. Revisa la lista de arriba: si tu tensiometro aparece con otro")
        print("      nombre, esa direccion entre parentesis es su MAC")
        return None

    print(f"\n[OK] Encontrados {len(dispositivos_compatibles)} dispositivos compatibles:")
    for i, (nombre, mac) in enumerate(dispositivos_compatibles, 1):
        print(f"   {i}. {nombre} ({mac})")

    if len(dispositivos_compatibles) == 1:
        return dispositivos_compatibles[0]

    try:
        seleccion = input(f"\n[INFO] Selecciona un dispositivo (1-{len(dispositivos_compatibles)}): ")
        idx = int(seleccion) - 1
        if 0 <= idx < len(dispositivos_compatibles):
            return dispositivos_compatibles[idx]
    except (ValueError, EOFError):
        pass

    print("[WARN] Seleccion invalida. Usando el primero.")
    return dispositivos_compatibles[0]


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
        sistolica = bytes_list[1] if len(bytes_list) > 1 else 0
        diastolica = bytes_list[2] if len(bytes_list) > 2 else 0
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
        print("\n[INFO] Medicion NO enviada al backend (este script solo identifica el dispositivo).")

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
    global medicion_lista

    # Inicializamos el evento aquí, dentro del event loop de asyncio.
    medicion_lista = asyncio.Event()

    print("=" * 60)
    print("IDENTIFICADOR DE TENSIOMETRO (MAC)")
    print("   Compatible con FEMMTO y otros tensiometros BLE")
    print("   No requiere ID de paciente ni envia datos al backend")
    print("=" * 60)

    # Encontrar dispositivo automáticamente
    seleccionado = await encontrar_dispositivo()
    if not seleccionado:
        print("\n[ERROR] No se encontro ningun dispositivo compatible.")
        print("[INFO] Asegurate de que el tensiometro este encendido y cerca.")
        return

    nombre, address = seleccionado

    # La MAC ya se conoce desde el escaneo, aunque la conexion falle despues
    mostrar_mac(nombre, address)

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
            mostrar_mac(device.name or nombre, device.address)

            # Buscar el servicio de presión arterial
            bpm_service = None
            for service in client.services:
                if service.uuid == BPM_SERVICE_UUID:
                    bpm_service = service
                    break

            if not bpm_service:
                print(f"[ERROR] Servicio {BPM_SERVICE_UUID} no encontrado")
                print("[INFO] Servicios que expone el dispositivo:")
                for service in client.services:
                    print(f"   - {service.uuid}")
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
            print("[INFO] ESPERANDO MEDICION (opcional)")
            print("=" * 60)
            print("   Ya tienes la MAC arriba. Si quieres, presiona START")
            print("   en el tensiometro para ver una medicion de prueba.")
            print("   Presiona Ctrl+C para salir")
            print("=" * 60 + "\n")

            await client.start_notify(characteristic, notification_handler)

            try:
                # Espera a que notification_handler active medicion_lista.
                # Si en 90s no llega nada, se libera igual.
                await asyncio.wait_for(medicion_lista.wait(), timeout=90)
                print("\n[INFO] Medicion completada, cerrando conexion...")
            except asyncio.TimeoutError:
                print("\n[WARN] Tiempo de espera agotado sin recibir medicion valida")
            except KeyboardInterrupt:
                print("\n" + "=" * 60)
                print("[INFO] DESCONECTANDO...")
                print("=" * 60)
            finally:
                try:
                    await client.stop_notify(characteristic)
                except Exception:
                    pass
                print("[OK] Desconectado")
                print("=" * 60)

    except Exception as e:
        print(f"[ERROR] Error: {e}")

    print(f"\n[OK] MAC del tensiometro: {address}")
    print("[INFO] Copiala tal cual (formato AA:BB:CC:DD:EE:FF) para vincular el dispositivo en la app.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[INFO] Programa terminado")