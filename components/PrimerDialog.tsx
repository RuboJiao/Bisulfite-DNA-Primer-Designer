
import React, { useState, useMemo } from 'react';
import { Primer, StrandType, ThermodynamicSettings } from '../types';
import { 
  calculateThermodynamics, 
  findMostStableDimer, 
  findMostStableHairpin,
  DEFAULT_THERMO_SETTINGS,
  getStrandSequence,
  isBaseCompatible,
  getComplement
} from '../services/dnaUtils';

interface PrimerDialogProps {
  initialSequence: string;
  strand: StrandType;
  start: number;
  primerId?: string;
  initialName?: string;
  initialIsMGB?: boolean;
  thermoSettings?: ThermodynamicSettings;
  existingPrimers: Primer[];
  fullProjectData?: any;
  onConfirm: (primer: Omit<Primer, 'id'>) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

export const PrimerDialog: React.FC<PrimerDialogProps> = ({
  initialSequence,
  strand,
  start,
  primerId,
  initialName,
  initialIsMGB = false,
  thermoSettings = DEFAULT_THERMO_SETTINGS,
  existingPrimers,
  fullProjectData,
  onConfirm,
  onDelete,
  onCancel
}) => {
  const [name, setName] = useState(initialName || `Primer-${Math.floor(Math.random() * 1000)}`);
  const [sequence, setSequence] = useState(initialSequence); 
  const [isMGB, setIsMGB] = useState(initialIsMGB);
  const [activeTab, setActiveTab] = useState<'hairpin' | 'self' | 'cross'>('hairpin');
  const [crossTargetId, setCrossTargetId] = useState<string>('');

  const { bindingBases, tailMap } = useMemo(() => {
    const parts = sequence.split(/(\[[^\]]*\])/g);
    let bindPos = 0;
    const bases: string[] = [];
    const tails = new Map<number, string>();

    parts.forEach(part => {
      if (!part) return;
      if (part.startsWith('[') && part.endsWith(']')) {
        tails.set(bindPos, part.slice(1, -1));
      } else {
        for (const char of part) {
          bases.push(char);
          bindPos++;
        }
      }
    });
    return { bindingBases: bases, tailMap: tails };
  }, [sequence]);

  const stats = useMemo(() => {
    if (!fullProjectData) return calculateThermodynamics(sequence, "", isMGB, thermoSettings);
    
    const templateStrandSeq = getStrandSequence(fullProjectData.sequence, fullProjectData.methylatedF, fullProjectData.methylatedR, strand);
    const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(strand);
    
    let targetSeq = templateStrandSeq.slice(start, start + bindingBases.length);
    if (isReversePhysical) {
      targetSeq = targetSeq.split('').reverse().join('');
    }
    
    return calculateThermodynamics(sequence, targetSeq, isMGB, thermoSettings);
  }, [fullProjectData, strand, start, bindingBases.length, sequence, isMGB, thermoSettings]);

  // 可视化对齐上下文
  const alignmentContext = useMemo(() => {
    if (!fullProjectData) return null;
    const templateStrandSeq = getStrandSequence(fullProjectData.sequence, fullProjectData.methylatedF, fullProjectData.methylatedR, strand);
    const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(strand);

    const contextStart = Math.max(0, start - 10);
    const contextEnd = Math.min(templateStrandSeq.length, start + bindingBases.length + 10);
    let physicalContext = templateStrandSeq.slice(contextStart, contextEnd);
    
    if (isReversePhysical) {
      physicalContext = physicalContext.split('').reverse().join('');
    }

    const relativeStart = isReversePhysical 
      ? (contextEnd - (start + bindingBases.length))
      : (start - contextStart);

    return {
      full: physicalContext,
      relativeStart
    };
  }, [fullProjectData, strand, start, bindingBases.length]);

  const hairpin = useMemo(() => findMostStableHairpin(sequence), [sequence]);
  const selfDimer = useMemo(() => findMostStableDimer(sequence, sequence), [sequence]);
  const crossTarget = useMemo(() => existingPrimers.find(p => p.id === crossTargetId), [existingPrimers, crossTargetId]);
  const crossDimer = useMemo(() => {
    if (!crossTarget) return null;
    return findMostStableDimer(sequence, crossTarget.sequence);
  }, [sequence, crossTarget]);

