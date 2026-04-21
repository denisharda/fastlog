/**
 * Phase data re-exported from the central theme module.
 * Kept as a thin shim so existing imports (`../constants/phases`) keep working.
 */
import { PHASES, PhaseDef, getCurrentPhase as _getCurrentPhase } from './theme';

export type FastingPhase = PhaseDef & {
  /** Legacy alias for `start`. */
  minHours: number;
  /** Legacy alias for `end`. */
  maxHours: number;
};

function withLegacyBounds(p: PhaseDef, isLast: boolean): FastingPhase {
  return {
    ...p,
    minHours: p.start,
    // The last phase was previously Infinity-bounded; preserve that for legacy callers.
    maxHours: isLast ? Infinity : p.end,
  };
}

export const FASTING_PHASES: FastingPhase[] = PHASES.map((p, i) =>
  withLegacyBounds(p, i === PHASES.length - 1),
);

export function getCurrentPhase(elapsedHours: number): FastingPhase {
  const p = _getCurrentPhase(elapsedHours);
  const idx = PHASES.indexOf(p);
  return withLegacyBounds(p, idx === PHASES.length - 1);
}

export { PhaseDef };
