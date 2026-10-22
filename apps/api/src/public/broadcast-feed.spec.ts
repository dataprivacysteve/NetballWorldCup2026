import { liveBroadcastFilter, shapeBroadcastFeed } from './public.service';

describe('broadcast feed', () => {
  it('uses neutral Team A and Team B fields and a server-derived clock', () => {
    const now = new Date('2026-08-01T12:00:10Z');
    const row: Parameters<typeof shapeBroadcastFeed>[0] = {
      id: 'cb1ae091-7238-4c80-9ad0-a457f30ad122',
      scheduledAt: new Date('2026-08-01T12:00:00Z'),
      venue: 'G. Sobers Gymnasium',
      court: 'Centre Court',
      roundLabel: 'UAT Full Match Rehearsal',
      status: 'live',
      teamAScore: 12,
      teamBScore: 9,
      currentPeriod: 2,
      periodDurationSeconds: 900,
      clockRemainingSeconds: 600,
      clockRunning: true,
      clockStartedAt: new Date('2026-08-01T12:00:00Z'),
      stageName: 'Group A',
      teamACode: 'BRB',
      teamAName: 'Barbados',
      teamBCode: 'JAM',
      teamBName: 'Jamaica',
      broadcastProvider: 'GameDay',
      watchUrl: null,
      embedUrl: null,
      replayUrl: null,
      broadcastStatus: 'live',
      broadcastFeatured: true,
    };
    const feed = shapeBroadcastFeed(row, now, 'https://example.test');
    expect(feed).toMatchObject({
      Status: 'LIVE',
      Quarter: 'Q2',
      Clock: '09:50',
      IntervalClock: null,
      ClockRunning: true,
      TeamAAbbr: 'BAR',
      TeamAScore: 12,
      TeamBAbbr: 'JAM',
      TeamBScore: 9,
      Provisional: true,
    });
    expect(feed.TeamAFlag).toBe('https://example.test/flags/brb.svg');
    for (const [input, display, flag] of [
      ['BRB', 'BAR', 'brb'],
      ['BAR', 'BAR', 'brb'],
      ['TTO', 'TRI', 'tto'],
      ['TRI', 'TRI', 'tto'],
      ['GRD', 'GRN', 'grd'],
      ['VGB', 'BVI', 'vgb'],
      ['VCT', 'SVG', 'svg'],
      ['SVG', 'SVG', 'svg'],
      ['CAN', 'CAN', 'can'],
      ['USA', 'USA', 'usa'],
      ['LCA', 'LCA', 'lca'],
    ]) {
      const mapped = shapeBroadcastFeed(
        { ...row, teamACode: input, teamBCode: input },
        now,
        'https://example.test/',
      );
      expect(mapped).toMatchObject({
        TeamAAbbr: display,
        TeamBAbbr: display,
        TeamAFlag: 'https://example.test/flags/' + flag + '.svg',
        TeamBFlag: 'https://example.test/flags/' + flag + '.svg',
        MatchId: row.id,
        TeamAScore: 12,
        TeamBScore: 9,
      });
      expect(row.teamACode).toBe('BRB');
    }
    expect(Object.keys(feed).some((key) => /home|away/i.test(key))).toBe(false);
  });

  it('counts down the agreed interval only after the timekeeper ends the quarter', () => {
    const row: Parameters<typeof shapeBroadcastFeed>[0] = {
      id: 'cb1ae091-7238-4c80-9ad0-a457f30ad122',
      scheduledAt: new Date('2026-08-01T12:00:00Z'),
      venue: 'G. Sobers Gymnasium',
      court: 'Centre Court',
      roundLabel: 'Interval test',
      status: 'live',
      teamAScore: 20,
      teamBScore: 18,
      currentPeriod: 2,
      periodDurationSeconds: 900,
      clockRemainingSeconds: 900,
      clockRunning: true,
      clockStartedAt: new Date('2026-08-01T12:00:00Z'),
      periodEndedAt: new Date('2026-08-01T12:15:00Z'),
      stageName: 'Group A',
      teamACode: 'BRB',
      teamAName: 'Barbados',
      teamBCode: 'JAM',
      teamBName: 'Jamaica',
      broadcastProvider: 'GameDay',
      watchUrl: null,
      embedUrl: null,
      replayUrl: null,
      broadcastStatus: 'live',
      broadcastFeatured: true,
    };
    const feed = shapeBroadcastFeed(row, new Date('2026-08-01T12:15:05Z'));
    expect(feed.Clock).toBe('00:00');
    expect(feed.IntervalClock).toBe('07:55');
    expect(feed.PeriodEnded).toBe(true);
    expect(
      shapeBroadcastFeed(
        { ...row, periodEndedAt: null },
        new Date('2026-08-01T12:16:00Z'),
      ).IntervalClock,
    ).toBeNull();
    expect(
      shapeBroadcastFeed(
        { ...row, clockRunning: false, clockRemainingSeconds: 60 },
        new Date('2026-08-01T12:15:05Z'),
      ).IntervalClock,
    ).toBe('07:55');
    const waiting = shapeBroadcastFeed(
      {
        ...row,
        status: 'scheduled',
        currentPeriod: 0,
        periodEndedAt: null,
        startCountdownEndsAt: new Date('2026-08-01T12:20:00Z'),
      },
      new Date('2026-08-01T12:15:05Z'),
    );
    expect(waiting).toMatchObject({
      Status: 'SCHEDULED',
      Quarter: 'PRE',
      GameStartCountdown: '04:55',
    });
    expect(
      shapeBroadcastFeed(
        {
          ...row,
          status: 'scheduled',
          startCountdownEndsAt: new Date('2026-08-01T12:00:00Z'),
        },
        new Date('2026-08-01T12:15:05Z'),
      ).GameStartCountdown,
    ).toBe('00:00');
    expect(
      shapeBroadcastFeed(
        { ...row, currentPeriod: 1 },
        new Date('2026-08-01T12:15:05Z'),
      ).IntervalClock,
    ).toBe('03:55');
  });

  it('allows the explicitly featured scheduled fixture to drive pre-match outputs', () => {
    expect(liveBroadcastFilter()).toContain(
      "COALESCE(mb.featured, false) = true AND m.status = 'scheduled'",
    );
    expect(liveBroadcastFilter('match-id')).toBe('WHERE m.id = $1');
  });
});
