
import { StrandType, SearchResult } from '../types';

export const COMPLEMENTS: Record<string, string> = {
  a: 't', t: 'a', c: 'g', g: 'c',
  A: 'T', T: 'A', C: 'G', G: 'C'
};

export const IUPAC_MAP: Record<string, string[]> = {
  'A': ['A'],
  'T': ['T'],
  'C': ['C'],
  'G': ['G'],
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

/**
 * Checks if a primer base (potentially degenerate) is compatible with a template base.
 * Since the viewer displays the strand sequence and the primer sequence is designed to 
 * MATCH that strand (for visualization purposes), compatibility means the template base
 * is one of the possibilities represented by the primer base.
 */
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

export const calculateThermodynamics = (sequence: string): ThermodynamicResult => {
  // For thermodynamics, we treat degenerate bases as their first standard base for a rough estimation
  // In a real scenario, one might average the possible sequences, but first base is a common heuristic for display.
  const seq = sequence.toUpperCase().split('').map(b => IUPAC_MAP[b] ? IUPAC_MAP[b][0] : b).join('').toLowerCase();
  const n = seq.length;
  if (n === 0) return { tm: 0, dg: 0, gc: 0 };

  let dh = 0.2; 
  let ds = -5.7; 

  for (let i = 0; i < n - 1; i++) {
    const pair = seq.substring(i, i + 2);
    const p = NN_PARAMS[pair];
    if (p) { dh += p.h; ds += p.s; }
  }

  const R = 1.987;
  const T = 273.15 + 37; 
  const k = 50e-9;
  const Na = 0.05;

  const dg = dh - (T * ds / 1000);
  const tm = ((dh * 1000) / (ds + R * Math.log(k / 4)) - 273.15) + (16.6 * Math.log10(Na));
  const gcCount = (seq.match(/[gc]/g) || []).length;
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
      // Note: simplistic match check for dimer analysis (ignoring complex degenerate pairings for now)
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

      bestResult = {
        dg: bestDG,
        alignment: [line1, line2, line3]
      };
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
            const pLeft1 = " ".repeat(maxLeftLen - prefix.length);
            const pLeft2 = " ".repeat(maxLeftLen - suffixRev.length);

            bestResult = {
              dg,
              alignment: [
                `5'-${pLeft1}${prefix}${stem1}--\\`,
                `   ${" ".repeat(maxLeftLen)}${"|".repeat(stemLen)}   ${loop}`,
                `3'-${pLeft2}${suffixRev}${stem2Rev}--/`
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
  const searchPattern = isReversePhysical 
    ? query.split('').reverse().join('').toUpperCase() 
    : query.toUpperCase();

  for (let i = 0; i <= n - m; i++) {
    let mismatches = 0;
    for (let j = 0; j < m; j++) {
      if (!isBaseCompatible(searchPattern[j], searchSubject[i + j])) {
        mismatches++;
      }
      if (mismatches > maxMismatches) break;
    }
    if (mismatches <= maxMismatches) {
      results.push({ start: i, end: i + m - 1, mismatches });
    }
  }
  return results;
};

export const bisulfiteConvert = (seq: string, methylatedIndices: number[]): string => {
  return seq.split('').map((base, idx) => {
    if (base.toLowerCase() === 'c' && !methylatedIndices.includes(idx)) {
      return 't';
    }
    return base;
  }).join('');
};

export const calculateTm = (sequence: string): number => calculateThermodynamics(sequence).tm;

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
