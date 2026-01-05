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

const App: React.FC = () => {
  const [data, setData] = useState<ProjectData>({
    sequence: '',
    methylatedF: [],
    methylatedR: [],
    primers: [],
  });

  const [thermoSettings, setThermoSettings] = useState<ThermodynamicSettings>(DEFAULT_THERMO_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showPrimerDialog, setShowPrimerDialog] = useState(false);
  const [editingPrimer, setEditingPrimer] = useState<Primer | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [pastedSequence, setPastedSequence] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSequence = useMemo(() => {
    if (editingPrimer) {
      return editingPrimer.sequence;
    }

    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, selection.strand);
    let seq = strandSeq.slice(min, max + 1).toLowerCase();
    
    // 物理反向链识别：R, CTOT, OB 在屏幕上是 3' -> 5'
    // 选中后必须反转以提供生物学标准的 5' -> 3' 序列
    const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(selection.strand);
    if (isReversePhysical) {
      seq = seq.split('').reverse().join('');
    }
    return seq;
  }, [selection, data, editingPrimer]);

  const currentTemplate = useMemo(() => {
    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, selection.strand);
    let seq = strandSeq.slice(min, max + 1).toLowerCase();
    
    // 模板序列同步反转，确保与 5'-3' 的引物进行正确的配对计算
    const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(selection.strand);
    if (isReversePhysical) {
      seq = seq.split('').reverse().join('');
    }
    return seq;
  }, [selection, data]);

  const currentStats = useMemo(() => {
    return calculateThermodynamics(selectedSequence, currentTemplate, editingPrimer?.isMGB, thermoSettings);
  }, [selectedSequence, currentTemplate, editingPrimer, thermoSettings]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) {
          return;
        }
        if (selectedSequence && !showPrimerDialog) {
          e.preventDefault();
          try {
            await navigator.clipboard.writeText(selectedSequence.replace(/[\[\]]/g, ''));
            setCopyFeedback(true);
          } catch (err) {
            console.error('Failed to copy to clipboard', err);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSequence, showPrimerDialog]);

  useEffect(() => {
    if (copyFeedback) {
      const timer = setTimeout(() => setCopyFeedback(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyFeedback]);

  const handleSave = useCallback(() => {
    if (!data.sequence) return;
    const blob = new Blob([JSON.stringify({ ...data, thermoSettings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bisulfite_design_${new Date().toISOString().slice(0,10)}.methdna`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, thermoSettings]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (data.sequence) {
      const confirmSave = window.confirm("当前设计任务尚未保存，是否先保存当前任务？");
      if (confirmSave) handleSave();
    }
    const text = await file.text();
    if (file.name.endsWith('.methdna')) {
      try {
        const loaded = JSON.parse(text);
        if (loaded.methylationIndices && !loaded.methylatedF) {
          loaded.methylatedF = loaded.methylationIndices;
          loaded.methylatedR = [];
          delete loaded.methylationIndices;
        }
        if (!loaded.methylatedF) loaded.methylatedF = [];
        if (!loaded.methylatedR) loaded.methylatedR = [];
        if (loaded.thermoSettings) setThermoSettings(loaded.thermoSettings);
        setData(loaded);
        setSelection(null);
        setSearchResults([]);
        return;
      } catch (e) {
        alert("文件读取失败，请确保文件是有效的 .methdna 格式。");
      }
    }
    const seq = parseGenBank(text);
    if (!seq) {
      alert("无法识别的 DNA 格式（支持 .gb, .fa, .dna）。");
      return;
    }
    setData({ sequence: seq, methylatedF: [], methylatedR: [], primers: [] });
    setSelection(null);
    setSearchResults([]);
    if (e.target) e.target.value = ''; 
  }, [data, handleSave]);

  const handlePasteImport = () => {
    const cleanSeq = pastedSequence.replace(/[^atcgATCG]/g, '').toLowerCase();
    if (cleanSeq.length < 10) {
      alert("请输入有效的 DNA 序列（至少 10bp）。");
      return;
    }
    setData({ sequence: cleanSeq, methylatedF: [], methylatedR: [], primers: [] });
    setSelection(null);
    setSearchResults([]);
  };

  const handleSearch = useCallback((query: string, mismatches: number) => {
    if (!data.sequence || !query) {
      setSearchResults([]);
      return;
    }
    const allResults: SearchResult[] = [];
    STRANDS_ORDER.forEach(strandType => {
      const seq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, strandType);
      const hits = searchSequence(seq, query, strandType, mismatches);
      hits.forEach(hit => {
        allResults.push({ strand: strandType, ...hit });
      });
    });
    setSearchResults(allResults);
    if (allResults.length === 0) alert("在 6 条链中均未发现匹配序列。");
  }, [data]);

  const handleMarkMethylation = useCallback(() => {
    if (!selection) return;
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    const isBottomStrand = [StrandType.R, StrandType.OB, StrandType.CTOT].includes(selection.strand);
    const targetKey = isBottomStrand ? 'methylatedR' : 'methylatedF';
    setData(prev => {
      const newIndices = [...prev[targetKey]];
      const fullStrandSeq = getStrandSequence(prev.sequence, prev.methylatedF, prev.methylatedR, selection.strand);
      for (let i = min; i <= max; i++) {
        const base = fullStrandSeq[i].toLowerCase();
        if (base === 'c') {
          const index = newIndices.indexOf(i);
          if (index > -1) newIndices.splice(index, 1);
          else newIndices.push(i);
        }
      }
      return { ...prev, [targetKey]: newIndices };
    });
  }, [selection]);

  const handleAddOrUpdatePrimer = useCallback((primerData: Omit<Primer, 'id'>) => {
    setData(prev => {
      if (editingPrimer) {
        return {
          ...prev,
          primers: prev.primers.map(p => p.id === editingPrimer.id ? { ...primerData, id: p.id } : p)
        };
      }
      return {
        ...prev,
        primers: [...prev.primers, { ...primerData, id: crypto.randomUUID() }]
      };
    });
    setShowPrimerDialog(false);
    setEditingPrimer(null);
  }, [editingPrimer]);

  const handleDeletePrimer = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      primers: prev.primers.filter(p => p.id !== id)
    }));
    setShowPrimerDialog(false);
    setEditingPrimer(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden select-none">
      <Header 
        onImport={handleImport}
        onMarkMethylation={handleMarkMethylation}
        onAddPrimer={() => {
          setEditingPrimer(null);
          setShowPrimerDialog(true);
        }}
        onSave={handleSave}
        onSearch={handleSearch}
        onOpenSettings={() => setShowSettings(true)}
        canMark={!!selection}
        canAddPrimer={!!selection}
        hasSequence={!!data.sequence}
      />
      
      <input type="file" className="hidden" ref={fileInputRef} accept=".gb,.fa,.dna,.fasta,.txt,.methdna" onChange={handleImport} />

      {data.sequence ? (
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <DNAViewer 
            sequence={data.sequence}
            methylatedF={data.methylatedF}
            methylatedR={data.methylatedR}
            primers={data.primers}
            selection={selection}
            searchResults={searchResults}
            onSelectionChange={setSelection}
            onEditPrimer={(p) => {
              setEditingPrimer(p);
              setShowPrimerDialog(true);
            }}
          />

          {selection && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-10 border border-white/10 backdrop-blur-lg animate-in slide-in-from-bottom-6 duration-500 z-50">
              <div className="flex flex-col">
                <span className="text-white/50 font-black tracking-widest text-[10px]">Tm</span>
                <span className="text-2xl font-black font-mono text-emerald-400">{currentStats.tm.toFixed(1)}<span className="text-sm">°C</span></span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 font-black tracking-widest">Bases</span>
                <span className="text-2xl font-black font-mono">{selectedSequence.replace(/[\[\]]/g, '').length}<span className="text-sm"> bp</span></span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 font-black tracking-widest">Active Strand</span>
                <span className="text-sm font-bold text-blue-300">{selection.strand} : {Math.min(selection.start, selection.end) + 1} → {Math.max(selection.start, selection.end) + 1}</span>
              </div>
            </div>
          )}
          
          {copyFeedback && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-[60]">
               <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
               <span className="text-xs font-bold tracking-wide">序列已复制到剪贴板</span>
            </div>
          )}
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 overflow-y-auto">
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-[3rem] shadow-xl border border-slate-100 hover:shadow-2xl transition-all duration-300">
              <button onClick={() => fileInputRef.current?.click()} className="group flex flex-col items-center outline-none">
                <div className="w-32 h-32 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-100 group-active:scale-95">
                   <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                   </svg>
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">上传序列文件</h2>
                <p className="text-slate-400 text-sm font-medium">支持 .gb, .fasta, .dna, .methdna</p>
              </button>
            </div>

            <div className="flex flex-col p-8 bg-white rounded-[3rem] shadow-xl border border-slate-100 hover:shadow-2xl transition-all duration-300 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">粘贴 DNA 序列</h2>
              </div>
              
              <div className="relative flex-1 group">
                <textarea 
                  value={pastedSequence}
                  onChange={(e) => setPastedSequence(e.target.value)}
                  placeholder="在此处直接粘贴原始 DNA 序列内容..."
                  className="w-full h-40 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl dna-font text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none placeholder:text-slate-300"
                />
                <div className="absolute bottom-3 right-3 text-[10px] font-black text-slate-400 bg-white/80 px-2 py-1 rounded-md border border-slate-200 uppercase tracking-widest">
                  {pastedSequence.replace(/[^atcgATCG]/g, '').length} bp
                </div>
              </div>

              <button 
                onClick={handlePasteImport}
                disabled={pastedSequence.replace(/[^atcgATCG]/g, '').length < 10}
                className="mt-6 w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
              >
                立即开始设计
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrimerDialog && (editingPrimer || selection) && (
        <PrimerDialog 
          initialSequence={selectedSequence}
          strand={editingPrimer ? editingPrimer.strand : selection!.strand}
          start={editingPrimer ? editingPrimer.start : Math.min(selection!.start, selection!.end)}
          primerId={editingPrimer?.id}
          initialName={editingPrimer?.name}
          initialIsMGB={editingPrimer?.isMGB}
          thermoSettings={thermoSettings}
          existingPrimers={data.primers}
          fullProjectData={data} 
          onConfirm={handleAddOrUpdatePrimer}
          onDelete={handleDeletePrimer}
          onCancel={() => {
            setShowPrimerDialog(false);
            setEditingPrimer(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal 
          settings={thermoSettings} 
          onSave={(s) => {
            setThermoSettings(s);
            setShowSettings(false);
          }} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

export default App;