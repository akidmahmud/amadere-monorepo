import { sanitizeFilename } from './media.service';

describe('sanitizeFilename', () => {
  // The bug this exists to prevent: a raw space in the storage key becomes a
  // raw space in the public URL, which no browser can fetch — so the upload
  // "succeeds" and the image is permanently blank.
  it('replaces spaces, which broke 14 production images', () => {
    expect(sanitizeFilename('Sorishar tel Banner with1600x 500 hight.webp')).toBe(
      'Sorishar-tel-Banner-with1600x-500-hight.webp',
    );
  });

  it('handles commas and repeated separators', () => {
    expect(sanitizeFilename('ChatGPT Image Jul 16, 2026, 10_43_41 AM.png')).toBe(
      'ChatGPT-Image-Jul-16-2026-10_43_41-AM.png',
    );
  });

  it('leaves an already-safe name untouched', () => {
    expect(sanitizeFilename('black-seed_01.png')).toBe('black-seed_01.png');
  });

  it('lowercases the extension but preserves stem casing', () => {
    expect(sanitizeFilename('Banner.PNG')).toBe('Banner.png');
  });

  it('falls back rather than emitting a bare dash for an all-non-ASCII name', () => {
    expect(sanitizeFilename('সরিষার তেল.png')).toBe('file.png');
  });

  it('strips characters that carry URL meaning', () => {
    expect(sanitizeFilename('a?b&c#d+e%f.png')).toBe('a-b-c-d-e-f.png');
  });

  it('does not leave a leading or trailing separator', () => {
    expect(sanitizeFilename('  spaced out  .png')).toBe('spaced-out.png');
  });

  it('caps a very long stem so the key stays a sane length', () => {
    expect(sanitizeFilename('x'.repeat(200) + '.png')).toBe('x'.repeat(80) + '.png');
  });
});
