
import React from 'react';

interface HeaderProps {
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMarkMethylation: () => void;
  onAddPrimer: () => void;
  onSave: () => void;
  canMark: boolean;
  canAddPrimer: boolean;
  hasSequence: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onImport, 
  onMarkMethylation, 
  onAddPrimer, 
  onSave,
  canMark,
  canAddPrimer,
  hasSequence
}) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-50">
      <div className="flex items-center gap-2 mr-4">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">BisulfiteDesigner</h1>
      </div>

      <div className="h-8 w-px bg-gray-200 mx-2" />

      <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-all text-sm font-bold shadow-md active:scale-95">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        导入序列
        <input type="file" className="hidden" accept=".gb,.fa,.dna,.fasta,.txt,.methdna" onChange={onImport} />
      </label>

      <button 
        onClick={onMarkMethylation}
        disabled={!canMark || !hasSequence}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
          canMark && hasSequence ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
        标注为 mC
      </button>

      <button 
        onClick={onAddPrimer}
        disabled={!canAddPrimer || !hasSequence}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
          canAddPrimer && hasSequence ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        添加引物
      </button>

      <div className="flex-1" />

      <button 
        onClick={onSave}
        disabled={!hasSequence}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${
          hasSequence ? 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
        保存 (.methdna)
      </button>
    </header>
  );
};
