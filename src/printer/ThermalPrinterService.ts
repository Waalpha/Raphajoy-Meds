import { PrinterType, PrinterDevice, PrinterConnectionState } from './printerTypes';
import { UsbPrinterDriver } from './UsbPrinterDriver';
import { BluetoothPrinterDriver } from './BluetoothPrinterDriver';
import { EscPosFormatter } from './EscPosFormatter';
import { Sale, BusinessConfig } from '../types';

export class ThermalPrinterService {
  private static instance: ThermalPrinterService;
  private usbDriver = new UsbPrinterDriver();
  private btDriver = new BluetoothPrinterDriver();

  private activeType: PrinterType = 'usb';
  private activeDevice: PrinterDevice | null = null;
  private connectionStatus: PrinterConnectionState['status'] = 'disconnected';
  private lastError: string | null = null;

  private constructor() {}

  public static getInstance(): ThermalPrinterService {
    if (!ThermalPrinterService.instance) {
      ThermalPrinterService.instance = new ThermalPrinterService();
    }
    return ThermalPrinterService.instance;
  }

  public async requestDevice(type: PrinterType): Promise<PrinterDevice> {
    this.activeType = type;
    this.lastError = null;
    try {
      if (type === 'usb') {
        const device = await this.usbDriver.requestDevice();
        this.activeDevice = device;
        return device;
      } else {
        const device = await this.btDriver.requestDevice();
        this.activeDevice = device;
        return device;
      }
    } catch (err: any) {
      this.lastError = err.message;
      throw err;
    }
  }

  public async connect(device?: PrinterDevice): Promise<void> {
    if (device) {
      this.activeType = device.type;
      this.activeDevice = device;
    }

    if (!this.activeDevice) {
      throw new Error('No printer device selected.');
    }

    this.connectionStatus = 'connecting';
    this.lastError = null;

    try {
      if (this.activeType === 'usb') {
        await this.usbDriver.connect(this.activeDevice);
      } else {
        await this.btDriver.connect(this.activeDevice);
      }
      this.connectionStatus = 'connected';
    } catch (err: any) {
      this.connectionStatus = 'error';
      this.lastError = err.message;
      throw err;
    }
  }

  public async testPrint(businessConfig?: BusinessConfig | null): Promise<void> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const data = EscPosFormatter.formatTestReceipt(businessConfig);

    if (this.activeType === 'usb') {
      await this.usbDriver.sendData(data);
    } else {
      await this.btDriver.sendData(data);
    }
  }

  public async printSale(sale: Sale, businessConfig?: BusinessConfig | null): Promise<void> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const data = EscPosFormatter.formatSaleReceipt(sale, businessConfig);

    if (this.activeType === 'usb') {
      await this.usbDriver.sendData(data);
    } else {
      await this.btDriver.sendData(data);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.activeType === 'usb') {
        await this.usbDriver.disconnect();
      } else {
        await this.btDriver.disconnect();
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.connectionStatus = 'disconnected';
      this.activeDevice = null;
    }
  }

  public getState(): PrinterConnectionState {
    return {
      type: this.activeType,
      status: this.connectionStatus,
      device: this.activeDevice,
      error: this.lastError
    };
  }
}

export const thermalPrinterService = ThermalPrinterService.getInstance();
