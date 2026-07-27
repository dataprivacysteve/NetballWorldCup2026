import { registrationWindowState } from './registration-window';

describe('registration window', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('keeps draft configuration closed', () => {
    expect(registrationWindowState('draft', null, null, now)).toEqual({
      open: false,
      phase: 'configuration',
    });
  });

  it('distinguishes scheduled, open, and closed windows', () => {
    expect(
      registrationWindowState(
        'published',
        new Date('2026-08-02T00:00:00Z'),
        new Date('2026-09-01T00:00:00Z'),
        now,
      ).phase,
    ).toBe('scheduled');
    expect(
      registrationWindowState(
        'published',
        new Date('2026-07-31T00:00:00Z'),
        new Date('2026-09-01T00:00:00Z'),
        now,
      ),
    ).toEqual({ open: true, phase: 'open' });
    expect(
      registrationWindowState(
        'published',
        null,
        new Date('2026-08-01T11:59:59Z'),
        now,
      ).phase,
    ).toBe('closed');
  });

  it('keeps a locked published contract operational', () => {
    expect(registrationWindowState('locked', null, null, now)).toEqual({
      open: true,
      phase: 'open',
    });
  });
});
