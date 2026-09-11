import { PrinterDevice } from './printerTypes';

export class UsbPrinterDriver {
  private device: USBDevice | null = null;
  private endpointOut: number = 1;

  public async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  public async requestDevice(): Promise<PrinterDevice> {
    if (!await this.isSupported()) {
      throw new Error('WebUSB is not supported in this browser. Please use Chrome or Edge.');
    }

    try {
      const usbDevice = await navigator.usb!.requestDevice({
        filters: []
      });

      this.device = usbDevice;
      return {
        id: usbDevice.serialNumber || `usb-${Date.now()}`,
        name: usbDevice.productName || `USB Thermal Printer (${usbDevice.vendorId}:${usbDevice.productId})`,
        type: 'usb',
        rawDevice: usbDevice
      };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to select USB printer device');
    }
  }

  public async connect(printerDevice?: PrinterDevice): Promise<void> {
    if (printerDevice?.rawDevice && 'open' in printerDevice.rawDevice) {
      this.device = printerDevice.rawDevice as USBDevice;
    }

    if (!this.device) {
      throw new Error('No USB device selected. Please pair first.');
    }

    try {
      if (!this.device.opened) {
        await this.device.open();
      }

      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      const intf = this.device.configurations[0]?.interfaces[0];
      if (!intf) {
        throw new Error('No valid USB interface found on printer');
      }

      const intfNumber = intf.interfaceNumber;
      if (this.device.configuration && this.device.configuration.interfaces[intfNumber]?.claimed === false) {
        await this.device.claimInterface(intfNumber);
      }

      const endpoint = intf.alternates[0]?.endpoints.find(e => e.direction === 'out');
      if (endpoint) {
        this.endpointOut = endpoint.endpointNumber;
      }
    } catch (err: any) {
      throw new Error(`USB Connection Error: ${err.message || 'Unable to open USB device'}`);
    }
  }

  public async sendData(data: Uint8Array): Promise<void> {
    if (!this.device || !this.device.opened) {
      await this.connect();
    }

    if (!this.device) {
      throw new Error('USB printer is not connected.');
    }

    try {
      const chunkSize = 64;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.device.transferOut(this.endpointOut, chunk);
      }
    } catch (err: any) {
      throw new Error(`USB Print Failed: ${err.message || 'Transfer failed'}`);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.device) {
      try {
        if (this.device.opened) {
          await this.device.close();
        }
      } catch (e) {
        console.error(e);
      }
      this.device = null;
    }
  }
}
