import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  const isOwn = (ip: string) => ip === '200.141.0.91';

  it('uses the named visitor when the request came from this server', () => {
    expect(resolveClientIp('200.141.0.91', '103.1.2.3', isOwn)).toBe('103.1.2.3');
  });

  it('ignores the header from anyone else, so it cannot be forged', () => {
    expect(resolveClientIp('8.8.8.8', '103.1.2.3', isOwn)).toBe('8.8.8.8');
  });

  it('ignores junk and a missing header', () => {
    expect(resolveClientIp('200.141.0.91', 'not-an-ip', isOwn)).toBe('200.141.0.91');
    expect(resolveClientIp('200.141.0.91', undefined, isOwn)).toBe('200.141.0.91');
  });
});
