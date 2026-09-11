export {};

declare global {
  interface USBDevice {
    vendorId: number;
    productId: number;
    productName?: string;
    manufacturerName?: string;
    serialNumber?: string;
    opened: boolean;
    configuration: USBConfiguration | null;
    configurations: USBConfiguration[];
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  }

  interface USBConfiguration {
    configurationValue: number;
    interfaces: USBInterface[];
  }

  interface USBInterface {
    interfaceNumber: number;
    alternate: USBAlternateInterface;
    alternates: USBAlternateInterface[];
    claimed: boolean;
  }

  interface USBAlternateInterface {
    alternateSetting: number;
    interfaceClass: number;
    interfaceSubclass: number;
    interfaceProtocol: number;
    endpoints: USBEndpoint[];
  }

  interface USBEndpoint {
    endpointNumber: number;
    direction: 'in' | 'out';
    type: 'bulk' | 'interrupt' | 'isochronous';
    packetSize: number;
  }

  interface USBOutTransferResult {
    bytesWritten: number;
    status: 'ok' | 'stall' | 'babble';
  }

  interface Navigator {
    usb?: {
      requestDevice(options?: { filters?: any[] }): Promise<USBDevice>;
      getDevices(): Promise<USBDevice[]>;
    };
    bluetooth?: {
      requestDevice(options?: { filters?: any[]; acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<BluetoothDevice>;
      getAvailability(): Promise<boolean>;
    };
  }

  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    properties: {
      write: boolean;
      writeWithoutResponse: boolean;
      read: boolean;
      notify: boolean;
    };
    value?: DataView;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
  }
}
