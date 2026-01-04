
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { StrandType, Primer, SelectionState, SearchResult } from '../types';
import { getStrandSequence, isBaseCompatible } from '../services/dnaUtils';

interface DNAViewerProps {
  sequence: string;
  methylatedF: number[];
  methylatedR: number[];
  primers: Primer[];
  selection: SelectionState | null;
  searchResults: SearchResult[];
  onSelectionChange: React.Dispatch<React.SetStateAction<SelectionState | null>>;
  onEditPrimer: (primer: Primer) => void;
}

const STRANDS_ORDER = [
  StrandType.OT,
  StrandType.CTOT,
  StrandType.F,
  StrandType.R,
  StrandType.CTOB,
  StrandType.OB,
];

const COLORS: Record<StrandType, string> = {
  [StrandType.F]: 'text-blue-700',
  [StrandType.R]: 'text-blue-500',
  [StrandType.OT]: 'text-purple-700',
  [StrandType.CTOT]: 'text-purple-500',
  [StrandType.OB]: 'text-orange-700',
  [StrandType.CTOB]: 'text-orange-500',
};

const PRIMER_THEMES: Record<StrandType, string> = {
  [StrandType.F]: 'border-blue-600 bg-white text-blue-700',
  [StrandType.R]: 'border-blue-500 bg-white text-blue-600',
  [StrandType.OT]: 'border-purple-600 bg-white text-purple-700',
  [StrandType.CTOT]: 'border-purple-500 bg-white text-purple-600',
  [StrandType.OB]: 'border-orange-600 bg-white text-orange-700',
  [StrandType.CTOB]: 'border-orange-500 bg-white text-orange-600',
};

const BASE_WIDTH_PX = 9.5;
const BASE_HEIGHT_PX = 20;

