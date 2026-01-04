
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { DNAViewer } from './components/DNAViewer';
import { PrimerDialog } from './components/PrimerDialog';
import { ProjectData, SelectionState, Primer, StrandType, SearchResult } from './types';
import { parseGenBank, calculateTm, getStrandSequence, searchSequence } from './services/dnaUtils';

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

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showPrimerDialog, setShowPrimerDialog] = useState(false);
  const [editingPrimer, setEditingPrimer] = useState<Primer | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculates the 5'->3' biological sequence of the current selection or editing primer
  const selectedSequence = useMemo(() => {
    // If editing a primer, convert its stored visual sequence to biological 5'->3' if needed
    if (editingPrimer) {
      const isReverse = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(editingPrimer.strand);
      return isReverse ? editingPrimer.sequence.split('').reverse().join('') : editingPrimer.sequence;
    }

    // If selecting from the viewer
    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylatedF, data.methylatedR, selection.strand);
    const rawSlice = strandSeq.slice(min, max + 1);

    // If reverse strand (displayed 3'->5'), reverse string to get biological 5'->3'
    const isReverse = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(selection.strand);
    return isReverse ? rawSlice.split('').reverse().join('') : rawSlice;
  }, [selection, data, editingPrimer]);

  const currentTm = useMemo(() => {
    return calculateTm(selectedSequence);
  }, [selectedSequence]);

  // Handle Ctrl+C / Cmd+C to copy selected sequence
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        // Ignore if user is typing in an input
        if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) {
          return;
        }

        if (selectedSequence && !showPrimerDialog) {
          e.preventDefault();
          try {
            await navigator.clipboard.writeText(selectedSequence);
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

  // Clear feedback after 2s
  useEffect(() => {
    if (copyFeedback) {
      const timer = setTimeout(() => setCopyFeedback(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyFeedback]);

  const handleSave = useCallback(() => {
    if (!data.sequence) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bisulfite_design_${new Date().toISOString().slice(0,10)}.methdna`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (data.sequence) {
      const confirmSave = window.confirm("当前设计任务尚未保存，是否先保存当前任务？");
      if (confirmSave) {
        handleSave();
      }
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

    setData({
      sequence: seq,
      methylatedF: [],
      methylatedR: [],
      primers: []
    });
    setSelection(null);
    setSearchResults([]);
    if (e.target) e.target.value = ''; 
  }, [data, handleSave]);

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
        allResults.push({
          strand: strandType,
          ...hit
        });
      });
    });

    setSearchResults(allResults);
    if (allResults.length === 0) {
      alert("在 6 条链中均未发现匹配序列。");
    }
  }, [data]);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

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
    // primerData.sequence comes from PrimerDialog, so it is biological 5'->3'.
    // We must convert it to visual order (matching the strand display) before storage.
    const isReverse = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(primerData.strand);
    const visualSequence = isReverse ? primerData.sequence.split('').reverse().join('') : primerData.sequence;
    
    const finalPrimerData = { ...primerData, sequence: visualSequence };

    setData(prev => {
      if (editingPrimer) {
        return {
          ...prev,
          primers: prev.primers.map(p => p.id === editingPrimer.id ? { ...finalPrimerData, id: p.id } : p)
        };
      }
      return {
        ...prev,
        primers: [...prev.primers, { ...finalPrimerData, id: crypto.randomUUID() }]
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
        canMark={!!selection}
        canAddPrimer={!!selection}
        hasSequence={!!data.sequence}
      />
      
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept=".gb,.fa,.dna,.fasta,.txt,.methdna" 
        onChange={handleImport} 
      />

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
                <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Thermodynamic Tm (NN)</span>
                <span className="text-2xl font-black font-mono text-emerald-400">{currentTm.toFixed(1)}<span className="text-sm">°C</span></span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Bases</span>
                <span className="text-2xl font-black font-mono">{selectedSequence.length}<span className="text-sm"> bp</span></span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-white/50 uppercase font-black tracking-widest">Active Strand</span>
                <span className="text-sm font-bold text-blue-300">{selection.strand} : {Math.min(selection.start, selection.end) + 1} → {Math.max(selection.start, selection.end) + 1}</span>
              </div>
            </div>
          )}
          
          {/* Copy Feedback Toast */}
          {copyFeedback && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 z-[60]">
               <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
               <span className="text-xs font-bold tracking-wide">序列已复制到剪贴板</span>
            </div>
          )}
          
          {searchResults.length > 0 && (
            <div className="absolute top-4 right-8 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-[10px] font-black uppercase tracking-widest animate-bounce">
              匹配命中: {searchResults.length} 处
            </div>
          )}
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
          <button 
            onClick={triggerImport}
            className="group flex flex-col items-center outline-none"
          >
            <div className="w-40 h-40 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center mb-8 border border-slate-100 transition-all duration-300 group-hover:scale-105 group-hover:shadow-blue-200 group-active:scale-95">
               <svg className="w-20 h-20 text-blue-500 animate-pulse group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
               </svg>
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">导入序列开始设计</h2>
            <p className="max-w-lg text-slate-500 font-medium leading-relaxed text-lg text-pretty">
              支持模糊搜索与多链比对。输入序列并在 6 条链中实时检索。
            </p>
          </button>
        </div>
      )}

      {showPrimerDialog && (editingPrimer || selection) && (
        <PrimerDialog 
          initialSequence={selectedSequence}
          strand={editingPrimer ? editingPrimer.strand : selection!.strand}
          start={editingPrimer ? editingPrimer.start : Math.min(selection!.start, selection!.end)}
          primerId={editingPrimer?.id}
          initialName={editingPrimer?.name}
          existingPrimers={data.primers}
          onConfirm={handleAddOrUpdatePrimer}
          onDelete={handleDeletePrimer}
          onCancel={() => {
            setShowPrimerDialog(false);
            setEditingPrimer(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
