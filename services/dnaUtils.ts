
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

/**
 * SantaLucia (1998) Nearest-Neighbor Parameters
 * ΔH: kcal/mol, ΔS: cal/K·mol
 */
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

export interface ThermodynamicResult {
  tm: number;
  dg: number;
  gc: number;
}

/**
 * 核心 Tm 计算逻辑
 * 整合 SantaLucia 1998 NN 模型、Owczarzy 2008 盐修正、
 * 以及针对长引物优化的 LNA 长度依赖模型与 MGB 序列相关性模型。
 */
export const calculateThermodynamics = (
  sequence: string, 
  isMGB: boolean = false,
  settings: ThermodynamicSettings = DEFAULT_THERMO_SETTINGS
): ThermodynamicResult => {
  const n = sequence.length;
  if (n < 2) return { tm: 0, dg: 0, gc: 0 };

  // 1. 分离修饰信息：大写字母视为 LNA 修饰碱基
  const lnaPositions = sequence.split('').map((char, i) => /[A-Z]/.test(char) ? i : -1).filter(i => i !== -1);
  const seq = sequence.toLowerCase().split('').map(b => IUPAC_MAP[b] ? IUPAC_MAP[b][0].toLowerCase() : b).join('');

  // 2. 计算核心 ΔH 和 ΔS (DNA/DNA NN 模型)
  let dh = 0; 
  let ds = 0; 

  for (let i = 0; i < n - 1; i++) {
    const pair = seq.substring(i, i + 2);
    const p = NN_PARAMS[pair];
    if (p) { dh += p.h; ds += p.s; }
  }

  // 起始项修正 (Terminal Initiation SantaLucia 1998)
  const first = seq[0];
  const last = seq[n - 1];
  if (first === 'g' || first === 'c') { dh += 0.1; ds -= 2.8; }
  else { dh += 2.3; ds += 4.1; }
  if (last === 'g' || last === 'c') { dh += 0.1; ds -= 2.8; }
  else { dh += 2.3; ds += 4.1; }

  const R = 1.987; 
  const T_std = 273.15 + 37; 
  const Ct = settings.oligoConc * 1e-6; 
  const k = Ct / 4; 
  
  const tm1M = ((dh * 1000) / (ds + R * Math.log(k))) - 273.15;
  const invTm1M = 1 / (tm1M + 273.15);

  // 3. 盐浓度校正 (Owczarzy 2008 镁离子/单价离子模型)
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
    const R_val = Math.sqrt(freeMg) / monovalent;
    const lnMg = Math.log(freeMg);
    if (R_val < 0.22) {
      const lnNa = Math.log(monovalent);
      invTmSalt = invTm1M + (4.29 * fGC - 3.95) * 1e-5 * lnNa + 9.4e-6 * Math.pow(lnNa, 2);
    } else {
      const a = 3.92e-5, b = -9.11e-6, c = 6.26e-5, d = 1.42e-5, e = -4.82e-4, f = 5.25e-4, g = 8.31e-5;
      invTmSalt = invTm1M + a + b * lnMg + fGC * (c + d * lnMg) + 
                  (1 / (2 * (n - 1))) * (e + f * lnMg + g * Math.pow(lnMg, 2));
    }
  }

  let tm = (1 / invTmSalt) - 273.15;

  // 4. LNA 碱基及长度依赖性修正
  // LNA 的贡献随着引物长度增加而急剧下降（稀释效应）
  if (lnaPositions.length > 0) {
    // 使用幂律模型拟合 IDT 结果：在 27nt 时，单个 LNA-G 的增量约 1.0°C
    const lnaBaseIncrement = 3.3 * Math.pow(12 / n, 1.5); 
    
    lnaPositions.forEach(pos => {
      const base = seq[pos];
      // C/G LNA 通常比 A/T LNA 提供更多稳定性
      const weight = (base === 'g' || base === 'c') ? 1.12 : 0.88;
      tm += lnaBaseIncrement * weight;
    });
  }

  // 5. MGB 序列相关性模型 (Kutyavin et al. 2000)
  // MGB 对 AT 富集序列的小沟结合更紧密，因此贡献更高
  if (isMGB) {
    // 经验公式：ΔTm_mgb ≈ 19.5 - 0.12 * GC%
    const mgbBoost = 19.5 - (0.12 * (fGC * 100));
    tm += mgbBoost;
  }

  const dg = dh - (T_std * ds / 1000);
  const gc = (gcCount / n) * 100;

  return { tm, dg, gc };
};

