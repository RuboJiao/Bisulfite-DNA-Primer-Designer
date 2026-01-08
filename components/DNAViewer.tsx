
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { StrandType, Primer, SelectionState, SearchResult } from '../types';
import { getStrandSequence, isBaseCompatible } from '../services/dnaUtils';

interface DNAViewerProps {
  sequence: string;
  methylatedF: number[];
  methylatedR: number[];
  primers: Primer[];
  selection: SelectionState | null;
  selectedPrimerId: string | null;
  searchResults: SearchResult[];
  onSelectionChange: React.Dispatch<React.SetStateAction<SelectionState | null>>;
  onSelectPrimer: (id: string | null) => void;
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

const PRIMER_THEMES: Record<StrandType, { color: string, fill: string }> = {
  [StrandType.F]: { color: '#1d4ed8', fill: '#eff6ff' },
  [StrandType.R]: { color: '#3b82f6', fill: '#f0f9ff' },
  [StrandType.OT]: { color: '#7e22ce', fill: '#faf5ff' },
  [StrandType.CTOT]: { color: '#a855f7', fill: '#f5f3ff' },
  [StrandType.OB]: { color: '#c2410c', fill: '#fff7ed' },
  [StrandType.CTOB]: { color: '#f97316', fill: '#fffaf5' },
};

const BASE_WIDTH_PX = 9.5;
const BASE_HEIGHT_PX = 20;

// 辅助函数：反转带括号的序列（如 [TTT]atgc -> cgta[TTT]），用于反向链显示对齐
const reverseSequenceWithBrackets = (s: string) => {
  const parts = s.split(/(\[[^\]]*\])/g).filter(Boolean);
  return parts.reverse().map(p => {
    if (p.startsWith('[') && p.endsWith(']')) return p;
    return p.split('').reverse().join('');
  }).join('');
};

