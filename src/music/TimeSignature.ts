export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export const TIME_SIGNATURES: Record<string, TimeSignature> = {
  '4/4': { numerator: 4, denominator: 4 },
  '3/4': { numerator: 3, denominator: 4 },
  '6/8': { numerator: 6, denominator: 8 },
};

export function getTimeSignatureString(ts: TimeSignature): string {
  return `${ts.numerator}/${ts.denominator}`;
}
