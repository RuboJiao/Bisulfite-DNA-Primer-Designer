import React, { useState } from 'react';

interface HeaderProps {
  onLogoClick: () => void;
  onImportClick: () => void;
  onMarkMethylation: () => void;
  onAddPrimer: () => void;
  onSave: () => void;
  onSearch: (query: string, mismatches: number) => void;
  onOpenSettings: () => void;
  canMark: boolean;
  canAddPrimer: boolean;
  hasSequence: boolean;
  lastSaved?: Date | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  onLogoClick,
  onImportClick,
  onMarkMethylation, 
  onAddPrimer, 
  onSave,
  onSearch,
  onOpenSettings,
  canMark,
  canAddPrimer,
  hasSequence,
  lastSaved
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mismatches, setMismatches] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery, mismatches);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-50">
      <div 
        className="flex items-center gap-3 mr-2 my-auto cursor-pointer group select-none"
        onClick={onLogoClick}
      >
        {/* SeekGene Mosaic Frame Icon */}
        <div className="w-9 h-9 relative transition-transform group-hover:scale-105">
           <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full shadow-lg rounded-xl">
              {/* Left Column */}
              <rect x="0" y="0" width="20" height="35" fill="#5eead4" /> 
              <rect x="0" y="35" width="20" height="30" fill="#4338ca" />
              <rect x="0" y="65" width="20" height="35" fill="#facc15" />
              
              {/* Top Row (Overlaps Left) */}
              <rect x="20" y="0" width="40" height="20" fill="#facc15" />
              <rect x="60" y="0" width="40" height="20" fill="#4338ca" />
              
              {/* Right Column */}
              <rect x="80" y="20" width="20" height="25" fill="#facc15" />
              <rect x="80" y="45" width="20" height="55" fill="#5eead4" />

              {/* Bottom Row */}
              <rect x="20" y="80" width="30" height="20" fill="#5eead4" />
              <rect x="50" y="80" width="30" height="20" fill="#4338ca" />
           </svg>
        </div>
        
        <div className="flex flex-col hidden lg:flex leading-none justify-center ml-0.5">
             <h1 className="text-base font-black tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors">BisPrimer</h1>
             <span className="text-[10px] font-bold text-slate-400 tracking-wider mt-0.5">by SEEKGENE</span>
        </div>
      </div>

      <div className="h-6 w-px bg-gray-200 mx-2 my-auto" />

      {/* 搜索栏模块 */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-xl p-0 my-auto">
        <div className="flex-1 h-9 bg-slate-100 rounded-lg flex items-center px-3 gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset transition-all group">
          <svg className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase().replace(/[^ATCGRYSWKMBDHVN]/g, ''))}
            placeholder="搜索序列 (支持简并碱基)..."
            disabled={!hasSequence}
            className="flex-1 w-full bg-transparent border-none outline-none text-xs font-bold dna-font placeholder:text-slate-400 text-slate-800 h-full uppercase p-0"
          />
        </div>

        <div className="relative h-9 w-28 bg-slate-100 rounded-lg hover:bg-slate-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset transition-all flex items-center">
          <select 
            value={mismatches}
            onChange={(e) => setMismatches(Number(e.target.value))}
            disabled={!hasSequence}
            className="w-full h-full bg-transparent pl-3 pr-8 text-[10px] font-black outline-none appearance-none cursor-pointer text-slate-700 border-none"
          >
            <option value={0}>0nt 错配</option>
            <option value={1}>1nt 错配</option>
            <option value={2}>2nt 错配</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <button 
          type="submit"
          disabled={!hasSequence || !searchQuery}
          className="h-9 px-4 bg-slate-400 text-white rounded-lg text-xs font-black uppercase hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center shadow-sm whitespace-nowrap"
        >
          搜索
        </button>
      </form>

      <div className="h-6 w-px bg-gray-200 mx-1 my-auto" />

      {/* 自动保存状态提示 */}
      {hasSequence && (
        <div className="hidden xl:flex items-center gap-2 px-3 h-9 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 transition-all animate-in fade-in slide-in-from-right-2 duration-500">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
             {lastSaved ? `已自动保存 (${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : '正在同步...'}
           </span>
        </div>
      )}

      <div className="flex items-center gap-2 my-auto ml-auto">
        <button 
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 group shadow-sm shrink-0"
          title="设置 Tm 计算参数"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-700" style={{ overflow: 'visible' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>

        <button 
          onClick={onImportClick}
          className="h-9 flex items-center gap-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold shadow-md shadow-blue-200 active:scale-95 whitespace-nowrap select-none justify-center"
        >
          导入
        </button>

        <button 
          onClick={onMarkMethylation}
          disabled={!canMark || !hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center border ${
            canMark && hasSequence ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm' : 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed'
          }`}
        >
          标注 mC
        </button>

        <button 
          onClick={onAddPrimer}
          disabled={!canAddPrimer || !hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center border ${
            canAddPrimer && hasSequence ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm' : 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed'
          }`}
        >
          添加引物
        </button>

        <button 
          onClick={onSave}
          disabled={!hasSequence}
          className={`h-9 flex items-center gap-2 px-3 rounded-lg transition-all text-xs font-bold whitespace-nowrap justify-center border ${
            hasSequence ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm' : 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed'
          }`}
        >
          导出
        </button>
      </div>
    </header>
  );
};