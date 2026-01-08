
import { StrandType, SearchResult, ThermodynamicSettings } from '../types';

export const COMPLEMENTS: Record<string, string> = {
  a: 't', t: 'a', c: 'g', g: 'c',
  A: 'T', T: 'A', C: 'G', G: 'C'
};

export const IUPAC_MAP: Record<string, string[]> = {
  'A': ['A'], 'a': ['A'], 'T': ['T'], 't': ['T'], 'C': ['C'], 'c': ['C'], 'G': ['G'], 'g': ['G'],
  'R': ['A', 'G'], 'Y': ['C', 'T'], 'S': ['G', 'C'], 'W': ['A', 'T'], 'K': ['G', 'T'], 'M': ['A', 'C'],
  'B': ['C', 'G', 'T'], 'D': ['A', 'G', 'T'], 'H': ['A', 'C', 'T'], 'V': ['A', 'C', 'G'], 'N': ['A', 'T', 'C', 'G'],
};

export const DEFAULT_THERMO_SETTINGS: ThermodynamicSettings = {
  oligoConc: 0.25, // 0.25 µM
  naConc: 50,     // 50 mM
  mgConc: 3,      // 3 mM
  dntpConc: 0.8   // 0.8 mM
};

// SantaLucia 1998 NN Parameters (dH: kcal/mol, dS: cal/K·mol)
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

export const calculateThermodynamics = (
  rawSequence: string, 
  templateSequence: string = "", 
  isMGB: boolean = false,
  settings: ThermodynamicSettings = DEFAULT_THERMO_SETTINGS
): any => {
  // 1. 严格提取结合区序列（剔除 [tail]）
  const bindingSequence = rawSequence.replace(/\[[^\]]*\]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const n = bindingSequence.length;
  if (n < 2) return { tm: 0, dg: 0, gc: 0 };

  const tSeq = templateSequence.replace(/[^a-zA-Z]/g, '').toLowerCase();
  
  let dh = 0; 
  let ds = 0; 
  let mismatchCount = 0;

  // 2. NN Summation & Mismatch Check
  for (let i = 0; i < n - 1; i++) {
    const pair = bindingSequence[i] + bindingSequence[i+1];
    const p = NN_PARAMS[pair];
    if (p) { 
      dh += p.h; 
      ds += p.s; 
    }
    
    // 简单的错配惩罚：如果提供了模板且不兼容
    if (tSeq && tSeq[i] && !isBaseCompatible(bindingSequence[i], tSeq[i])) {
      mismatchCount++;
    }
  }
  if (tSeq && tSeq[n-1] && !isBaseCompatible(bindingSequence[n-1], tSeq[n-1])) {
    mismatchCount++;
  }

  // 3. Initiation Energy (SantaLucia 1998)
  dh += 0.2; 
  ds += -5.7;

  // 4. Terminal AT Penalty
  if (bindingSequence[0] === 'a' || bindingSequence[0] === 't') { dh += 2.2; ds += 6.9; }
  if (bindingSequence[n-1] === 'a' || bindingSequence[n-1] === 't') { dh += 2.2; ds += 6.9; }

  const R = 1.9872; 
  const k = (Math.max(settings.oligoConc, 1e-9) * 1e-6) / 4;

  // 1M Na+ 状态下的基础 Tm (Kelvin)
  const tm1MK = (dh * 1000) / (ds + R * Math.log(k));

  // 5. Salt Correction (Owczarzy 2004 / 2008)
  const Na = (settings.naConc || 0) * 1e-3;
  const Mg = (settings.mgConc || 0) * 1e-3;
  const dNTP = (settings.dntpConc || 0) * 1e-3;
  
  // Calculate Free Mg
  const Mg_free = Math.max(0, Mg - dNTP);
  
  // Monovalent ion concentration (IDT treats NaConc as Total Monovalent)
  const Mon = Na;
  
  // Ratio R = sqrt(Mg_free) / Mon
  const R_ratio = Math.sqrt(Mg_free) / (Mon === 0 ? 1e-9 : Mon);

  const gcCount = (bindingSequence.match(/[gc]/g) || []).length;
  const fGC = gcCount / n;
  
  let tmK = tm1MK;

  if (Mon === 0 && Mg_free === 0) {
     tmK = 0; // 如果无盐环境，Tm 设为绝对零度 (0K)
  } else if (Mon > 0 && (Mg_free === 0 || R_ratio < 0.22)) {
     const lnNa = Math.log(Mon);
     const corr = (4.29 * fGC - 3.95) * 1e-5 * lnNa + 9.40 * 1e-6 * lnNa * lnNa;
     tmK = 1 / (1/tm1MK + corr);
  } else {
     const lnMg = Math.log(Math.max(Mg_free, 1e-9));
     const a = 3.92e-5;
     const b = -9.11e-6;
     const c = 6.26e-5;
     const d = 1.42e-5;
     const e = -4.82e-4;
     const f = 5.25e-4;
     const g = 8.31e-5;

     const term1 = a + b * lnMg;
     const term2 = fGC * (c + d * lnMg);
     const term3 = (1 / (2 * (n - 1))) * (e + f * lnMg + g * lnMg * lnMg);
     const corr = term1 + term2 + term3;
     
     tmK = 1 / (1/tm1MK + corr);
  }

  let tm = tmK - 273.15;

  // 6. 修饰与错配调整 (仅在 Tm > 绝对零度时应用)
  if (tmK > 0) {
    // LNA 增益 (大写字母)
    const lnaCount = rawSequence.replace(/\[[^\]]*\]/g, '').split('').filter(c => /[A-Z]/.test(c)).length;
    tm += lnaCount * 4.0; 

    // MGB 增益
    if (isMGB) {
      tm += (18.0 - (0.1 * (fGC * 100))); 
    }

    if (mismatchCount > 0) {
      const mismatchPercent = (mismatchCount / n) * 100;
      tm -= mismatchPercent * 1.2;
    }
  }

  return { 
    tm: tm, 
    dg: dh - (310.15 * ds / 1000), 
    gc: fGC * 100 
  };
};

