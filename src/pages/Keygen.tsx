import React, { useState } from 'react';
import { generateLicensePin } from '../utils/license';
import { Key, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Keygen() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [machineId, setMachineId] = useState('');
  const [pin, setPin] = useState('');
  const [copied, setCopied] = useState(false);

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-4 rounded-full text-gray-600">
              <Key className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
            Acceso Restringido
          </h1>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña de Administrador"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password === 'DEV99887766') {
                  setUnlocked(true);
                } else if (e.key === 'Enter') {
                  toast.error('Contraseña incorrecta');
                }
              }}
            />
            <button
              onClick={() => {
                if (password === 'DEV99887766') {
                  setUnlocked(true);
                } else {
                  toast.error('Contraseña incorrecta');
                }
              }}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition-all"
            >
              Desbloquear
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGenerate = () => {
    if (!machineId) {
      toast.error('Ingresa un ID de Equipo válido');
      return;
    }
    const generated = generateLicensePin(machineId);
    setPin(generated);
  };

  const handleCopy = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    toast.success('PIN copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full text-blue-600">
            <Key className="w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          Generador de Licencias
        </h1>
        <p className="text-center text-gray-500 mb-8">
          Herramienta exclusiva para administradores. Ingresa el ID de Equipo del cliente para generar su PIN Maestro permanente.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID de Equipo (del cliente)
            </label>
            <input
              type="text"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value.toUpperCase())}
              placeholder="Ej. AB12CD-EF34GH"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono uppercase"
            />
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Key className="w-5 h-5" />
            Generar PIN Maestro
          </button>

          {pin && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl space-y-4">
              <label className="block text-sm font-medium text-green-800 text-center uppercase tracking-wider">
                PIN Maestro Generado
              </label>
              <div className="flex items-center justify-center gap-4">
                <span className="text-3xl font-mono font-bold text-green-600 tracking-widest">
                  {pin}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 bg-white text-green-600 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                  title="Copiar PIN"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
