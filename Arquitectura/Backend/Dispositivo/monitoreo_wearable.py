import asyncio
from datetime import datetime
from bleak import BleakScanner, BleakClient

# --- CONFIGURACIÓN ---
DEVICE_ADDRESS = "0C:E7:39:1C:D0:04"

# UUIDs correctos para tu dispositivo FEMMTO KF-DT65X
BPM_SERVICE_UUID = "cdeacd80-5235-4c07-8846-93a37ee6b86d"
BPM_MEASUREMENT_UUID = "cdeacd81-5235-4c07-8846-93a37ee6b86d"

def parse_blood_pressure_data(data):
    """Parsea los datos de presión arterial del dispositivo FEMMTO"""
    print(f"📊 Datos crudos: {data.hex()} | Longitud: {len(data)}")
    
    if len(data) < 6:
        print("⚠️ Datos insuficientes")
        return None, None, None
    
    try:
        bytes_list = list(data)
        print(f"   Bytes (decimal): {bytes_list}")
        
        # Análisis del formato de datos
        # Los datos parecen tener el formato: [flags][sistólica][diastólica][pulso]...
        
        # El primer byte parece ser siempre 0x80 (flags)
        flags = bytes_list[0] if len(bytes_list) > 0 else 0
        
        # La sistólica está en el byte 1 (siempre 128 = 0x80)
        sistolica = bytes_list[1] if len(bytes_list) > 1 else 0
        
        # La diastólica está en el byte 3 (después de un byte 0x00)
        diastolica = bytes_list[3] if len(bytes_list) > 3 else 0
        
        # El pulso está en el byte 5 (después de más ceros)
        pulso = bytes_list[5] if len(bytes_list) > 5 else 0
        
        # Verificar que los valores sean razonables
        if 40 <= sistolica <= 280 and 20 <= diastolica <= 200:
            if pulso == 0:
                # Intentar buscar el pulso en otra posición
                if len(bytes_list) > 6 and bytes_list[6] > 0:
                    pulso = bytes_list[6]
                elif len(bytes_list) > 4 and bytes_list[4] > 0:
                    pulso = bytes_list[4]
            
            return sistolica, diastolica, pulso
        
        # Si los valores no son razonables, intentar otra interpretación
        if len(bytes_list) >= 6:
            sistolica = bytes_list[0] if bytes_list[0] < 200 else bytes_list[1]
            diastolica = bytes_list[2] if bytes_list[2] < 200 else bytes_list[3]
            pulso = bytes_list[4] if bytes_list[4] > 0 else bytes_list[5]
            
            if 40 <= sistolica <= 280 and 20 <= diastolica <= 200:
                return sistolica, diastolica, pulso
        
        return None, None, None
        
    except Exception as e:
        print(f"❌ Error al decodificar: {e}")
        return None, None, None

def notification_handler(sender, data):
    """Se ejecuta automáticamente cuando llega una nueva medición"""
    print("\n" + "=" * 60)
    print(f"📊 Datos recibidos de: {sender.uuid}")
    print("=" * 60)
    
    sistolica, diastolica, pulso = parse_blood_pressure_data(data)
    
    if sistolica and diastolica:
        print("=" * 60)
        print("✅ MEDICIÓN EXITOSA")
        print("=" * 60)
        print(f"   Presión Sistólica: {sistolica} mmHg")
        print(f"   Presión Diastólica: {diastolica} mmHg")
        print(f"   Pulso: {pulso} bpm")
        print(f"   Hora: {datetime.now().strftime('%H:%M:%S')}")
        print("=" * 60)
        print("\n📝 Datos listos para enviar al backend")
    else:
        print("=" * 60)
        print("⚠️ NO SE PUDO DECODIFICAR")
        print("=" * 60)
        print(f"   Datos en hexadecimal: {data.hex()}")
        print(f"   Datos en decimal: {list(data)}")
        print("=" * 60)

async def main():
    print("=" * 60)
    print("🩺 MONITOR DE PRESIÓN ARTERIAL FEMMTO KF-DT65X")
    print("=" * 60)
    
    print(f"\n🔍 Buscando dispositivo {DEVICE_ADDRESS}...")
    device = await BleakScanner.find_device_by_address(DEVICE_ADDRESS, timeout=10)
    if not device:
        print(f"❌ Dispositivo {DEVICE_ADDRESS} no encontrado")
        return
    
    print(f"✅ Dispositivo encontrado: {device.name}")
    print("🔗 Conectando...")
    
    try:
        async with BleakClient(device) as client:
            print(f"✅ Conectado a {device.address}")
            
            # Verificar servicios
            services = client.services
            
            # Buscar el servicio de presión arterial
            bpm_service = None
            for service in services:
                if service.uuid == BPM_SERVICE_UUID:
                    bpm_service = service
                    break
            
            if not bpm_service:
                print(f"❌ Servicio {BPM_SERVICE_UUID} no encontrado")
                return
            
            print(f"✅ Servicio encontrado: {bpm_service.uuid}")
            
            # Obtener característica de medición
            characteristic = None
            for char in bpm_service.characteristics:
                if char.uuid == BPM_MEASUREMENT_UUID:
                    characteristic = char
                    break
            
            if not characteristic:
                print(f"❌ Característica {BPM_MEASUREMENT_UUID} no encontrada")
                return
            
            print(f"✅ Característica de medición encontrada: {characteristic.uuid}")
            print("\n" + "=" * 60)
            print("📡 ESPERANDO MEDICIÓN")
            print("=" * 60)
            print("   ¡Tómate la presión ahora!")
            print("   Los datos se mostrarán automáticamente")
            print("   Presiona Ctrl+C para salir")
            print("=" * 60 + "\n")
            
            await client.start_notify(characteristic, notification_handler)
            
            try:
                await asyncio.Event().wait()
            except KeyboardInterrupt:
                print("\n" + "=" * 60)
                print("👋 DESCONECTANDO...")
                await client.stop_notify(characteristic)
                print("✅ Desconectado")
                print("=" * 60)
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Programa terminado")