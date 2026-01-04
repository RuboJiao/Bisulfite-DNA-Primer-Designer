
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
 * 计算引物热力学参数。
 * 遵循 SantaLucia (1998) NN 模型与 Owczarzy (2004/2008) 盐校正。
 */
export const calculateThermodynamics = (
  sequence: string, 
  isMGB: boolean = false,
  settings: ThermodynamicSettings = DEFAULT_THERMO_SETTINGS
): ThermodynamicResult => {
  const n = sequence.length;
  if (n < 2) return { tm: 0, dg: 0, gc: 0 };

  const lnaCount = (sequence.match(/[A-Z]/g) || []).length;
  const seq = sequence.toLowerCase().split('').map(b => IUPAC_MAP[b] ? IUPAC_MAP[b][0].toLowerCase() : b).join('');

  // 1. 计算核心 ΔH 和 ΔS
  let dh = 0; 
  let ds = 0; 

  for (let i = 0; i < n - 1; i++) {
    const pair = seq.substring(i, i + 2);
    const p = NN_PARAMS[pair];
    if (p) { dh += p.h; ds += p.s; }
  }

  // 2. 加上 Initiation (SantaLucia 1998)
  // 全局 Initiation: ΔH=0, ΔS=-10.8
  ds -= 10.8;

  // 3. 末端 A-T 惩罚: 每个末端 A-T 增加 ΔH=2.3, ΔS=4.1
  const first = seq[0];
  const last = seq[n - 1];
  if (first === 'a' || first === 't') { dh += 2.3; ds += 4.1; }
  if (last === 'a' || last === 't') { dh += 2.3; ds += 4.1; }

  const R = 1.987;
  const T_std = 273.15 + 37; 
  const k = (settings.oligoConc * 1e-6) / 4; // Ct/4 for non-self-complementary
  
  // 4. 盐校正计算 (Owczarzy 2004 模型)
  // 正确的等效钠离子计算 (Na_eq = [Na+] + 120 * sqrt([Mg++] - [dNTPs]))
  // 注意：公式内部 sqrt 使用的是 mM 单位，最后除以 1000 转回 M
  const na_mM = settings.naConc;
  const mg_mM = settings.mgConc;
  const dntp_mM = settings.dntpConc;
  const freeMg_mM = Math.max(0, mg_mM - dntp_mM);
  
  // 等效钠离子摩尔浓度 (M)
  const naEq = (na_mM + 120 * Math.sqrt(freeMg_mM)) / 1000;
  
  // 计算 1M NaCl 下的 Tm
  const tm1M = ((dh * 1000) / (ds + R * Math.log(k))) - 273.15;
  
  // Owczarzy (2004) 盐校正公式: 1/Tm(Na) = 1/Tm(1M) + (4.29*fGC - 3.95)*1e-5*ln(Na_eq) + 9.4e-6*(ln(Na_eq)^2)
  const gcCount = (seq.match(/[gc]/g) || []).length;
  const fGC = gcCount / n;
  
  const invTm1M = 1 / (tm1M + 273.15);
  const lnNa = Math.log(naEq);
  const invTmSalt = invTm1M + (4.29 * fGC - 3.95) * 1e-5 * lnNa + 9.4e-6 * Math.pow(lnNa, 2);
  
  let tm = (1 / invTmSalt) - 273.15;

  // 5. 计算 ΔG (at 37C)
  let dg = dh - (T_std * ds / 1000);
  
  // 修正 LNA 影响
  if (lnaCount > 0) {
    tm += lnaCount * 5.0;
    dg -= lnaCount * 1.5;
  }

  // 修正 MGB 影响
  if (isMGB) {
    tm += 15.0;
    dg -= 4.0;
  }

  const gc = fGC * 100;

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
