import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_BACKGROUND_COLOR, resolveBackgroundColor } from '@/lib/config';

describe('resolveBackgroundColor', () => {
  it('accepts hex colours, names and rgb() or hsl() values', () => {
    for (const color of ['#abc', '#abcd', '#304D30', '#aabbccdd', 'tomato', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'hsl(120 50% 50% / 0.5)']) {
      expect(resolveBackgroundColor(color)).toBe(color);
    }
  });

  it('trims surrounding whitespace', () => {
    expect(resolveBackgroundColor('  tomato  ')).toBe('tomato');
  });

  it('falls back to the default for missing or invalid values', () => {
    for (const color of [undefined, '', '#abcde', 'not a colour', 'url(x)', 'red; background:url(x)', 'rgb(1,2,3)); color: red', 'expression(alert(1))']) {
      expect(resolveBackgroundColor(color)).toBe(DEFAULT_CARD_BACKGROUND_COLOR);
    }
  });
});
