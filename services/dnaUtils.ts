
import { StrandType, SearchResult, ThermodynamicSettings } from '../types';

export const COMPLEMENTS: Record<string, string> = {
  a: 't', t: 'a', c: 'g', g: 'c',
  A: 'T', T: 'A', C: 'G', G: 'C'
};

export const IUPAC_MAP: Record<string, string[]> = {
  'A': ['A'], 'a': ['A'],
  'T': ['T'], 't': ['T'],
  'C': ['C'], 'c': ['C'],
  'G': ['G'], 'g': ['G'],
  'R': ['A', 'G'],
  'Y': ['C', 'T'],
  'S': ['G', 'C'],
  'W': ['A', 'T'],
  'K': ['G', 'T'],
  'M': ['A', 'C'],
  'B': ['C', 'G', 'T'],
  'D': ['A', 'G', 'T'],
  'H': ['A', 'C', 'T'],
  'V': ['A', 'C', 'G'],
  'N': ['A', 'T', 'C', 'G'],
};

export const DEFAULT_THERMO_SETTINGS: ThermodynamicSettings = {
  oligoConc: 0.2,
  naConc: 50,
  mgConc: 3,
  dntpConc: 0.8
};

export const isBaseCompatible = (primerBase: string, templateBase: string): boolean => {
  if (!primerBase || !templateBase) return false;
  const p = primerBase.toUpperCase();
  const t = templateBase.toUpperCase();
  if (!IUPAC_MAP[p]) return p === t;
  return IUPAC_MAP[p].includes(t);
};

export const getComplement = (seq: string): string => {
  return seq.split('').map(b => COMPLEMENTS[b] || b).join('');
};

export const getReverseComplement = (seq: string): string => {
  return getComplement(seq).split('').reverse().join('');
};

export const calculateThermodynamics = (
  rawSequence: string, 
  templateSequence: string = "", 
  isMGB: boolean = false,
  settings: ThermodynamicSettings = DEFAULT_THERMO_SETTINGS
): any => {
  const bindingSequence = rawSequence.replace(/\[[^\]]*\]/g, '');
  const cleanTemplate = templateSequence.replace(/\[[^\]]*\]/g, '');
  
  const n = bindingSequence.length;
  if (n < 2) return { tm: 0, dg: 0, gc: 0 };

  const lnaPositions = bindingSequence.split('').map((char, i) => /[A-Z]/.test(char) ? i : -1).filter(i => i !== -1);
  const seq = bindingSequence.toLowerCase();
  const tSeq = cleanTemplate.toLowerCase();

  let dh = 0; 
  let ds = 0; 

  for (let i = 0; i < n - 1; i++) {
    const p1 = seq[i], p2 = seq[i+1];
    const t1 = tSeq[i] || '', t2 = tSeq[i+1] || '';
    const m1 = cleanTemplate ? isBaseCompatible(p1, t1) : true;
    const m2 = cleanTemplate ? isBaseCompatible(p2, t2) : true;

    if (m1 && m2) {
      const pair = p1 + p2;
      const p = NN_PARAMS[pair];
      if (p) { dh += p.h; ds += p.s; }
    } else {
      dh += -1.2; 
      ds += -4.5; 
    }
  }

  const firstMatch = cleanTemplate ? isBaseCompatible(seq[0], tSeq[0]) : true;
  const lastMatch = cleanTemplate ? isBaseCompatible(seq[n-1], tSeq[n-1]) : true;

  dh += 0.2; ds += -5.7;

  if (firstMatch && (seq[0] === 'a' || seq[0] === 't')) { dh += 2.2; ds += 6.9; }
  if (lastMatch && (seq[n-1] === 'a' || seq[n-1] === 't')) { dh += 2.2; ds += 6.9; }

  if (!firstMatch) { dh += 4.5; ds += 12.0; }
  if (!lastMatch) { dh += 5.5; ds += 15.0; } 

  const R = 1.987; 
  const T_std = 273.15 + 37; 
  const Ct = settings.oligoConc * 1e-6; 
  const k = Ct / 4; 
  
  const tm1M = ((dh * 1000) / (ds + R * Math.log(k))) - 273.15;
  const invTm1M = 1 / (tm1M + 273.15);

  const monovalent = settings.naConc / 1000; 
  const mg = settings.mgConc / 1000; 
  const dntp = settings.dntpConc / 1000; 
  const freeMg = Math.max(0.0000001, mg - dntp); 
  const gcCount = (seq.match(/[gc]/g) || []).length;
  const fGC = gcCount / n;
  let invTmSalt = invTm1M;

  if (freeMg === 0.0000001 || monovalent > freeMg * 100) {
    const lnNa = Math.log(monovalent);
    invTmSalt = invTm1M + (4.29 * fGC - 3.95) * 1e-5 * lnNa + 9.4e-6 * Math.pow(lnNa, 2);
  } else {
    const lnMg = Math.log(freeMg);
    const a = 3.92e-5, b = -9.11e-6, c = 6.26e-5, d = 1.42e-5, e = -4.82e-4, f = 5.25e-4, g = 1.07e-5;
    invTmSalt = invTm1M + a + b * lnMg + fGC * (c + d * lnMg) + 
                (1 / (2 * (n - 1))) * (e + f * lnMg + g * Math.pow(lnMg, 2));
  }

  let tm = (1 / invTmSalt) - 273.15;

  if (lnaPositions.length > 0) {
    lnaPositions.forEach(pos => {
      const isMatched = cleanTemplate ? isBaseCompatible(bindingSequence[pos], tSeq[pos]) : true;
      if (isMatched) {
        const boost = (seq[pos] === 'g' || seq[pos] === 'c') ? 5.2 : 3.8;
        tm += boost;
      } else {
        tm -= 6.5; 
      }
    });
  }

  if (isMGB) {
    const matchCount = cleanTemplate ? bindingSequence.split('').filter((b, i) => isBaseCompatible(b, tSeq[i])).length : n;
    const matchRatio = matchCount / n;
    const mgbBoost = (19.5 - (0.12 * (fGC * 100))) * Math.pow(matchRatio, 2);
    tm += mgbBoost;
  }

  return { tm, dg: dh - (T_std * ds / 1000), gc: (gcCount / n) * 100 };
};

