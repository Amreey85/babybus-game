/** Reward rules, shared by the stage runtime and tests. */

/** 1-3 star rating. Finishing always earns at least one star so every child succeeds. */
export function starRating(collected: number, total: number, rescued: boolean): number {
  if (total <= 0) return rescued ? 3 : 1;
  const f = collected / total;
  let rating = 1;
  if (f >= 0.5 && rescued) rating = 2;
  if (f >= 0.9 && rescued) rating = 3;
  return rating;
}

export const BADGE_KITTEN = 'badge.kitten';
export const MEDAL_STAGE1 = 'medal.stage1';
export const TROPHY_ALL_STARS_STAGE1 = 'trophy.allstars.stage1';
