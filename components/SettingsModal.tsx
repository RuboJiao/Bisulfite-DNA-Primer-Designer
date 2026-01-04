
import React, { useState } from 'react';
import { ThermodynamicSettings } from '../types';

interface SettingsModalProps {
  settings: ThermodynamicSettings;
  onSave: (settings: ThermodynamicSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<ThermodynamicSettings>({ ...settings });

  const handleChange = (key: keyof ThermodynamicSettings, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setLocalSettings(prev => ({ ...prev, [key]: num }));
    } else if (val === '') {
      setLocalSettings(prev => ({ ...prev, [key]: 0 }));
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-[400px] overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
            </div>
            <h3 className="font-black text-slate-800 tracking-tight text-sm">Tm 计算参数设置</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-600 tracking-tight">Oligo Conc</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" step="0.1"
                  value={localSettings.oligoConc}
                  onChange={(e) => handleChange('oligoConc', e.target.value)}
                  className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-right"
                />
                <span className="text-[10px] font-bold text-slate-400 w-8">µM</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-600 tracking-tight">Na+ Conc</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" step="1"
                  value={localSettings.naConc}
                  onChange={(e) => handleChange('naConc', e.target.value)}
                  className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-right"
                />
                <span className="text-[10px] font-bold text-slate-400 w-8">mM</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-600 tracking-tight">Mg++ Conc</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" step="0.1"
                  value={localSettings.mgConc}
                  onChange={(e) => handleChange('mgConc', e.target.value)}
                  className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-right"
                />
                <span className="text-[10px] font-bold text-slate-400 w-8">mM</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-600 tracking-tight">dNTPs Conc</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" step="0.1"
                  value={localSettings.dntpConc}
                  onChange={(e) => handleChange('dntpConc', e.target.value)}
                  className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-right"
                />
                <span className="text-[10px] font-bold text-slate-400 w-8">mM</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
             <button 
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
             >
               取消
             </button>
             <button 
                onClick={() => onSave(localSettings)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
             >
               应用设置
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
