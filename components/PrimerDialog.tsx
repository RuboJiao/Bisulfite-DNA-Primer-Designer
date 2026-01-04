
import React, { useState, useMemo } from 'react';
import { Primer, StrandType, ThermodynamicSettings } from '../types';
import { 
  calculateThermodynamics, 
  findMostStableDimer, 
  findMostStableHairpin,
  DEFAULT_THERMO_SETTINGS
} from '../services/dnaUtils';

interface PrimerDialogProps {
  initialSequence: string;
  strand: StrandType;
  start: number;
  primerId?: string;
  initialName?: string;
  initialIsMGB?: boolean;
  thermoSettings?: ThermodynamicSettings; // New prop
  existingPrimers: Primer[];
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
  onConfirm,
  onDelete,
  onCancel
}) => {
  const [name, setName] = useState(initialName || `Primer-${Math.floor(Math.random() * 1000)}`);
  const [sequence, setSequence] = useState(initialSequence); 
  const [isMGB, setIsMGB] = useState(initialIsMGB);
  const [activeTab, setActiveTab] = useState<'hairpin' | 'self' | 'cross'>('hairpin');
  const [crossTargetId, setCrossTargetId] = useState<string>('');

  const stats = useMemo(() => calculateThermodynamics(sequence, isMGB, thermoSettings), [sequence, isMGB, thermoSettings]);
  const hairpin = useMemo(() => findMostStableHairpin(sequence), [sequence]);
  const selfDimer = useMemo(() => findMostStableDimer(sequence, sequence), [sequence]);
  
  const crossTarget = useMemo(() => existingPrimers.find(p => p.id === crossTargetId), [existingPrimers, crossTargetId]);
  
  const crossDimer = useMemo(() => {
    if (!crossTarget) return null;
    const isTargetReverse = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(crossTarget.strand);
    const targetSeq5to3 = isTargetReverse ? crossTarget.sequence.split('').reverse().join('') : crossTarget.sequence;
    return findMostStableDimer(sequence, targetSeq5to3);
  }, [sequence, crossTarget]);

  // 新规则：大写代表 LNA
  const lnaCount = (sequence.match(/[A-Z]/g) || []).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-[780px] max-h-[98vh] overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in duration-200">
        
        {/* Quality Scoreboard */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">引物分析</h2>
                <div className="flex gap-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{strand} 链 · 坐标 {start + 1}</p>
                  {lnaCount > 0 && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">LNA x{lnaCount}</span>}
                  {isMGB && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">MGB 修饰</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {/* MGB Toggle */}
               <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[10px] font-black uppercase text-slate-400">MGB 修饰</span>
                  <div className="relative inline-flex items-center">
                    <input 
                      type="checkbox" 
                      checked={isMGB} 
                      onChange={(e) => setIsMGB(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
               </label>

               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase text-slate-400">名称</span>
                 <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs font-bold text-indigo-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 w-32"
                />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '长度', val: `${sequence.length}nt` },
              { label: 'Tm', val: `${stats.tm.toFixed(1)}°C`, color: 'text-indigo-600' },
              { label: 'GC', val: `${stats.gc.toFixed(1)}%`, color: 'text-fuchsia-600' },
              { label: 'ΔG', val: `${stats.dg.toFixed(1)}`, color: 'text-orange-600' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-xl py-2 px-3 shadow-sm flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 tracking-tighter">{item.label}</span>
                <span className={`text-sm font-black ${item.color || 'text-slate-800'}`}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editing Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative group">
            <div className="absolute -top-2.5 left-4 bg-white px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">引物序列 (5' → 3')</div>
            <textarea 
              value={sequence}
              onChange={(e) => setSequence(e.target.value.replace(/[^a-zA-Z RYSWKMBDHVN]/g, ''))}
              placeholder="小写: 普通碱基; 大写: LNA 修饰"
              className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl dna-font text-lg focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all tracking-[0.15em] text-slate-800 font-bold bg-slate-50/50 shadow-inner resize-none min-h-[50px]"
              rows={1}
            />
            <div className="mt-1 text-[9px] text-slate-400 font-bold italic">提示：使用大写字母标注 LNA 修饰位点，每个位点将显著提升 Tm 值。</div>
          </div>

          {/* Alignment Analysis */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="flex bg-slate-50 border-b border-slate-200 p-1.5 gap-1.5">
              {[
                { id: 'hairpin', label: 'Hairpin', status: hairpin ? 'RISK' : 'SAFE' },
                { id: 'self', label: 'Self-Dimer', status: selfDimer ? `${selfDimer.dg.toFixed(1)}` : 'SAFE' },
                { id: 'cross', label: 'Cross-Dimer', status: crossDimer ? `${crossDimer.dg.toFixed(1)}` : 'CHECK' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center transition-all ${activeTab === tab.id ? 'bg-white shadow ring-1 ring-slate-200' : 'hover:bg-slate-200/50 opacity-60'}`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}>{tab.label}</span>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${tab.status === 'SAFE' ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>{tab.status}</span>
                </button>
              ))}
            </div>

            <div className="p-4 bg-slate-900 min-h-[140px] max-h-[180px] flex flex-col font-mono text-white overflow-x-auto">
              {activeTab === 'hairpin' && (
                hairpin ? (
                  <div className="m-auto w-full">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Hairpin Structure</span>
                      <span className="text-white/40 text-[9px] font-bold">ΔG = {hairpin.dg.toFixed(1)}</span>
                    </div>
                    <div className="text-center">
                      <pre className="text-xs leading-[1.4] whitespace-pre text-left dna-font select-all inline-block mx-auto py-2 px-4 bg-white/5 rounded-lg border border-white/10 shadow-inner">
                        {hairpin.alignment.join('\n')}
                      </pre>
                    </div>
                  </div>
                ) : <div className="m-auto text-emerald-400 text-[10px] font-black uppercase tracking-widest">未检出风险结构</div>
              )}

              {activeTab === 'self' && (
                selfDimer ? (
                  <div className="m-auto w-full">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Self-Dimer Alignment</span>
                      <span className="text-white/40 text-[9px] font-bold">ΔG = {selfDimer.dg.toFixed(1)}</span>
                    </div>
                    <div className="text-center">
                       <pre className="text-xs leading-[1.4] whitespace-pre text-left dna-font select-all inline-block mx-auto py-2 px-4 bg-white/5 rounded-lg border border-white/10 shadow-inner">{selfDimer.alignment.join('\n')}</pre>
                    </div>
                  </div>
                ) : <div className="m-auto text-emerald-400 text-[10px] font-black uppercase tracking-widest">未检出二聚体风险</div>
              )}

              {activeTab === 'cross' && (
                <div className="flex flex-col h-full gap-3">
                  <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
                    <span className="text-[9px] text-white/50 font-black uppercase ml-1 tracking-widest">交叉对象:</span>
                    <select 
                      value={crossTargetId}
                      onChange={(e) => setCrossTargetId(e.target.value)}
                      className="flex-1 bg-slate-800 text-white text-[10px] font-bold border-none rounded-lg focus:ring-1 focus:ring-indigo-500 py-1.5 outline-none"
                    >
                      <option value="">-- 选择其它已存引物 --</option>
                      {existingPrimers.filter(p => p.id !== primerId).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.strand})</option>
                      ))}
                    </select>
                  </div>
                  
                  {crossDimer ? (
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                        <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Cross-Dimer Alignment</span>
                        <span className="text-white/40 text-[9px] font-bold">ΔG = {crossDimer.dg.toFixed(1)}</span>
                      </div>
                      <div className="text-center">
                        <pre className="text-xs leading-[1.4] whitespace-pre text-left dna-font select-all inline-block mx-auto py-2 px-4 bg-white/5 rounded-lg border border-white/10 shadow-inner">{crossDimer.alignment.join('\n')}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="m-auto text-slate-500 text-[10px] font-bold italic">
                      选择另一条引物进行分析
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <div>
            {primerId && onDelete && (
              <button 
                onClick={() => onDelete(primerId)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                删除
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={onCancel} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">取消</button>
            <button 
              onClick={() => onConfirm({ 
                name, 
                sequence, 
                strand, 
                start, 
                length: sequence.length,
                isMGB 
              })}
              className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              保存引物
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
