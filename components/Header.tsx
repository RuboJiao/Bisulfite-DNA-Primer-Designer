
import React, { useState } from 'react';

interface HeaderProps {
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMarkMethylation: () => void;
  onAddPrimer: () => void;
  onSave: () => void;
  onSearch: (query: string, mismatches: number) => void;
  onOpenSettings: () => void;
  canMark: boolean;
  canAddPrimer: boolean;
  hasSequence: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onImport, 
  onMarkMethylation, 
  onAddPrimer, 
  onSave,
  onSearch,
  onOpenSettings,
  canMark,
  canAddPrimer,
  hasSequence
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mismatches, setMismatches] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, mismatches);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-50">
      <div className="flex items-center gap-2 mr-2 my-auto">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
        <h1 className="text-lg font-bold tracking-tight text-slate-800 whitespace-nowrap hidden lg:block">BisulfiteDesigner</h1>
      </div>

      <div className="h-6 w-px bg-gray-200 mx-1 my-auto" />

      {/* 搜索栏模块 */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xl p-0 my-auto">
        {/* 输入框容器 */}
        <div className="flex-1 h-9 bg-slate-100 rounded-lg flex items-center px-3 gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset transition-all group">
          <svg className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase().replace(/[^ATCG RYSWKMBDHVN]/g, ''))}
            placeholder="搜索序列 (支持简并碱基)..."
            disabled={!hasSequence}
            className="flex-1 w-full bg-transparent border-none outline-none text-xs font-bold dna-font placeholder:text-slate-400 text-slate-800 h-full uppercase p-0"
          />
        </div>

        {/* 下拉选择框容器 */}
        <div className="relative h-9 w-28 bg-slate-100 rounded-lg hover:bg-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset transition-all flex items-center">
          <select 
            value={mismatches}
            onChange={(e) => setMismatches(Number(e.target.value))}
            disabled={!hasSequence}
            className="w-full h-full bg-transparent pl-3 pr-8 text-[10px] font-black outline-none appearance-none cursor-pointer text-slate-700 border-none"
          >
            <option value={0}>0Nt 错配</option>
            <option value={1}>1Nt 错配</option>
            <option value={2}>2Nt 错配</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <button 
          type="submit"
          disabled={!hasSequence || !searchQuery}
          className="h-9 px-4 bg-slate-800 text-white rounded-lg text-xs font-black uppercase hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center shadow-sm whitespace-nowrap"
        >
          搜索
        </button>
      </form>

      <div className="h-6 w-px bg-gray-200 mx-1 my-auto" />

      <div className="flex items-center gap-2 my-auto">
        <button 
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all active:scale-95 group shadow-sm shrink-0"
          title="设置 Tm 计算参数"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-45 duration-500 overflow-visible" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <label className="h-9 flex items-center gap-2 px-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-all text-xs font-bold shadow-sm active:scale-95 whitespace-nowrap select-none justify-center">
          导入
          <input type="file" className="hidden" accept=".gb,.fa,.dna,.fasta,.txt,.methdna" onChange={onImport} />
        </label>

        <button 
          onClick={onMarkMethylation}
          disabled={!canMark || !hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center ${
            canMark && hasSequence ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ring-1 ring-inset ring-indigo-200' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
          }`}
        >
          标注 mC
        </button>

        <button 
          onClick={onAddPrimer}
          disabled={!canAddPrimer || !hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center ${
            canAddPrimer && hasSequence ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-inset ring-emerald-200' : 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50'
          }`}
        >
          添加引物
        </button>

        <button 
          onClick={onSave}
          disabled={!hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center ${
            hasSequence ? 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95 shadow-sm' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          保存
        </button>
      </div>
    </header>
  );
};