export const DNAViewer: React.FC<DNAViewerProps> = ({
  sequence,
  methylatedF,
  methylatedR,
  primers,
  selection,
  searchResults,
  onSelectionChange,
  onEditPrimer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [basesPerLine, setBasesPerLine] = useState(100);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth - 134;
        const calculated = Math.floor(width / BASE_WIDTH_PX);
        setBasesPerLine(Math.max(20, calculated));
      }
    };
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  const strandSequences = useMemo(() => {
    const map: Record<StrandType, string> = {} as any;
    STRANDS_ORDER.forEach(type => {
      map[type] = getStrandSequence(sequence, methylatedF, methylatedR, type);
    });
    return map;
  }, [sequence, methylatedF, methylatedR]);

  const handleMouseDown = (strand: StrandType, index: number) => {
    onSelectionChange({ strand, start: index, end: index });
    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dataIdx = target.getAttribute('data-idx');
      if (dataIdx) {
        onSelectionChange(prev => prev ? { ...prev, end: parseInt(dataIdx) } : null);
      }
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isSelected = (index: number) => {
    if (!selection) return false;
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    return index >= min && index <= max;
  };

  const renderPrimer = (primer: Primer, currentBlockStart: number, currentBlockEnd: number) => {
    const pStart = Math.max(primer.start, currentBlockStart);
    const pEnd = Math.min(primer.start + primer.length - 1, currentBlockEnd);
    if (pStart > pEnd) return null;

    const startIndexInBlock = pStart - currentBlockStart;
    const widthInBases = pEnd - pStart + 1;
    const isForward = [StrandType.F, StrandType.OT, StrandType.CTOB].includes(primer.strand);
    const strandSeq = strandSequences[primer.strand];

    return (
      <div 
        key={primer.id}
        className="absolute z-40 cursor-pointer pointer-events-auto transition-all"
        style={{ 
          left: `${startIndexInBlock * BASE_WIDTH_PX - 2}px`, 
          width: `${widthInBases * BASE_WIDTH_PX + 4}px`,
          top: '-19px',
          height: '18px'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectionChange({ 
            strand: primer.strand, 
            start: primer.start, 
            end: primer.start + primer.length - 1 
          });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEditPrimer(primer);
        }}
      >
        <div className={`relative w-full h-full border-2 rounded-sm flex items-center box-border ${PRIMER_THEMES[primer.strand]} shadow-sm`}>
          {isForward ? (
            <>
              <div className="absolute -right-[8px] top-[-2px] bottom-[-2px] w-0 h-0 border-y-[9px] border-y-transparent border-l-[8px] border-l-current" />
              <div className="absolute -right-[5px] top-[0px] bottom-[0px] w-0 h-0 border-y-[7px] border-y-transparent border-l-[6px] border-l-white z-10" />
            </>
          ) : (
            <>
              <div className="absolute -left-[8px] top-[-2px] bottom-[-2px] w-0 h-0 border-y-[9px] border-y-transparent border-r-[8px] border-r-current" />
              <div className="absolute -left-[5px] top-[0px] bottom-[0px] w-0 h-0 border-y-[7px] border-y-transparent border-r-[6px] border-r-white z-10" />
            </>
          )}

          <div className="flex w-full dna-font text-[10px] font-bold leading-none h-full items-center overflow-hidden">
            {primer.sequence.split('').slice(pStart - primer.start, pEnd - primer.start + 1).map((b, i) => {
              const globalIdx = pStart + i;
              const templateBase = strandSeq[globalIdx];
              const isCompatible = isBaseCompatible(b, templateBase);
              const isDegenerate = !['A', 'T', 'C', 'G'].includes(b.toUpperCase());
              
              // 规则更新：
              // 1. 不兼容 -> 红色背景
              // 2. 兼容且是简并碱基 -> 绿色背景 (emerald-500)
              // 3. 兼容且是普通碱基 -> 不显示高亮 (不高亮即维持引物白色背景)
              let highlightClass = '';
              if (!isCompatible) {
                highlightClass = 'bg-rose-500 text-white';
              } else if (isDegenerate) {
                highlightClass = 'bg-emerald-500 text-white';
              }
              
              return (
                <div 
                  key={i} 
                  style={{ width: `${BASE_WIDTH_PX}px` }} 
                  className={`text-center shrink-0 h-full flex items-center justify-center ${highlightClass}`}
                >
                  {b.toUpperCase()}
                </div>
              );
            })}
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 -top-4 px-1 text-[8px] font-black uppercase rounded bg-white border border-current shadow-sm whitespace-nowrap z-50">
            {primer.name}
          </div>
        </div>
      </div>
    );
  };

  const renderSearchHighlight = (res: SearchResult, blockStart: number, blockEnd: number) => {
    const sStart = Math.max(res.start, blockStart);
    const sEnd = Math.min(res.end, blockEnd);
    if (sStart > sEnd) return null;

    const startIdx = sStart - blockStart;
    const width = sEnd - sStart + 1;

    return (
      <div 
        key={`${res.strand}-${res.start}`}
        className="absolute h-[24px] top-[-2px] z-20 border-2 border-amber-400 bg-amber-400/10 rounded-lg pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.4)] animate-pulse"
        style={{ 
          left: `${startIdx * BASE_WIDTH_PX - 2}px`, 
          width: `${width * BASE_WIDTH_PX + 4}px` 
        }}
      />
    );
  };

  const blocks = [];
  for (let i = 0; i < sequence.length; i += basesPerLine) {
    blocks.push({ start: i, end: Math.min(i + basesPerLine - 1, sequence.length - 1) });
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-9 space-y-16 bg-white select-none dna-font">
      {blocks.map((block) => (
        <div key={block.start} className="relative pl-6 pr-12">
          <div className="absolute left-1 top-0 text-[10px] font-bold text-slate-300">
            {block.start + 1}
          </div>
          <div className="absolute right-0 top-0 text-[10px] font-bold text-slate-300">
            {block.end + 1}
          </div>

          <div className="flex flex-col gap-9">
            {STRANDS_ORDER.map((type) => {
              const isBottomStrand = [StrandType.R, StrandType.OB, StrandType.CTOB].includes(type);
              const activeMethylList = isBottomStrand ? methylatedR : methylatedF;
              
              return (
                <div key={type} className="relative flex items-center" style={{ height: `${BASE_HEIGHT_PX}px` }}>
                  <div className={`w-12 shrink-0 flex flex-col items-end pr-2 ${COLORS[type]}`}>
                    <span className="text-[10px] font-black tracking-tighter leading-none">{type}</span>
                    <span className="text-[8px] opacity-60 font-bold leading-tight">
                      {[StrandType.F, StrandType.OT, StrandType.CTOB].includes(type) ? "5'-3'" : "3'-5'"}
                    </span>
                  </div>
                  
                  <div className={`flex relative border-b border-slate-100 ${COLORS[type]} text-[14px] leading-none h-full items-center`}>
                    {strandSequences[type]
                      .slice(block.start, block.end + 1)
                      .split('')
                      .map((base, idx) => {
                        const globalIdx = block.start + idx;
                        const isC = base.toLowerCase() === 'c';
                        const isMethylated = activeMethylList.includes(globalIdx) && isC;
                        const active = isSelected(globalIdx);
                        
                        const displayChar = isMethylated ? 'C' : base;
                        
                        return (
                          <div
                            key={globalIdx}
                            data-idx={globalIdx}
                            onMouseDown={() => handleMouseDown(type, globalIdx)}
                            style={{ width: `${BASE_WIDTH_PX}px` }}
                            className={`text-center cursor-pointer transition-colors shrink-0 h-full flex items-center justify-center
                              ${active ? 'bg-yellow-200 text-black outline outline-1 outline-yellow-400 z-30' : ''} 
                              ${isMethylated ? 'font-black text-red-600' : ''}`}
                          >
                            {displayChar}
                          </div>
                        );
                      })}

                    {searchResults
                      .filter(r => r.strand === type)
                      .map(r => renderSearchHighlight(r, block.start, block.end))}
                  </div>

                  <div className="absolute left-12 top-0 w-full h-full pointer-events-none">
                    {primers
                      .filter(p => p.strand === type)
                      .map(p => renderPrimer(p, block.start, block.end))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
