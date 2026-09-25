// Available classes in exact required format
export const VALID_CLASSES = [
  'USR 1', 'USR 2',
  'MUL 1', 'MUL 2',
  'KVS 1', 'KVS 2',
  'AQD 1', 'AQD 2',
  'HLR 1', 'HLR 2',
  'LUG 1', 'LUG 2'
] as const;

export type ValidClass = typeof VALID_CLASSES[number];
