import { TogetherClock } from './together';

describe('TogetherClock', () => {
  it('counts only the time both partners are in the room', () => {
    const c = new TogetherClock();
    expect(c.update('study:s', false, 0)).toBe(0); // host alone
    expect(c.update('study:s', true, 1_000)).toBe(0); // partner arrives
    expect(c.sinceOf('study:s')).toBe(1_000);
    expect(c.update('study:s', true, 5_000)).toBe(0); // still together (a reconnect, an extra tab)
    expect(c.running('study:s', 6_000)).toBe(5_000);
    expect(c.update('study:s', false, 61_000)).toBe(60_000); // partner leaves
    expect(c.sinceOf('study:s')).toBeNull();
    expect(c.update('study:s', false, 70_000)).toBe(0);
  });

  it('adds up several segments and flushes the running one', () => {
    const c = new TogetherClock();
    let total = 0;
    c.update('study:s', true, 0);
    total += c.update('study:s', false, 30_000);
    c.update('study:s', true, 40_000);
    total += c.flush('study:s', 100_000);
    expect(total).toBe(90_000);
    expect(c.flush('study:s', 200_000)).toBe(0);
  });

  it('waits for pending writes of ended segments', async () => {
    const c = new TogetherClock();
    let stored = 0;
    c.track('study:s', new Promise((r) => setTimeout(() => r((stored += 60_000)), 20)));
    await c.settled('study:s');
    expect(stored).toBe(60_000);
    await expect(c.settled('study:none')).resolves.toBeUndefined();
  });

  it('keeps rooms apart', () => {
    const c = new TogetherClock();
    c.update('study:a', true, 0);
    expect(c.update('study:b', false, 10)).toBe(0);
    expect(c.flush('study:a', 500)).toBe(500);
  });
});
