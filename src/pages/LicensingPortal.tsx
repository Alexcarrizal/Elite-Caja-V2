import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, Mail, ShieldAlert, Moon, Sun, Monitor, RefreshCw } from 'lucide-react';
import { generateLicenseKey } from '../utils/license';
import { toast } from 'sonner';

export default function LicensingPortal() {
  const [email, setEmail] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Sync theme with document class list
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      toast.error('Por favor escribe un correo electrónico de Google.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Introduce un correo electrónico válido.');
      return;
    }

    const key = generateLicenseKey(cleanEmail);
    setGeneratedKey(key);
    setCopied(false);
    toast.success('¡Llave de licencia generada con éxito!');
  };

  const handleCopy = () => {
    if (!generatedKey) return;
    
    // Robust clipboard copy with fallback (vital for iframe preview environments)
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(generatedKey)
          .then(() => {
            setCopied(true);
            toast.success('Licencia copiada al portapapeles');
            setTimeout(() => setCopied(false), 2000);
          })
          .catch((err) => {
            console.warn('navigator.clipboard failed, using fallback', err);
            fallbackCopy(generatedKey);
          });
      } else {
        fallbackCopy(generatedKey);
      }
    } catch (err) {
      console.warn('Clipboard API not available, using fallback', err);
      fallbackCopy(generatedKey);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const success = document.execCommand('copy');
      if (success) {
        setCopied(true);
        toast.success('Licencia copiada al portapapeles');
      } else {
        toast.error('No se pudo copiar automáticamente. Selecciónala y cópiala manualmente.');
      }
    } catch (err) {
      console.error('Fallback copy error', err);
      toast.error('No se pudo copiar automáticamente. Selecciónala y cópiala manualmente.');
    }
    
    document.body.removeChild(textArea);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div id="licensing-portal-root" className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-950 text-gray-100 transition-colors duration-200">
      {/* Background Decorative Blur Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/15 rounded-full blur-[120px]" />
      </div>

      <div id="licensing-portal-card-container" className="relative w-full max-w-lg z-10">
        {/* Glow boarder */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-2xl opacity-60 blur-[3px]" />
        
        <div id="licensing-portal-card" className="relative w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">
          
          {/* Top Panel Actions */}
          <div className="flex justify-between items-center border-b border-gray-800 pb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <Key className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-wider uppercase text-white">Elite Caja</h1>
                <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Portal De Claves Independiente</p>
              </div>
            </div>

            <button
              id="btn-toggle-portal-theme"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700/50"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Subheader Alert */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl space-y-1">
            <p className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wide">
              🔒 Acceso Administrativo Seguro
            </p>
            <p className="text-[11px] text-gray-400 leading-normal">
              Esta sección genera de forma autónoma claves criptográficas vinculadas al correo de Google del cliente. Evita que la misma clave pueda ser usada en otras cuentas de Google. Guarde este link privado en sus marcadores.
            </p>
          </div>

          {/* License Form */}
          <form id="license-generator-form" onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="client-email" className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                Correo Electrónico de Google del Cliente
              </label>
              <div className="relative">
                <input
                  id="client-email"
                  type="email"
                  required
                  placeholder="ejemplo@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-950/80 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors font-medium"
                />
                <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-gray-650" />
              </div>
            </div>

            <button
              id="btn-submit-generate-key"
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] text-white font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-indigo-500/10 border border-indigo-500/30"
            >
              Generar Clave de Licencia
            </button>
          </form>

          {/* Generated License Result Area */}
          {generatedKey && (
            <div id="generated-key-container" className="mt-4 p-4 bg-gray-950 border border-gray-800/80 rounded-xl space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Clave Generada Para: <span className="text-gray-300 font-mono italic capitalize-none">{email}</span></span>
                <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">Listo</span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <div className="font-mono text-sm sm:text-base font-black text-white tracking-widest bg-gray-900 border border-gray-800/80 px-4 py-2.5 rounded-xl flex-1 text-center select-all">
                  {generatedKey}
                </div>
                
                <button
                  id="btn-copy-license"
                  onClick={handleCopy}
                  className="p-3 bg-indigo-600/10 border border-indigo-500/25 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition-all"
                  title="Copiar Clave"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400 font-bold" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                El cliente deberá iniciar sesión con <span className="font-semibold text-gray-400">{email}</span> e introducir la clave anterior para activar el sistema de forma segura.
              </p>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="pt-4 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5" /> Estrictamente Administrativo
            </span>
            <span>Versión 2.1 - 2026</span>
          </div>

        </div>
      </div>
    </div>
  );
}
