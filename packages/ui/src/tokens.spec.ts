import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fontFamilies, palette } from './index';

const here = dirname(fileURLToPath(import.meta.url));

describe('design tokens', () => {
  it('keeps every palette and font value in the stylesheet exactly once', () => {
    const css = readFileSync(resolve(here, 'tokens.css'), 'utf8');

    for (const value of Object.values(palette)) {
      const occurrences = css.split(value).length - 1;
      expect(occurrences).toBe(1);
    }

    expect(css).toContain(fontFamilies.sans);
    expect(css).toContain(fontFamilies.display);
    expect(css).toContain('--ravion-color-accent');
  });
});