  const CHAR_W = 12;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-[820px] max-h-[98vh] overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in duration-200">
        
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">引物详细设计</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{strand} 链 · 坐标: {start + 1}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[10px] font-black uppercase text-slate-400">MGB</span>
                  <input type="checkbox" checked={isMGB} onChange={(e) => setIsMGB(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
               </label>
               <input 
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="text-xs font-bold text-indigo-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32"
                />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '结合长度', val: `${bindingBases.length}nt` },
              { label: 'Tm (Binding)', val: `${stats.tm.toFixed(1)}°C`, color: 'text-indigo-600' },
              { label: 'GC Content', val: `${stats.gc.toFixed(1)}%`, color: 'text-fuchsia-600' },
              { label: 'Free Energy', val: `${stats.dg.toFixed(1)}`, color: 'text-orange-600' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-xl py-2 px-3 shadow-sm flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 tracking-tighter uppercase">{item.label}</span>
                <span className={`text-sm font-black ${item.color || 'text-slate-800'}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5'-3' 同向对齐视图 */}
        <div className="px-6 py-4 bg-white border-b border-slate-100">
           <div className="relative bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner overflow-x-auto min-h-[140px]">
              <div className="dna-font text-[14px] leading-none whitespace-pre flex flex-col gap-1 min-w-max">
                 
                 <div className="relative flex">
                    <span className="mr-4 text-[9px] font-black text-slate-300 tracking-widest uppercase self-center">5'</span>
                    <div style={{ width: `${(alignmentContext?.relativeStart || 0) * CHAR_W}px` }} className="flex-shrink-0" />

                    <div className="flex">
                      {bindingBases.map((bBase, idx) => {
                        const tail = tailMap.get(idx);
                        const rawTemplateBase = alignmentContext?.full[alignmentContext.relativeStart + idx] || '';
                        const isMatch = isBaseCompatible(bBase, rawTemplateBase);

                        return (
                          <div key={idx} style={{ width: `${CHAR_W}px` }} className="relative flex flex-col items-center">
                            {tail && (
                              <div 
                                className={`absolute bottom-[30px] px-1 bg-white border-2 border-indigo-200 rounded-md text-indigo-400 font-bold z-50 transform ${idx === 0 ? 'right-full translate-x-1.5' : 'left-0 -translate-x-1/2'}`}
                                style={{ fontSize: '11px' }}
                              >
                                {tail}
                              </div>
                            )}
                            <div className={`h-5 w-full flex items-center justify-center font-black ${isMatch ? 'text-indigo-700' : 'text-rose-500 bg-rose-50'} bg-indigo-50/50 rounded-sm`}>
                              {/[A-Z]/.test(bBase) ? bBase : bBase.toLowerCase()}
                            </div>
                            <div className={`h-5 flex items-center justify-center ${isMatch ? 'text-slate-300' : 'text-rose-400 font-bold'}`}>
                              {isMatch ? "|" : "·"}
                            </div>
                          </div>
                        );
                      })}
                      {tailMap.has(bindingBases.length) && (
                        <div className="relative" style={{ width: 0 }}>
                          <div className="absolute bottom-[30px] left-0 px-1 bg-white border-2 border-indigo-200 rounded-md text-indigo-400 font-bold z-50 transform translate-x(1)">
                            {tailMap.get(bindingBases.length)}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="ml-4 text-[9px] font-black text-slate-300 tracking-widest uppercase self-center">3'</span>
                 </div>

                 <div className="flex items-center">
                    <span className="mr-4 text-[9px] font-black text-blue-500 tracking-widest uppercase self-center">5'</span>
                    <div className="flex">
                       {alignmentContext?.full.split('').map((base, i) => {
                          const isInBindingRange = i >= alignmentContext.relativeStart && i < alignmentContext.relativeStart + bindingBases.length;
                          return (
                            <div key={i} style={{ width: `${CHAR_W}px` }} className={`text-center h-5 flex items-center justify-center font-medium ${isInBindingRange ? 'text-slate-900 bg-amber-50/30 font-bold' : 'text-slate-300'}`}>
                               {base.toUpperCase()}
                            </div>
                          );
                       })}
                    </div>
                    <span className="ml-4 text-[9px] font-black text-blue-500 tracking-widest uppercase self-center">3' ({strand})</span>
                 </div>

              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative group">
            <div className="absolute -top-2.5 left-4 bg-white px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">编辑引物序列</div>
            <textarea 
              value={sequence}
              onChange={(e) => setSequence(e.target.value.replace(/[^a-zA-Z RYSWKMBDHVN\[\]]/g, ''))}
              placeholder="例如: [TTTTTT]ACCACCACCCAACACACAAT[CGT]AACAAACACA"
              className="w-full px-4 py-4 border-2 border-slate-100 rounded-2xl dna-font text-lg focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all tracking-wider text-slate-800 font-bold bg-slate-50/50 shadow-inner resize-none min-h-[70px]"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex bg-slate-50 border-b border-slate-200 p-1 gap-1">
              {[
                { id: 'hairpin', label: '发卡结构', dg: hairpin?.dg },
                { id: 'self', label: '自身二聚体', dg: selfDimer?.dg },
                { id: 'cross', label: '交叉二聚体', dg: crossDimer?.dg }
              ].map(tab => {
                // 将警戒阈值统一设定为 -2.0
                const isRisky = tab.dg !== undefined && tab.dg < -2.0;
                return (
                  <button 
                    key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:bg-slate-200/50'}`}
                  >
                    {tab.label}
                    {tab.dg !== undefined && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[8px] ${isRisky ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
                        {tab.dg.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="p-4 bg-slate-900 min-h-[140px] flex flex-col font-mono text-white overflow-x-auto relative">
              {activeTab === 'hairpin' ? (
                hairpin ? (
                  <>
                    <div className="absolute top-2 right-4 text-[10px] text-slate-400 font-black">ΔG = {hairpin.dg.toFixed(1)}</div>
                    <div className="text-xs font-bold mb-2 text-indigo-400 uppercase tracking-tighter">HAIRPIN STRUCTURE</div>
                    <pre className="text-xs leading-relaxed text-amber-400">{hairpin.alignment.join('\n')}</pre>
                  </>
                ) : <div className="m-auto text-emerald-400 text-[10px] font-black uppercase tracking-widest">未检测到发卡风险</div>
              ) : activeTab === 'self' ? (
                selfDimer ? (
                  <>
                    <div className="absolute top-2 right-4 text-[10px] text-slate-400 font-black">ΔG = {selfDimer.dg.toFixed(1)}</div>
                    <div className="text-xs font-bold mb-2 text-indigo-400 uppercase tracking-tighter">SELF-DIMER ALIGNMENT</div>
                    <pre className="text-xs leading-relaxed text-amber-400">{selfDimer.alignment.join('\n')}</pre>
                  </>
                ) : <div className="m-auto text-emerald-400 text-[10px] font-black uppercase tracking-widest">未检测到自身二聚体风险</div>
              ) : (
                <div className="space-y-3">
                  <select 
                    value={crossTargetId} onChange={(e) => setCrossTargetId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-[10px] font-bold border-none rounded-lg p-2 outline-none"
                  >
                    <option value="">-- 选择对比引物 --</option>
                    {existingPrimers.filter(p => p.id !== primerId).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.strand})</option>
                    ))}
                  </select>
                  {crossDimer ? (
                    <>
                      <div className="absolute top-10 right-4 text-[10px] text-slate-400 font-black">ΔG = {crossDimer.dg.toFixed(1)}</div>
                      <pre className="text-xs leading-relaxed text-amber-400">{crossDimer.alignment.join('\n')}</pre>
                    </>
                  ) : <div className="py-8 text-center text-slate-500 text-[10px]">请选择另一条引物进行交叉分析</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          {primerId && onDelete && (
            <button onClick={() => onDelete(primerId)} className="px-4 py-2 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-xl transition-all">删除引物</button>
          )}
          <div className="flex gap-4 ml-auto">
            <button onClick={onCancel} className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">取消</button>
            <button 
              onClick={() => onConfirm({ name, sequence, strand, start, length: bindingBases.length, isMGB })}
              className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg active:scale-95 transition-all"
            >
              保存修改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
