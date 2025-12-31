
import { StrandType } from '../types';

export const COMPLEMENTS: Record<string, string> = {
  a: 't', t: 'a', c: 'g', g: 'c',
  A: 'T', T: 'A', C: 'G', G: 'C'
};

export const getComplement = (seq: string): string => {
  return seq.split('').map(b => COMPLEMENTS[b] || b).join('');
};

export const getReverseComplement = (seq: string): string => {
  return getComplement(seq).split('').reverse().join('');
};

export const bisulfiteConvert = (seq: string, methylatedIndices: number[]): string => {
  return seq.split('').map((base, idx) => {
    if (base.toLowerCase() === 'c' && !methylatedIndices.includes(idx)) {
      return 't';
    }
    return base;
  }).join('');
};

/**
 * Nearest-Neighbor Tm calculation (Santalucia 1998 parameters)
 * ΔH: kcal/mol, ΔS: cal/(mol·K)
 */
const NN_PARAMS: Record<string, { h: number; s: number }> = {
  'aa': { h: -7.9, s: -22.2 }, 'tt': { h: -7.9, s: -22.2 },
  'at': { h: -7.2, s: -20.4 },
  'ta': { h: -7.2, s: -21.3 },
  'ca': { h: -8.5, s: -22.7 }, 'tg': { h: -8.5, s: -22.7 },
  'gt': { h: -8.4, s: -22.4 }, 'ac': { h: -8.4, s: -22.4 },
  'ct': { h: -7.8, s: -21.0 }, 'ag': { h: -7.8, s: -21.0 },
  'ga': { h: -8.2, s: -22.2 }, 'tc': { h: -8.2, s: -22.2 },
  'cg': { h: -10.6, s: -27.2 },
  'gc': { h: -9.8, s: -24.4 },
  'gg': { h: -8.0, s: -19.9 }, 'cc': { h: -8.0, s: -19.9 },
};

const INIT_H = 0.2;
const INIT_S = -5.7;

export const calculateTm = (sequence: string): number => {
  const seq = sequence.toLowerCase();
  const n = seq.length;
  if (n === 0) return 0;
  if (n < 4) return (seq.match(/[at]/g)?.length || 0) * 2 + (seq.match(/[gc]/g)?.length || 0) * 4;

  let deltaH = 0;
  let deltaS = 0;

  for (let i = 0; i < n - 1; i++) {
    const pair = seq.substring(i, i + 2);
    const params = NN_PARAMS[pair];
    if (params) {
      deltaH += params.h;
      deltaS += params.s;
    }
  }

  deltaH += INIT_H;
  deltaS += INIT_S;

  const R = 1.987; // Gas constant
  const k = 50e-9; // Primer concentration (50nM)
  const Na = 0.05; // Salt concentration (50mM)

  // Tm = ΔH / (ΔS + R * ln(C/4)) - 273.15 + salt_correction
  // Simplified Salt Correction (Santalucia 1998)
  const tm = (deltaH * 1000) / (deltaS + R * Math.log(k / 4)) - 273.15;
  const saltCorr = 16.6 * Math.log10(Na);
  
  return tm + saltCorr;
};

export const getStrandSequence = (
  f_seq: string, 
  methylatedIndices: number[], 
  type: StrandType
): string => {
  const f = f_seq.toLowerCase();
  const r = getComplement(f);

  switch (type) {
    case StrandType.F: return f;
    case StrandType.R: return r;
    case StrandType.OT: return bisulfiteConvert(f, methylatedIndices);
    case StrandType.CTOT: return getComplement(bisulfiteConvert(f, methylatedIndices));
    case StrandType.OB: return bisulfiteConvert(r, methylatedIndices);
    case StrandType.CTOB: return getComplement(bisulfiteConvert(r, methylatedIndices));
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