const NN_PARAMS: Record<string, { h: number; s: number }> = {
  'aa': { h: -7.9, s: -22.2 }, 'tt': { h: -7.9, s: -22.2 },
  'at': { h: -7.2, s: -20.4 }, 'ta': { h: -7.2, s: -21.3 },
  'ca': { h: -8.5, s: -22.7 }, 'tg': { h: -8.5, s: -22.7 },
  'gt': { h: -8.4, s: -22.4 }, 'ac': { h: -8.4, s: -22.4 },
  'ct': { h: -7.8, s: -21.0 }, 'ag': { h: -7.8, s: -21.0 },
  'ga': { h: -8.2, s: -22.2 }, 'tc': { h: -8.2, s: -22.2 },
  'cg': { h: -10.6, s: -27.2 }, 'gc': { h: -9.8, s: -24.4 },
  'gg': { h: -8.0, s: -19.9 }, 'cc': { h: -8.0, s: -19.9 },
};

export const findMostStableDimer = (s1: string, s2: string): any => {
  const q1 = s1.replace(/[\[\]]/g, '').toUpperCase();
  const q2 = s2.replace(/[\[\]]/g, '').toUpperCase();
  const q2Rev = q2.split('').reverse().join(''); 
  let bestDG = 0;
  let bestResult: any = null;
  for (let shift = -q2.length + 1; shift < q1.length; shift++) {
    let matches = 0;
    let currentDG = 0;
    const overlapStart = Math.max(0, shift);
    const overlapEnd = Math.min(q1.length, shift + q2.length);
    const matchChars: string[] = [];
    for (let i = overlapStart; i < overlapEnd; i++) {
      const b1 = q1[i];
      const b2 = q2Rev[i - shift];
      if (b1 === getComplement(b2).toUpperCase()) { 
        matchChars.push('|'); 
        matches++; 
        currentDG -= 1.8; 
      }
      else { 
        matchChars.push(' '); 
        currentDG += 0.3; 
      }
    }
    if (matches >= 2 && currentDG < bestDG) {
      bestDG = currentDG;
      const indent1 = shift < 0 ? Math.abs(shift) : 0;
      const indent2 = shift > 0 ? shift : 0;
      bestResult = { dg: bestDG, alignment: [
        `5' ${" ".repeat(indent1)}${q1} 3'`,
        `   ${" ".repeat(indent1 + (shift > 0 ? (shift - indent1) : 0))}${matchChars.join('')}`,
        `3' ${" ".repeat(indent2)}${q2Rev} 5'`
      ]};
    }
  }
  return bestResult;
};

/**
 * 优化后的 3' Hairpin 搜索逻辑 (符合 Primer3 逻辑)
 * 1. 强制要求 3' 末端最后一个碱基参与互补配对
 * 2. 扩大环搜索范围至 60nt，以识别长序列折叠风险
 * 3. 使用更精确的 ΔG 模型寻找最稳定结构
 */