export interface StructureAnalysis {
  dg: number;
  alignment: string[];
}

export const findMostStableDimer = (s1: string, s2: string): StructureAnalysis | null => {
  const q1 = s1.toUpperCase();
  const q2 = s2.toUpperCase();
  const q2Rev = q2.split('').reverse().join(''); 
  let bestDG = 0;
  let bestResult: StructureAnalysis | null = null;
  for (let shift = -q2.length + 1; shift < q1.length; shift++) {
    let matches = 0;
    let currentDG = 0;
    const overlapStart = Math.max(0, shift);
    const overlapEnd = Math.min(q1.length, shift + q2.length);
    if (overlapEnd <= overlapStart) continue;
    const matchChars: string[] = [];
    for (let i = overlapStart; i < overlapEnd; i++) {
      const b1 = q1[i];
      const b2 = q2Rev[i - shift];
      if (b1 === getComplement(b2).toUpperCase()) {
        matchChars.push('|');
        matches++;
        currentDG -= 2.0; 
      } else {
        matchChars.push(' ');
        currentDG += 0.4;
      }
    }
    if (matches >= 2 && currentDG < bestDG) {
      bestDG = currentDG;
      const indent1 = shift < 0 ? Math.abs(shift) : 0;
      const indent2 = shift > 0 ? shift : 0;
      const line1 = `5' ${" ".repeat(indent1)}${q1} 3'`;
      const line2 = `   ${" ".repeat(indent1 + (shift > 0 ? shift : 0))}${matchChars.join('')}`;
      const line3 = `3' ${" ".repeat(indent2)}${q2Rev} 5'`;
      bestResult = { dg: bestDG, alignment: [line1, line2, line3] };
    }
  }
  return bestResult;
};

export const findMostStableHairpin = (sequence: string): StructureAnalysis | null => {
  const seq = sequence.toUpperCase();
  const n = seq.length;
  let bestDG = 0;
  let bestResult: StructureAnalysis | null = null;
  for (let endOffset = 0; endOffset <= 2; endOffset++) {
    const stem2End = n - endOffset;
    for (let stemLen = 3; stemLen <= 12; stemLen++) {
      for (let loopLen = 3; loopLen <= 15; loopLen++) {
        const stem2Start = stem2End - stemLen;
        const loopStart = stem2Start - loopLen;
        const stem1Start = loopStart - stemLen;
        if (stem1Start < 0) continue;
        const stem1 = seq.substring(stem1Start, stem1Start + stemLen);
        const stem2 = seq.substring(stem2Start, stem2End);
        const loop = seq.substring(loopStart, loopStart + loopLen);
        if (stem1 === getReverseComplement(stem2).toUpperCase()) {
          const dg = (-2.0 * stemLen) + (0.4 * loopLen);
          if (dg < bestDG) {
            bestDG = dg;
            const prefix = seq.substring(0, stem1Start);
            const suffix = seq.substring(stem2End); 
            const suffixRev = suffix.split('').reverse().join('');
            const stem2Rev = stem2.split('').reverse().join('');
            const maxLeftLen = Math.max(prefix.length, suffixRev.length);
            bestResult = {
              dg,
              alignment: [
                `5'-${" ".repeat(maxLeftLen - prefix.length)}${prefix}${stem1}--\\`,
                `   ${" ".repeat(maxLeftLen)}${"|".repeat(stemLen)}   ${loop}`,
                `3'-${" ".repeat(maxLeftLen - suffixRev.length)}${suffixRev}${stem2Rev}--/`
              ]
            };
          }
        }
      }
    }
  }
  return bestResult;
};

export const searchSequence = (
  strandSeq: string,
  query: string,
  strandType: StrandType,
  maxMismatches: number
): { start: number; end: number; mismatches: number }[] => {
  const results: { start: number; end: number; mismatches: number }[] = [];
  const n = strandSeq.length;
  const m = query.length;
  if (m === 0 || m > n) return [];
  const isReversePhysical = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(strandType);
  const searchSubject = strandSeq.toUpperCase();
  const searchPattern = isReversePhysical ? query.split('').reverse().join('').toUpperCase() : query.toUpperCase();
  for (let i = 0; i <= n - m; i++) {
    let mismatches = 0;
    for (let j = 0; j < m; j++) {
      if (!isBaseCompatible(searchPattern[j], searchSubject[i + j])) mismatches++;
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

export const getStrandSequence = (
  f_seq: string, 
  methylatedF: number[], 
  methylatedR: number[],
  type: StrandType
): string => {
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
