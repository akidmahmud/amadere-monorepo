import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateFooterDto } from './update-footer.dto';
import { FOOTER_DEFAULTS } from '../footer.defaults';

// Matches apps/backend/src/main.ts's global pipe: `whitelist: true` without
// `forbidNonWhitelisted`. Production strips unknown keys rather than
// rejecting the request, so the test harness must not assert rejection —
// see FIX 5 in the final review: this file used to pass
// forbidNonWhitelisted here, asserting a behaviour production doesn't have.
function validate(payload: unknown) {
  return validateSync(plainToInstance(UpdateFooterDto, payload), {
    whitelist: true,
  });
}

describe('UpdateFooterDto', () => {
  it('accepts the defaults document', () => {
    expect(validate(FOOTER_DEFAULTS)).toHaveLength(0);
  });

  it('rejects a fifth column', () => {
    const payload = {
      ...FOOTER_DEFAULTS,
      columns: [...FOOTER_DEFAULTS.columns, ...FOOTER_DEFAULTS.columns].slice(0, 5),
    };
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a link href that is neither relative nor http(s)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.columns[0].links[0].href = 'javascript:alert(1)';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a protocol-relative href (browsers resolve // as offsite)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.columns[0].links[0].href = '//evil.example/path';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a backslash-bypass href (browsers normalise \\ to / after the origin)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    // '\\' in a JS string literal is one backslash character, so this is the
    // 14-character string: / \ e v i l . e x a m p l e — not a doubled
    // escape. Assert on the actual bytes rather than trusting the literal.
    const href = '/\\evil.example';
    expect(href).toHaveLength(14);
    expect(href.charCodeAt(1)).toBe(92); // backslash
    payload.columns[0].links[0].href = href;
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a custom icon with no mediaId', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social = [
      { icon: 'custom', mediaId: null, url: 'https://x.test', label: { en: 'X', bn: 'X' } },
    ];
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a mediaId on a built-in icon', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social = [
      { icon: 'facebook', mediaId: 4, url: 'https://x.test', label: { en: 'F', bn: 'F' } },
    ];
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a translated field missing its bn key', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.brandMark = { en: 'Amader' };
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('accepts an app button with an empty url', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.apps.buttons[0].url = '';
    expect(validate(payload)).toHaveLength(0);
  });

  it('rejects an eleventh social entry', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social = Array.from({ length: 11 }, () => ({ ...payload.social[0] }));
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a fifth app button', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.apps.buttons = Array.from({ length: 5 }, () => ({ ...payload.apps.buttons[0] }));
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects an unknown social icon', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.social[0].icon = 'myspace';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects an unknown app button style', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.apps.buttons[0].style = 'myspace';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('accepts a translated field whose values are empty strings (only a missing key is invalid)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.brandMark = { en: '', bn: '' };
    expect(validate(payload)).toHaveLength(0);
  });

  it('rejects phone.value given as a translated object instead of a plain string', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.contact.phone.value = { en: '+8801615980394', bn: '+8801615980394' };
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('rejects a phone value that is not dialable', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.contact.phone.value = 'call me maybe';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('accepts an empty phone value', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.contact.phone.value = '';
    expect(validate(payload)).toHaveLength(0);
  });

  it('rejects a malformed email value', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.contact.email.value = 'not-an-email';
    expect(validate(payload).length).toBeGreaterThan(0);
  });

  it('accepts an empty email value (the defaults ship with one)', () => {
    const payload = JSON.parse(JSON.stringify(FOOTER_DEFAULTS));
    payload.contact.email.value = '';
    expect(validate(payload)).toHaveLength(0);
  });
});
