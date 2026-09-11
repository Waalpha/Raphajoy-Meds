export type PrinterType = 'usb' | 'bluetooth';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrinterDevice {
  id: string;
  name: string;
  type: PrinterType;
  rawDevice?: USBDevice | BluetoothDevice;
}

export interface PrinterConnectionState {
  type: PrinterType;
  status: PrinterStatus;
  device: PrinterDevice | null;
  error: string | null;
  lastTestedAt?: string;
}

export interface PrinterDiagnostics {
  usbSupported: boolean;
  bluetoothSupported: boolean;
  bluetoothProtocolNote: string;
}
