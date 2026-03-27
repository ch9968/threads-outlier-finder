/**
 * Simple className utility for conditional classes.
 * Filters out falsy values and joins with space.
 */
export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}
