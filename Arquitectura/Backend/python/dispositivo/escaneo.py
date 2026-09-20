import asyncio
from bleak import BleakScanner

async def main():
    res = await BleakScanner.discover(timeout=12, return_adv=True)
    for addr, (d, adv) in res.items():
        print(addr, "| nombre:", adv.local_name, "| rssi:", adv.rssi,
              "| uuids:", adv.service_uuids, "| fabricante:", list(adv.manufacturer_data))

asyncio.run(main())