export const findMostStableHairpin = (sequence: string): any => {
  const seq = sequence.replace(/[\[\]]/g, '').toUpperCase();
  const n = seq.length;
  let bestDG = 0;
  let bestResult: any = null;

  // 3' hairpin 必须包含序列末尾 (n-1)
  const stem2End = n; 

  // 1. 茎长范围：2bp - 14bp (覆盖更强的互补结构)
  // 2. 环长范围：3nt - 60nt (覆盖更广的距离)
  for (let stemLen = 2; stemLen <= 14; stemLen++) {
    for (let loopLen = 3; loopLen <= 60; loopLen++) {
      const stem2Start = stem2End - stemLen;
      const loopStart = stem2Start - loopLen;
      const stem1Start = loopStart - stemLen;
      
      if (stem1Start < 0) continue;
      
      const stem1 = seq.substring(stem1Start, stem1Start + stemLen);
      const stem2 = seq.substring(stem2Start, stem2End);
      
      // 核心原则：末端碱基必须互补
      const lastBaseMatch = stem2[stemLen - 1] === getComplement(stem1[0]).toUpperCase();
      if (!lastBaseMatch) continue;

      // 整个茎部是否反向互补
      if (stem1 === getReverseComplement(stem2).toUpperCase()) {
        // 计算茎能量 (GC rich 更稳定)
        let stemEnergy = 0;
        for (let i = 0; i < stemLen; i++) {
            const b = stem1[i];
            stemEnergy += (b === 'G' || b === 'C') ? -3.4 : -1.8;
        }

        /**
         * 环能量模型：
         * - 基础惩罚：4.5 kcal/mol
         * - 长度惩罚：使用对数模型或近似线性段落
         * - 3' 端系数：由于 3' 发夹对聚合酶活性干扰极大，对其 ΔG 进行权重下调（显得更负/更危险）
         */
        let loopEnergy = 4.5;
        if (loopLen > 10) {
            loopEnergy += (loopLen - 10) * 0.25; 
        } else {
            loopEnergy += loopLen * 0.4;
        }
        
        const dg = stemEnergy + loopEnergy;
        
        // 寻找最稳定（ΔG 最小）的结构
        if (dg < bestDG) {
          bestDG = dg;
          
          const prefix = seq.substring(0, stem1Start);
          const loop = seq.substring(loopStart, loopStart + loopLen);
          
          const label5 = "5'-";
          const label3 = "3'-";
          const stem2Rev = stem2.split('').reverse().join('');
          
          // 如果环太长，在显示时进行截断提示
          const displayLoop = loop.length > 20 ? `${loop.slice(0, 8)}...${loop.slice(-8)}` : loop;

          /**
           * 修复对齐逻辑：
           * Line 1: [label5][prefix][stem1]
           * Line 2: [padding][|||||][loop]
           * Line 3: [label3][padding][stem2Rev]
           * 确保 stem1StartPos 统一。
           */
          const prefixPadding = " ".repeat(prefix.length);
          const labelPadding = " ".repeat(label5.length + prefix.length);

          bestResult = { 
            dg, 
            alignment: [
              `${label5}${prefix}${stem1}--\\`,
              `${labelPadding}${"|".repeat(stemLen)}   ${displayLoop}`,
              `${label3}${prefixPadding}${stem2Rev}--/`
            ]
          };
        }
      }
    }
  }
  return bestResult;
};

export const searchSequence = (strandSeq: string, query: string, strandType: StrandType, maxMismatches: number): any[] => {
  const results: any[] = [];
  const cleanQuery = query.replace(/[\[\]]/g, '');
  const n = strandSeq.length;
  const m = cleanQuery.length;
  if (m === 0 || m > n) return [];
  const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(strandType);
  const searchPattern = isReversePhysical ? cleanQuery.split('').reverse().join('').toUpperCase() : cleanQuery.toUpperCase();
  for (let i = 0; i <= n - m; i++) {
    let mismatches = 0;
    for (let j = 0; j < m; j++) {
      if (!isBaseCompatible(searchPattern[j], strandSeq[i + j])) mismatches++;
      if (mismatches > maxMismatches) break;
    }
    if (mismatches <= maxMismatches) results.push({ start: i, end: i + m - 1, mismatches });
  }
  return results;
};

export const bisulfiteConvert = (seq: string, methylatedIndices: number[]): string => {
  return seq.split('').map((base, idx) => {
    if (base.toLowerCase() === 'c' && !methylatedIndices.includes(idx)) return 't';
    return base;
  }).join('');
};

export const getStrandSequence = (f_seq: string, methylatedF: number[], methylatedR: number[], type: StrandType): string => {
  const f = f_seq.toLowerCase();
  const r = getComplement(f);
  switch (type) {
    case StrandType.F: return f;
    case StrandType.R: return r;
    case StrandType.OT: return bisulfiteConvert(f, methylatedF);
    case StrandType.CTOT: return getComplement(bisulfiteConvert(f, methylatedF));
    case StrandType.OB: return bisulfiteConvert(r, methylatedR);
    case StrandType.CTOB: return getComplement(bisulfiteConvert(r, methylatedR));
    default: return f;
  }
};

export const parseFasta = (text: string): string => {
  const lines = text.split('\n');
  const seqLines = lines.filter(l => !l.startsWith('>') && l.trim().length > 0);
  return seqLines.join('').replace(/[^atcgATCG]/g, '').toLowerCase();
};

export const parseGenBank = (text: string): string => {
  const originMatch = text.match(/ORIGIN\s+([\s\S]+)\/\//);
  if (!originMatch) return parseFasta(text);
  return originMatch[1].replace(/[0-9\s]/g, '').toLowerCase();
};