export const isBaseCompatible = (p: string, t: string) => {
  const pU = p.toUpperCase(), tU = t.toUpperCase();
  return IUPAC_MAP[pU]?.includes(tU) || pU === tU;
};

export const getComplement = (seq: string) => seq.split('').map(b => COMPLEMENTS[b] || b).join('');

export const getStrandSequence = (f: string, mF: number[], mR: number[], type: StrandType) => {
  const fs = f.toLowerCase();
  const rs = getComplement(fs);
  const bisConvert = (s: string, indices: number[]) => s.split('').map((b, i) => (b === 'c' && !indices.includes(i)) ? 't' : b).join('');
  
  switch (type) {
    case StrandType.F: return fs;
    case StrandType.R: return rs;
    case StrandType.OT: return bisConvert(fs, mF);
    case StrandType.CTOT: return getComplement(bisConvert(fs, mF));
    case StrandType.OB: return bisConvert(rs, mR);
    case StrandType.CTOB: return getComplement(bisConvert(rs, mR));
    default: return fs;
  }
};

export const searchSequence = (strandSeq: string, query: string, strandType: StrandType, maxMismatches: number) => {
  const results = [];
  const cleanQuery = query.replace(/[\[\]]/g, '');
  const n = strandSeq.length, m = cleanQuery.length;
  if (m === 0 || m > n) return [];
  const isRev = [StrandType.R, StrandType.CTOT, StrandType.OB].includes(strandType);
  const pattern = isRev ? cleanQuery.split('').reverse().join('').toUpperCase() : cleanQuery.toUpperCase();
  for (let i = 0; i <= n - m; i++) {
    let mis = 0;
    for (let j = 0; j < m; j++) { if (!isBaseCompatible(pattern[j], strandSeq[i + j])) mis++; if (mis > maxMismatches) break; }
    if (mis <= maxMismatches) results.push({ start: i, end: i + m - 1, mismatches: mis });
  }
  return results;
};

export const findMostStableDimer = (s1: string, s2: string) => {
  const q1 = s1.replace(/[\[\]]/g, '').toUpperCase(), q2 = s2.replace(/[\[\]]/g, '').toUpperCase();
  const q2Rev = q2.split('').reverse().join(''); 
  let best = null;
  for (let shift = -q2.length + 1; shift < q1.length; shift++) {
    let matches = 0, dg = 0;
    const oS = Math.max(0, shift), oE = Math.min(q1.length, shift + q2.length);
    const mC = [];
    for (let i = oS; i < oE; i++) {
      if (q1[i] === getComplement(q2Rev[i - shift]).toUpperCase()) { mC.push('|'); matches++; dg -= 1.8; }
      else { mC.push(' '); dg += 0.3; }
    }
    if (matches >= 2 && dg < (best?.dg || 0)) {
      const i1 = shift < 0 ? Math.abs(shift) : 0, i2 = shift > 0 ? shift : 0;
      best = { dg, alignment: [`5' ${" ".repeat(i1)}${q1} 3'`, `   ${" ".repeat(i1 + (shift > 0 ? (shift - i1) : 0))}${mC.join('')}`, `3' ${" ".repeat(i2)}${q2Rev} 5'`]};
    }
  }
  return best;
};

