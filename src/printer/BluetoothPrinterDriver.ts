import { PrinterDevice } from './printerTypes';

export class BluetoothPrinterDriver {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  public async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async requestDevice(): Promise<PrinterDevice> {
    if (!await this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser or environment.');
    }

    try {
      const btDevice = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      this.device = btDevice;
      return {
        id: btDevice.id,
        name: btDevice.name || 'Bluetooth Thermal Printer',
        type: 'bluetooth',
        rawDevice: btDevice
      };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to select Bluetooth printer. Note: If your printer is Bluetooth Classic (SPP), Windows pairing or a local print bridge is required.');
    }
  }

  public async connect(printerDevice?: PrinterDevice): Promise<void> {
    if (printerDevice?.rawDevice && 'gatt' in printerDevice.rawDevice) {
      this.device = printerDevice.rawDevice as BluetoothDevice;
    }

    if (!this.device || !this.device.gatt) {
      throw new Error('No Bluetooth device selected or GATT not supported.');
    }

    try {
      const server = await this.device.gatt.connect();
      
      let service: BluetoothRemoteGATTService | null = null;
      const serviceUuids = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ];

      for (const uuid of serviceUuids) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch (e) {
          // Try next
        }
      }

      if (!service) {
        const services = await server.getPrimaryServices();
        if (services.length > 0) {
          service = services[0];
        } else {
          throw new Error('No GATT services found on this Bluetooth device. Printer may be Bluetooth Classic (SPP) which Web Bluetooth cannot access.');
        }
      }

      const characteristics = await service.getCharacteristics();
      this.characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;

      if (!this.characteristic) {
        throw new Error('No writable characteristic found for this Bluetooth printer.');
      }
    } catch (err: any) {
      throw new Error(`Bluetooth Connection Failed: ${err.message || 'GATT connection error. Note: Bluetooth Classic (SPP) printers require USB or a local print bridge.'}`);
    }
  }

  public async sendData(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      await this.connect();
    }

    if (!this.characteristic) {
      throw new Error('Bluetooth printer characteristic is not connected.');
    }

    try {
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValueWithResponse(chunk);
        }
      }
    } catch (err: any) {
      throw new Error(`Bluetooth Print Failed: ${err.message || 'Write error'}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch (e) {
        console.error(e);
      }
    }
    this.device = null;
    this.characteristic = null;
  }
}
