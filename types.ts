
export enum StrandType {
  F = 'F',
  R = 'R',
  OT = 'OT',
  CTOT = 'CTOT',
  OB = 'OB',
  CTOB = 'CTOB'
}

export interface Primer {
  id: string;
  name: string;
  sequence: string;
  strand: StrandType;
  start: number; // Index in the 1-to-1 alignment (0-based)
  length: number;
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
