import React, { useState } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { PrinterType, PrinterConnectionState } from '../../printer/printerTypes';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { Printer, Usb, Bluetooth, CheckCircle2, AlertCircle, RefreshCw, Power } from 'lucide-react';

interface PrinterSettingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function PrinterSettingsView({ businessConfig }: PrinterSettingsViewProps) {
  const [connectionType, setConnectionType] = useState<PrinterType>('usb');
  const [state, setState] = useState<PrinterConnectionState>(thermalPrinterService.getState());
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshState = () => {
    setState(thermalPrinterService.getState());
  };

  const handlePair = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const device = await thermalPrinterService.requestDevice(connectionType);
      setActionMessage(`Selected printer: ${device.name}. Connecting...`);
      await thermalPrinterService.connect(device);
      setActionMessage(`Successfully connected to ${device.name}!`);
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Failed to pair or connect printer');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      setActionMessage('Sending test print command...');
      await thermalPrinterService.testPrint(businessConfig);
      setActionMessage('Test print sent successfully!');
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Test print failed');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      await thermalPrinterService.disconnect();
      setActionMessage('Printer disconnected.');
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Error disconnecting');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Thermal Printer Configuration & Diagnostics</h2>
        <p className="text-sm text-gray-500">Configure USB and Bluetooth 58mm thermal receipt printers</p>
      </div>

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {actionMessage && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-2xl ${state.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {state.device ? state.device.name : 'No Printer Connected'}
            </h3>
            <p className="text-xs text-gray-500">
              Status: <span className={`font-semibold capitalize ${state.status === 'connected' ? 'text-emerald-600' : 'text-emerald-600'}`}>{state.status}</span>
              {state.device && ` (${state.device.type.toUpperCase()})`}
            </p>
          </div>
        </div>
        {state.status === 'connected' && (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all cursor-pointer"
          >
            <Power className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        )}
      </div>

      {/* Connection Type Selection & Controls */}
      <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xs space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">Select Connection Type</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConnectionType('usb')}
              className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 font-bold text-sm transition-all cursor-pointer ${
                connectionType === 'usb'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Usb className="w-5 h-5 text-emerald-600" />
              <span>USB Thermal Printer</span>
            </button>

            <button
              type="button"
              onClick={() => setConnectionType('bluetooth')}
              className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 font-bold text-sm transition-all cursor-pointer ${
                connectionType === 'bluetooth'
                  ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Bluetooth className="w-5 h-5 text-blue-600" />
              <span>Bluetooth Printer</span>
            </button>
          </div>
        </div>

        {connectionType === 'bluetooth' && (
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">Bluetooth Note:</p>
            <p>Web Bluetooth supports BLE (Bluetooth Low Energy) GATT devices. If your printer is Bluetooth Classic (SPP) like P58E, browsers cannot connect directly without a local bridge. USB is recommended for direct browser printing.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handlePair}
            disabled={loading}
            className="flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            <span>{state.device ? 'Change / Reconnect' : `Connect ${connectionType.toUpperCase()} Printer`}</span>
          </button>

          <button
            onClick={handleTestPrint}
            disabled={loading || state.status !== 'connected'}
            className="flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            <span>Test Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
