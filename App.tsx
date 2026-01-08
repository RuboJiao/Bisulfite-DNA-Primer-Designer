import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { DNAViewer } from './components/DNAViewer';
import { PrimerDialog } from './components/PrimerDialog';
import { SettingsModal } from './components/SettingsModal';
import { ProjectData, SelectionState, Primer, StrandType, SearchResult, ThermodynamicSettings } from './types';
import { parseGenBank, calculateThermodynamics, getStrandSequence, searchSequence, DEFAULT_THERMO_SETTINGS } from './services/dnaUtils';

const STRANDS_ORDER = [
  StrandType.OT,
  StrandType.CTOT,
  StrandType.F,
  StrandType.R,
  StrandType.CTOB,
  StrandType.OB,
];

const LOCAL_STORAGE_KEY = 'bisulfite_designer_current_project';

const ConfirmModal: React.FC<{
  title: string;
  message: string;
  confirmLabel?: string;
  discardLabel?: string;
  onConfirm: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel = "保存并执行", discardLabel = "直接执行 (不保存)", onConfirm, onDiscard, onCancel }) => (
  <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[200] backdrop-blur-md animate-in fade-in duration-200">
    <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-md w-full border border-slate-200 animate-in zoom-in-95 duration-200">
      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      </div>
      <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">{message}</p>
      <div className="flex flex-col gap-3">
        <button onClick={onConfirm} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all">
          {confirmLabel}
        </button>
        <button onClick={onDiscard} className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">
          {discardLabel}
        </button>
        <button onClick={onCancel} className="w-full py-3.5 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-all">
          取消
        </button>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [data, setData] = useState<ProjectData>({ sequence: '', methylatedF: [], methylatedR: [], primers: [] });
  const [thermoSettings, setThermoSettings] = useState<ThermodynamicSettings>(DEFAULT_THERMO_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showPrimerDialog, setShowPrimerDialog] = useState(false);
  const [editingPrimer, setEditingPrimer] = useState<Primer | null>(null);
  const [selectedPrimerId, setSelectedPrimerId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [searchErrorFeedback, setSearchErrorFeedback] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pastedSequence, setPastedSequence] = useState('');
  const [confirmTask, setConfirmTask] = useState<'logo' | 'import' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        // 如果旧设置的 Mg 为 1.5 (旧版默认)，则强制更新为 0 (对标 IDT 默认)
        if (parsed.thermoSettings) {
           if (parsed.thermoSettings.mgConc === 1.5) {
             setThermoSettings(DEFAULT_THERMO_SETTINGS);
           } else {
             setThermoSettings(parsed.thermoSettings);
           }
        }
        setLastSaved(new Date());
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (data.sequence) {
      const timeout = setTimeout(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ data, thermoSettings }));
        setLastSaved(new Date());
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [data, thermoSettings]);

  const selectedSequence = useMemo(() => {
    if (editingPrimer) return editingPrimer.sequence;
    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end), max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, selection.strand);
    let seq = strandSeq.slice(min, max + 1).toLowerCase();
    if ([StrandType.R, StrandType.CTOT, StrandType.OB].includes(selection.strand)) seq = seq.split('').reverse().join('');
    return seq;
  }, [selection, data, editingPrimer]);

  const currentTemplate = useMemo(() => {
    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end), max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, selection.strand);
    let seq = strandSeq.slice(min, max + 1).toLowerCase();
    if ([StrandType.R, StrandType.CTOT, StrandType.OB].includes(selection.strand)) seq = seq.split('').reverse().join('');
    return seq;
  }, [selection, data]);

  const currentStats = useMemo(() => {
    return calculateThermodynamics(selectedSequence, currentTemplate, editingPrimer?.isMGB, thermoSettings);
  }, [selectedSequence, currentTemplate, editingPrimer, thermoSettings]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) return;
        if (selectedSequence && !showPrimerDialog) {
          e.preventDefault();
          try { await navigator.clipboard.writeText(selectedSequence.replace(/[\[\]]/g, '')); setCopyFeedback(true); } catch (err) { console.error(err); }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSequence, showPrimerDialog]);

  useEffect(() => {
    if (copyFeedback) { const t = setTimeout(() => setCopyFeedback(false), 2000); return () => clearTimeout(t); }
  }, [copyFeedback]);

  const handleExport = useCallback(() => {
    if (!data.sequence) { alert("没有可导出的数据"); return; }
    try {
      const blob = new Blob([JSON.stringify({ ...data, thermoSettings }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bisulfite_design_${new Date().toISOString().slice(0,10)}.methdna`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { alert("导出失败"); }
  }, [data, thermoSettings]);

  const resetToInitial = useCallback(() => {
    setData({ sequence: '', methylatedF: [], methylatedR: [], primers: [] });
    setSelection(null); setSearchResults([]); setPastedSequence(''); setConfirmTask(null); setSelectedPrimerId(null); setLastSaved(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // 同时清空文件选择器，防止重置后无法重新导入同一个文件（尽管在 handleImport 中已经处理，这里作为双重保险）
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const openImportDialog = useCallback(() => { setConfirmTask(null); fileInputRef.current?.click(); }, []);

  // 统一文件处理逻辑
  const processFile = useCallback(async (file: File) => {
    const text = await file.text();
    if (file.name.endsWith('.methdna')) {
      try {
        const loaded = JSON.parse(text);
        if (loaded.methylationIndices && !loaded.methylatedF) { loaded.methylatedF = loaded.methylationIndices; loaded.methylatedR = []; delete loaded.methylationIndices; }
        if (!loaded.methylatedF) loaded.methylatedF = [];
        if (!loaded.methylatedR) loaded.methylatedR = [];
        if (loaded.thermoSettings) setThermoSettings(loaded.thermoSettings);
        setData(loaded); setSelection(null); setSearchResults([]); setSelectedPrimerId(null);
        return;
      } catch (e) { alert("格式无效"); }
    }
    const seq = parseGenBank(text);
    if (!seq) { alert("无法识别的格式"); return; }
    setData({ sequence: seq, methylatedF: [], methylatedR: [], primers: [] });
    setSelection(null); setSearchResults([]); setSelectedPrimerId(null);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    // 立即重置 value，确保下次选择相同文件也能触发 onChange
    e.target.value = '';
    await processFile(file);
  }, [processFile]);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 防止子元素触发 dragleave 导致闪烁，检查 relatedTarget 是否还在当前容器内
    if (e.relatedTarget && (e.currentTarget.contains(e.relatedTarget as Node))) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (data.sequence) {
         // 如果已经有数据，可以根据需求提示保存或直接覆盖，这里简单起见模拟点击了 Import 后的逻辑，
         // 但为了体验顺滑，我们可以直接处理，或者弹出确认框。
         // 鉴于目前逻辑，直接处理可能会丢失未保存进度。
         // 简单处理：如果已有序列，弹窗提示保存逻辑比较复杂，
         // 这里仅在首页（无序列）时支持拖拽，或者覆盖前确认。
         // 实际上 UI 只有在 !data.sequence 时才显示大大的拖拽区。
         // 如果在编辑界面拖拽，可以暂不处理，或者作为高级功能。
         // 题目要求“拖入序列文件到首页窗口时”，所以主要关注 !data.sequence 的情况。
         if (confirm("是否覆盖当前项目？")) {
            await processFile(file);
         }
      } else {
         await processFile(file);
      }
    }
  }, [data.sequence, processFile]);

  const handlePasteImport = () => {
    const cleanSeq = pastedSequence.replace(/[^atcgATCG]/g, '').toLowerCase();
    if (cleanSeq.length < 10) { alert("序列太短"); return; }
    setData({ sequence: cleanSeq, methylatedF: [], methylatedR: [], primers: [] });
    setSelection(null); setSearchResults([]); setSelectedPrimerId(null);
  };

  const handleSearch = useCallback((query: string, mismatches: number) => {
    if (!data.sequence || !query) { setSearchResults([]); return; }
    const allResults: SearchResult[] = [];
    STRANDS_ORDER.forEach(strandType => {
      const seq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, strandType);
      const hits = searchSequence(seq, query, strandType, mismatches);
      hits.forEach(hit => allResults.push({ strand: strandType, ...hit }));
    });
    setSearchResults(allResults);
    if (allResults.length === 0) setSearchErrorFeedback(true);
  }, [data]);

  const handleMarkMethylation = useCallback(() => {
    if (!selection) return;
    const min = Math.min(selection.start, selection.end), max = Math.max(selection.start, selection.end);
    const isBottom = [StrandType.R, StrandType.OB, StrandType.CTOT].includes(selection.strand);
    const targetKey = isBottom ? 'methylatedR' : 'methylatedF';
    setData(prev => {
      const newIndices = [...prev[targetKey]];
      const fullStrandSeq = getStrandSequence(prev.sequence, prev.methylatedF, prev.methylatedR, selection.strand);
      for (let i = min; i <= max; i++) {
        if (fullStrandSeq[i].toLowerCase() === 'c') {
          const idx = newIndices.indexOf(i);
          if (idx > -1) newIndices.splice(idx, 1); else newIndices.push(i);
        }
      }
      return { ...prev, [targetKey]: newIndices };
    });
  }, [selection]);

  const handleDeletePrimer = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      primers: prev.primers.filter(p => p.id !== id)
    }));
    setShowPrimerDialog(false);
    setEditingPrimer(null);
    setSelectedPrimerId(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden select-none">
      <Header 
        onLogoClick={() => data.sequence ? setConfirmTask('logo') : resetToInitial()}
        onImportClick={() => data.sequence ? setConfirmTask('import') : openImportDialog()}
        onMarkMethylation={handleMarkMethylation}
        onAddPrimer={() => { setEditingPrimer(null); setShowPrimerDialog(true); }}
        onSave={handleExport}
        onSearch={handleSearch}
        onOpenSettings={() => setShowSettings(true)}
        canMark={!!selection} canAddPrimer={!!selection} hasSequence={!!data.sequence} lastSaved={lastSaved}
      />
      
      <input type="file" className="hidden" ref={fileInputRef} accept=".gb,.fa,.dna,.fasta,.txt,.methdna" onChange={handleImport} />

      {data.sequence ? (
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <DNAViewer 
            sequence={data.sequence} methylatedF={data.methylatedF} methylatedR={data.methylatedR} primers={data.primers}
            selection={selection} selectedPrimerId={selectedPrimerId} searchResults={searchResults}
            onSelectionChange={setSelection} onSelectPrimer={setSelectedPrimerId}
            onEditPrimer={p => { setEditingPrimer(p); setShowPrimerDialog(true); }}
          />

          {selection && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-10 border border-white/10 backdrop-blur-lg animate-in slide-in-from-bottom-6 duration-500 z-50">
              <div className="flex flex-col"><span className="text-white/50 font-black tracking-widest text-[10px]">Tm</span><span className="text-2xl font-black font-mono text-emerald-400">{currentStats.tm.toFixed(1)}<span className="text-sm">°C</span></span></div>
              <div className="w-px h-10 bg-white/20" /><div className="flex flex-col"><span className="text-[10px] text-white/50 font-black tracking-widest">Bases</span><span className="text-2xl font-black font-mono">{selectedSequence.replace(/[\[\]]/g, '').length}<span className="text-sm"> bp</span></span></div>
              <div className="w-px h-10 bg-white/20" /><div className="flex flex-col"><span className="text-[10px] text-white/50 font-black tracking-widest">Active Strand</span><span className="text-sm font-bold text-blue-300">{selection.strand} : {Math.min(selection.start, selection.end) + 1} → {Math.max(selection.start, selection.end) + 1}</span></div>
            </div>
          )}
          
          {copyFeedback && <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-[60]"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg><span className="text-xs font-bold tracking-wide">已复制</span></div>}
          {searchErrorFeedback && <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-[60] border border-rose-400/30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span className="text-sm font-black tracking-wide">未找到</span></div>}
        </main>
      ) : (
        <div 
            className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 transition-colors duration-300"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
           <div className={`max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 transition-transform duration-300 ${isDragging ? 'scale-105' : 'scale-100'}`}>
            <div className={`flex flex-col items-center text-center p-8 bg-white rounded-[3rem] shadow-xl border transition-all duration-300 ${isDragging ? 'border-blue-500 ring-4 ring-blue-500/20 bg-blue-50/50 shadow-2xl' : 'border-slate-100 hover:shadow-2xl'}`}>
                <button onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center outline-none w-full h-full justify-center">
                    <div className={`w-32 h-32 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 ${isDragging ? 'bg-blue-100 scale-110' : 'bg-blue-50 group-hover:scale-105 group-hover:bg-blue-100'}`}>
                        <svg className={`w-16 h-16 transition-colors duration-300 ${isDragging ? 'text-blue-600' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <h2 className={`text-2xl font-black mb-2 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-800'}`}>
                        {isDragging ? "释放文件以上传" : "上传序列文件"}
                    </h2>
                    <p className={`text-sm font-bold mt-2 transition-colors ${isDragging ? 'text-blue-500' : 'text-blue-500 cursor-pointer hover:underline'}`}>
                        {isDragging ? "支持 .gb .fa .dna .methdna" : "或拖入序列文件 (.gb .fa .methdna)"}
                    </p>
                </button>
            </div>
            <div className={`flex flex-col p-8 bg-white rounded-[3rem] shadow-xl border border-slate-100 hover:shadow-2xl h-full transition-all ${isDragging ? 'opacity-50 grayscale' : ''}`}>
                <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">粘贴 DNA 序列</h2>
                <textarea value={pastedSequence} onChange={e => setPastedSequence(e.target.value)} placeholder="粘贴原始 DNA 序列..." className="w-full flex-1 min-h-[160px] p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl dna-font text-sm outline-none focus:border-indigo-300 transition-all resize-none" />
                <button 
                    onClick={handlePasteImport} 
                    disabled={pastedSequence.replace(/[^atcgATCG]/g, '').length < 10} 
                    className="mt-6 w-full py-4 bg-indigo-100 text-indigo-600 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-indigo-200 hover:text-indigo-700 active:scale-95 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-300 transition-all"
                >
                    开始设计
                </button>
            </div>
           </div>
           
           {/* 拖拽时的全局提示覆盖层 (可选，增强体验) */}
           {isDragging && (
             <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-blue-500/10 z-50 backdrop-blur-[2px]">
                <div className="bg-white px-8 py-4 rounded-full shadow-2xl text-blue-600 font-black text-xl animate-bounce border border-blue-200">
                   📂 释放以导入文件
                </div>
             </div>
           )}
        </div>
      )}

      {confirmTask && <ConfirmModal 
        title="保存提醒" 
        message="是否在切换前导出当前设计？" 
        confirmLabel={confirmTask === 'logo' ? "保存并返回首页" : "保存并导入新序列"}
        discardLabel={confirmTask === 'logo' ? "返回首页（不保存）" : "导入新序列（不保存）"}
        onConfirm={() => { handleExport(); if (confirmTask === 'logo') resetToInitial(); else openImportDialog(); }} 
        onDiscard={() => { if (confirmTask === 'logo') resetToInitial(); else openImportDialog(); }} 
        onCancel={() => setConfirmTask(null)} 
      />}
      {showPrimerDialog && (editingPrimer || selection) && <PrimerDialog initialSequence={selectedSequence} strand={editingPrimer ? editingPrimer.strand : selection!.strand} start={editingPrimer ? editingPrimer.start : Math.min(selection!.start, selection!.end)} primerId={editingPrimer?.id} initialName={editingPrimer?.name} initialIsMGB={editingPrimer?.isMGB} thermoSettings={thermoSettings} existingPrimers={data.primers} fullProjectData={data} onConfirm={p => { setData(prev => editingPrimer ? { ...prev, primers: prev.primers.map(p1 => p1.id === editingPrimer.id ? { ...p, id: p1.id } : p1) } : { ...prev, primers: [...prev.primers, { ...p, id: crypto.randomUUID() }] }); setShowPrimerDialog(false); setEditingPrimer(null); }} onDelete={handleDeletePrimer} onCancel={() => { setShowPrimerDialog(false); setEditingPrimer(null); }} />}
      {showSettings && <SettingsModal settings={thermoSettings} onSave={s => { setThermoSettings(s); setShowSettings(false); }} onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default App;