export const DNAViewer: React.FC<DNAViewerProps> = ({
  sequence,
  methylatedF,
  methylatedR,
  primers,
  selection,
  selectedPrimerId,
  searchResults,
  onSelectionChange,
  onSelectPrimer,
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

  // 新增：自动跳转至搜索结果
  useEffect(() => {
    if (searchResults.length > 0 && containerRef.current && basesPerLine > 0) {
      const firstResult = searchResults[0];
      const blockIndex = Math.floor(firstResult.start / basesPerLine);
      const blocks = containerRef.current.querySelectorAll('.dna-block');
      if (blocks[blockIndex]) {
        blocks[blockIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [searchResults, basesPerLine]);

  const strandSequences = useMemo(() => {
    const map: Record<StrandType, string> = {} as any;
    STRANDS_ORDER.forEach(type => {
      map[type] = getStrandSequence(sequence, methylatedF, methylatedR, type);
    });
    return map;
  }, [sequence, methylatedF, methylatedR]);

  const handleMouseDown = (strand: StrandType, index: number) => {
    onSelectionChange({ strand, start: index, end: index });
    onSelectPrimer(null); // 拖拽选择时取消引物选中
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

  const isSelectedRange = (index: number) => {
    if (!selection) return false;
    const min = Math.min(selection.start, selection.end);
    const max = Math.max(selection.start, selection.end);
    return index >= min && index <= max;
  };

  const renderPrimer = (primer: Primer, currentBlockStart: number, currentBlockEnd: number) => {
    const isSelected = selectedPrimerId === primer.id;
    const isForward = [StrandType.F, StrandType.OT, StrandType.CTOB].includes(primer.strand);
    const displaySeq = isForward ? primer.sequence : reverseSequenceWithBrackets(primer.sequence);
    
    const parts = displaySeq.split(/(\[[^\]]*\])/g);
    let currentBindIdx = primer.start;
    
    interface Unit { char: string; tIdx: number }
    const bindingUnits: Unit[] = [];
    const tails = new Map<number, string>(); 

    parts.forEach(part => {
      if (!part) return;
      if (part.startsWith('[') && part.endsWith(']')) {
        tails.set(bindingUnits.length, part.slice(1, -1));
      } else {
        for (const char of part) {
          bindingUnits.push({ char, tIdx: currentBindIdx++ });
        }
      }
    });

    const strandSeq = strandSequences[primer.strand];
    const theme = PRIMER_THEMES[primer.strand];
    const visibleBinding = bindingUnits.filter(u => u.tIdx >= currentBlockStart && u.tIdx <= currentBlockEnd);
    if (visibleBinding.length === 0) return null;

    const H_BIND = 16;
    const OFFSET_TAIL = 16; 
    const unitWidth = BASE_WIDTH_PX;
    
    // 计算边界
    let minX = 0;
    if (tails.has(0)) minX = -(tails.get(0)!.length * unitWidth);
    
    let maxX = bindingUnits.length * unitWidth;
    if (tails.has(bindingUnits.length)) {
      maxX += (tails.get(bindingUnits.length)!.length * unitWidth);
    }

    const points: {x: number, y: number}[] = [];
    
    // 1. 上边缘
    if (tails.has(0)) {
        points.push({ x: minX, y: 0 });
        points.push({ x: minX, y: -OFFSET_TAIL });
        points.push({ x: 0, y: -OFFSET_TAIL });
    }
    points.push({ x: 0, y: 0 });

    for (let i = 1; i < bindingUnits.length; i++) {
        if (tails.has(i)) {
            const curX = i * unitWidth;
            const tLen = tails.get(i)!.length * unitWidth;
            points.push({ x: curX, y: 0 });
            points.push({ x: curX, y: -OFFSET_TAIL });
            points.push({ x: curX + tLen, y: -OFFSET_TAIL });
            points.push({ x: curX + tLen, y: 0 });
        }
    }

    const lastBindX = bindingUnits.length * unitWidth;
    points.push({ x: lastBindX, y: 0 });
    if (tails.has(bindingUnits.length)) {
        points.push({ x: lastBindX, y: -OFFSET_TAIL });
        points.push({ x: maxX, y: -OFFSET_TAIL });
        points.push({ x: maxX, y: 0 });
    }

    // 2. 下边缘（包含 tail 提示点）
    points.push({ x: maxX, y: H_BIND });
    for (let i = bindingUnits.length; i >= 0; i--) {
        if (tails.has(i)) {
            const curX = i * unitWidth;
            points.push({ x: curX + 1.5, y: H_BIND });
            points.push({ x: curX, y: H_BIND - 3 }); 
            points.push({ x: curX - 1.5, y: H_BIND });
        }
    }
    points.push({ x: minX, y: H_BIND });
    
    const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + " Z";

    return (
      <div 
        key={primer.id}
        className={`absolute ${isSelected ? 'z-[60]' : 'z-40'}`}
        style={{ 
          left: `${(primer.start - currentBlockStart) * BASE_WIDTH_PX}px`,
          top: `-18px`,
        }}
      >
        {/* SVG 背景框：坐标原点对应结合区起点 */}
        <svg 
          style={{ 
            position: 'absolute', 
            left: `${minX}px`, 
            top: `${-OFFSET_TAIL}px`, 
            overflow: 'visible' 
          }}
          width={maxX - minX} 
          height={H_BIND + OFFSET_TAIL} 
          viewBox={`${minX} ${-OFFSET_TAIL} ${maxX - minX} ${H_BIND + OFFSET_TAIL}`}
          className="pointer-events-none"
        >
          <path 
            d={pathD} 
            fill={theme.fill} 
            stroke={isSelected ? '#2563eb' : theme.color} 
            strokeWidth={isSelected ? "2.5" : "1.2"} 
            strokeLinejoin="round" 
            className="transition-all"
          />
          
          {isForward ? (
            <path d={`M ${lastBindX} 0 L ${lastBindX + 7} ${H_BIND/2} L ${lastBindX} ${H_BIND} Z`} fill={isSelected ? '#2563eb' : theme.color} />
          ) : (
            <path d={`M 0 0 L -7 ${H_BIND/2} L 0 ${H_BIND} Z`} fill={isSelected ? '#2563eb' : theme.color} />
          )}

          <text 
            x={minX - 6} 
            y={-OFFSET_TAIL + 8}
            textAnchor="end"
            className={`font-black italic pointer-events-auto cursor-pointer select-none hover:underline ${isSelected ? 'underline' : ''}`}
            style={{ fontSize: '9px', fill: isSelected ? '#1e40af' : theme.color, opacity: isSelected ? 1 : 0.8 }}
            onClick={(e) => { 
                e.stopPropagation(); 
                if (isSelected) onEditPrimer(primer);
                else onSelectPrimer(primer.id);
            }}
          >
            {primer.name}
          </text>
        </svg>

        {/* 序列内容：结合区从 0 开始渲染 */}
        <div className="relative dna-font text-[9px] leading-none pointer-events-none" style={{ height: `${H_BIND}px` }}>
          {bindingUnits.map((u, idx) => {
            if (u.tIdx < currentBlockStart || u.tIdx > currentBlockEnd) return null;
            const isMatch = isBaseCompatible(u.char, strandSeq[u.tIdx] || '');
            const isDegenerate = !['A', 'T', 'C', 'G', 'a', 't', 'c', 'g'].includes(u.char);
            return (
              <div 
                key={idx} 
                className="absolute flex items-center justify-center font-black pointer-events-auto cursor-pointer" 
                onClick={(e) => { e.stopPropagation(); onSelectPrimer(primer.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); onEditPrimer(primer); }}
                style={{ 
                  left: `${idx * unitWidth}px`, 
                  width: `${unitWidth}px`, 
                  height: `${H_BIND}px`,
                  color: isMatch && !isDegenerate ? (isSelected ? '#1e40af' : theme.color) : undefined
                }}
              >
                <span className={!isMatch ? 'bg-rose-500 text-white rounded-[1px] px-[1px]' : isDegenerate ? 'bg-emerald-500 text-white rounded-[1px] px-[1px]' : ''}>
                    {/[A-Z]/.test(u.char) ? u.char : u.char.toLowerCase()}
                </span>
              </div>
            );
          })}

          {Array.from(tails.entries()).map(([bindIdx, content]) => (
            <div 
              key={`tail-${bindIdx}`} 
              className="absolute flex pointer-events-auto cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); onSelectPrimer(primer.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onEditPrimer(primer); }}
              style={{ 
                left: bindIdx === 0 ? `-${content.length * unitWidth}px` : `${bindIdx * unitWidth}px`, 
                top: `-${OFFSET_TAIL}px`, 
                height: `${H_BIND}px` 
              }}
            >
              {content.split('').map((c, i) => (
                <div key={i} style={{ width: `${unitWidth}px` }} className="flex items-center justify-center font-bold text-slate-400">
                  {c.toLowerCase()}
                </div>
              ))}
            </div>
          ))}
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
        style={{ left: `${startIdx * BASE_WIDTH_PX - 2}px`, width: `${width * BASE_WIDTH_PX + 4}px` }}
      />
    );
  };

  const blocks = [];
  for (let i = 0; i < sequence.length; i += basesPerLine) {
    blocks.push({ start: i, end: Math.min(i + basesPerLine - 1, sequence.length - 1) });
  }

  // 辅助函数判断某个索引是否属于被选中的引物的绑定区域
  const isIdxInSelectedPrimer = (globalIdx: number, strand: StrandType) => {
    if (!selectedPrimerId) return false;
    const p = primers.find(primer => primer.id === selectedPrimerId);
    if (!p || p.strand !== strand) return false;
    return globalIdx >= p.start && globalIdx < p.start + p.length;
  };

  return (
    <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto px-6 py-12 space-y-20 bg-white select-none dna-font"
        onClick={() => onSelectPrimer(null)} // 点击空白处取消选中
    >
      {blocks.map((block) => (
        <div key={block.start} className="dna-block relative pl-12 pr-12">
          <div className="absolute left-4 top-0 text-[10px] font-bold text-slate-300">
            {block.start + 1}
          </div>
          <div className="absolute right-0 top-0 text-[10px] font-bold text-slate-300">
            {block.end + 1}
          </div>

          <div className="flex flex-col gap-[36px]">
            {STRANDS_ORDER.map((type) => {
              const isBottomStrand = [StrandType.R, StrandType.OB, StrandType.CTOT].includes(type);
              const activeMethylList = isBottomStrand ? methylatedR : methylatedF;
              return (
                <div key={type} className="relative flex items-center" style={{ height: `${BASE_HEIGHT_PX}px` }}>
                  <div className={`w-12 shrink-0 flex flex-col items-end pr-3 ${COLORS[type]}`}>
                    <span className="text-[10px] font-black tracking-tighter leading-none">{type}</span>
                    <span className="text-[8px] opacity-30 font-bold leading-tight uppercase">
                      {[StrandType.F, StrandType.OT, StrandType.CTOB].includes(type) ? "5'-3'" : "3'-5'"}
                    </span>
                  </div>
                  
                  <div className="absolute left-12 top-0 w-full h-full pointer-events-none">
                    {primers.filter(p => p.strand === type).map(p => renderPrimer(p, block.start, block.end))}
                  </div>

                  <div className={`flex relative border-b border-slate-100/50 ${COLORS[type]} text-[14px] leading-none h-full items-center z-10`}>
                    {strandSequences[type]
                      .slice(block.start, block.end + 1)
                      .split('')
                      .map((base, idx) => {
                        const globalIdx = block.start + idx;
                        const isC = base.toLowerCase() === 'c';
                        const isMethylated = activeMethylList.includes(globalIdx) && isC;
                        const active = isSelectedRange(globalIdx);
                        const isPrimerBindingHighlight = isIdxInSelectedPrimer(globalIdx, type);

                        return (
                          <div
                            key={globalIdx}
                            data-idx={globalIdx}
                            onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(type, globalIdx); }}
                            style={{ width: `${BASE_WIDTH_PX}px` }}
                            className={`text-center cursor-pointer transition-colors shrink-0 h-full flex items-center justify-center
                              ${active ? 'bg-yellow-200 text-black outline outline-1 outline-yellow-400 z-30' : ''} 
                              ${!active && isPrimerBindingHighlight ? 'bg-amber-100 outline outline-1 outline-amber-300 z-20' : ''}
                              ${isMethylated ? 'font-black text-red-600' : ''}`}
                          >
                            {isMethylated ? 'C' : base}
                          </div>
                        );
                      })}
                    {searchResults.filter(r => r.strand === type).map(r => renderSearchHighlight(r, block.start, block.end))}
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