export const findMostStableHairpin = (sequence: string) => {
  const seq = sequence.replace(/[\[\]]/g, '').toUpperCase();
  const n = seq.length;
  let best = null;

  // 针对 3' 端发卡结构进行深度搜索
  // sL: 茎长度 (Stem Length), lL: 环长度 (Loop Length)
  // 遍历所有可能的茎长 (min 3) 和环长 (min 3)
  // 强制 s2E (茎2结束位置) 为序列末端 n，即检测 3' 端是否参与互补
  
  for (let sL = 3; sL < n / 2; sL++) {
    for (let lL = 3; lL <= n - 2 * sL; lL++) {
      const s2E = n;
      const s2S = n - sL;
      const s1E = s2S - lL;
      const s1S = s1E - sL; // s1S 是第一个茎的起始位置

      if (s1S < 0) continue;

      const st1 = seq.substring(s1S, s1S + sL);
      const st2 = seq.substring(s2S, s2E); // 3' 端序列

      // 检查互补性：st1 vs st2的反向互补
      // 这里的 st2 是 3' 端序列，物理上是 5'->3'。发卡形成时，它是反向配对。
      // st1 5'->3' 应与 st2 3'->5' 互补。
      // 所以我们比较 st1 与 st2 的反向互补序列。
      const st2RevComp = st2.split('').reverse().map(b => COMPLEMENTS[b] || 'N').join('');

      if (st1 === st2RevComp) {
        // 计算 ΔG (粗略估算)
        // 茎部：GC对 -3.0，AT对 -2.0
        let stemDg = 0;
        for (const char of st1) {
          stemDg += (char === 'G' || char === 'C') ? -3.0 : -2.0;
        }
        
        // 环部惩罚：起步 +4.5，每增加 1nt +0.1 (简化模型)
        const loopDg = 4.5 + (lL * 0.1); 
        
        const dg = stemDg + loopDg;

        // 如果更稳定（能量更低），则更新
        if (!best || dg < best.dg) {
           const prefix = seq.substring(0, s1S);
           const loop = seq.substring(s1E, s2S);
           const st2Rev = st2.split('').reverse().join('');
           
           // 构建可视化对齐字符串
           // 策略：Loop 显示在右侧中间行，通过 --\ 和 --/ 连接
           
           // Top:   5'-[Prefix][Stem1]--\
           // Mid:             |||       [Loop]
           // Bot:   3'-[Prefix][Stem2Rev]--/
           
           // 注意：Bottom 行只有 3'-[Spaces][Stem2Rev]--/ 
           // Spaces 必须与 Prefix 长度一致，以保证 Stem2Rev 对齐 Stem1
           
           const indentStr = "5'-"; 
           const indentLen = indentStr.length;
           const prefixSpace = " ".repeat(prefix.length);
           const indentSpace = " ".repeat(indentLen);
           
           const line1 = `${indentStr}${prefix}${st1}--\\`;
           // 中间行：缩进 + Prefix占位 + 竖线 + 间隔 + Loop
           const line2 = `${indentSpace}${prefixSpace}${"|".repeat(sL)}   ${loop}`;
           // 底部行：3'- + Prefix占位 + Stem2Rev (显示方向为 3'->5' 视觉上从左到右) + 连接符
           const line3 = `3'-${prefixSpace}${st2Rev}--/`;
           
           best = { 
             dg, 
             alignment: [line1, line2, line3] 
           };
        }
      }
    }
  }
  return best;
};

export const parseGenBank = (t: string) => {
  const m = t.match(/ORIGIN\s+([\s\S]+)\/\//);
  const s = m ? m[1].replace(/[0-9\s]/g, '') : t.split('\n').filter(l => !l.startsWith('>')).join('').replace(/[^atcgATCG]/g, '');
  return s.toLowerCase();
};
