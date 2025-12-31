
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { DNAViewer } from './components/DNAViewer';
import { PrimerDialog } from './components/PrimerDialog';
import { ProjectData, SelectionState, Primer, StrandType } from './types';
import { parseGenBank, calculateTm, getStrandSequence } from './services/dnaUtils';

const App: React.FC = () => {
  const [data, setData] = useState<ProjectData>({
    sequence: '',
    methylationIndices: [],
    primers: [],
  });

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [showPrimerDialog, setShowPrimerDialog] = useState(false);
  const [editingPrimer, setEditingPrimer] = useState<Primer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSequence = useMemo(() => {
    if (editingPrimer) return editingPrimer.sequence;
    if (!selection || !data.sequence) return '';
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    const strandSeq = getStrandSequence(data.sequence, data.methylationIndices, selection.strand);
    return strandSeq.slice(min, max + 1);
  }, [selection, data, editingPrimer]);

  const currentTm = useMemo(() => {
    return calculateTm(selectedSequence);
  }, [selectedSequence]);

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
        setData(loaded);
        setSelection(null);
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
      methylationIndices: [],
      primers: []
    });
    setSelection(null);
    if (e.target) e.target.value = ''; 
  }, [data, handleSave]);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleMarkMethylation = useCallback(() => {
    if (!selection) return;
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    
    setData(prev => {
      const newIndices = [...prev.methylationIndices];
      for (let i = min; i <= max; i++) {
        const base = prev.sequence[i].toLowerCase();
        if (base === 'c') {
          const index = newIndices.indexOf(i);
          if (index > -1) newIndices.splice(index, 1);
          else newIndices.push(i);
        }
      }
      return { ...prev, methylationIndices: newIndices };
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
            methylatedIndices={data.methylationIndices}
            primers={data.primers}
            selection={selection}
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
              点击图标或上方“导入序列”按钮载入您的 DNA 文件。支持 .gb, .fa 格式以及之前的 .methdna 任务。
            </p>
          </button>
        </div>
      )}

      {showPrimerDialog && (editingPrimer || selection) && (
        <PrimerDialog 
          initialSequence={editingPrimer ? editingPrimer.sequence : selectedSequence}
          strand={editingPrimer ? editingPrimer.strand : selection!.strand}
          start={editingPrimer ? editingPrimer.start : Math.min(selection!.start, selection!.end)}
          primerId={editingPrimer?.id}
          initialName={editingPrimer?.name}
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
