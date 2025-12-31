
import React, { useState } from 'react';
import { Primer, StrandType } from '../types';

interface PrimerDialogProps {
  initialSequence: string;
  strand: StrandType;
  start: number;
  primerId?: string;
  initialName?: string;
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
  onConfirm,
  onDelete,
  onCancel
}) => {
  const [name, setName] = useState(initialName || `Primer-${Math.floor(Math.random() * 1000)}`);
  const [sequence, setSequence] = useState(initialSequence.toUpperCase());

  // 判断方向
  const isForward = [StrandType.F, StrandType.OT, StrandType.CTOB].includes(strand);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-[520px] border border-slate-200 animate-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{primerId ? '修改引物' : '设计引物'}</h2>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5 ml-1">引物名称</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-semibold text-slate-700"
              placeholder="输入引物名称..."
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5 ml-1">引物序列 (5' → 3')</label>
            <textarea 
              rows={3}
              value={sequence}
              onChange={(e) => setSequence(e.target.value.toUpperCase().replace(/[^ATCG]/g, ''))}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl dna-font text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all tracking-widest text-emerald-700 font-bold bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <span className="block text-[10px] font-black text-blue-400 uppercase mb-1">模板链</span>
              <span className="text-sm font-bold text-blue-800">{strand} ({isForward ? '正向' : '反向'})</span>
            </div>
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <span className="block text-[10px] font-black text-indigo-400 uppercase mb-1">物理长度</span>
              <span className="text-sm font-bold text-indigo-800">{sequence.length} bp</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between gap-3">
          <div>
            {primerId && onDelete && (
              <button 
                onClick={() => onDelete(primerId)}
                className="px-6 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                删除引物
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
            <button 
              onClick={() => onConfirm({ name, sequence: sequence.toLowerCase(), strand, start, length: sequence.length })}
              className="px-8 py-2.5 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              确认保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
