
export enum StrandType {
  F = 'F',
  R = 'R',
  OT = 'OT',
  CTOT = 'CTOT',
  OB = 'OB',
  CTOB = 'CTOB'
}

export interface ThermodynamicSettings {
  oligoConc: number; // µM
  naConc: number;    // mM
  mgConc: number;    // mM
  dntpConc: number;  // mM
}

export interface Primer {
  id: string;
  name: string;
  sequence: string; // 存储时保留大小写，小写代表 LNA
  strand: StrandType;
  start: number; // Index in the 1-to-1 alignment (0-based)
  length: number;
  isMGB?: boolean; // 新增：是否具有 MGB 修饰
}

export interface SelectionState {
  strand: StrandType;
  start: number;
  end: number;
}

export interface SearchResult {
  strand: StrandType;
  start: number;
  end: number;
  mismatches: number;
}

export interface ProjectData {
  sequence: string;
  methylatedF: number[]; 
  methylatedR: number[]; 
  primers: Primer[];
  methylationIndices?: number[];
}
