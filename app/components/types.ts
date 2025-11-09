export type NodeKind = 'room' | 'hall' | 'stair' | 'lift';
export type Node = {
  id: string;
  floor: number;
  x: number;
  y: number;
  type: NodeKind;
  label?: string;
};
export type Building = {
  floors: number[];
  nodes: Node[];
  edges: [string, string][];
};

export type Step = { seg: number; text: string; };
