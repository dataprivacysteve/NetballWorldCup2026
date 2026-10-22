import { Pool } from 'pg';
import { PublicService } from './public.service';

describe('standings points for recorded results', () => {
  it('awards three points per existing win without writing or changing match data', async () => {
    const matches = [
      { teamACode: 'BRB', teamBCode: 'CAN', teamAScore: 50, teamBScore: 40 },
      { teamACode: 'USA', teamBCode: 'BRB', teamAScore: 30, teamBScore: 45 },
      { teamACode: 'CAN', teamBCode: 'USA', teamAScore: 42, teamBScore: 35 },
    ];
    const recorded = JSON.stringify(matches);
    const query = jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, name FROM stage')) {
        return { rows: [{ id: 'group', name: 'Qualifier' }] };
      }
      if (sql.includes('FROM group_entry')) {
        return { rows: [
          { countryCode: 'BRB', name: 'Barbados' },
          { countryCode: 'CAN', name: 'Canada' },
          { countryCode: 'USA', name: 'USA' },
          { countryCode: 'LCA', name: 'Saint Lucia' },
        ] };
      }
      if (sql.includes('FROM match m')) {
        expect(sql).toContain("m.status = 'final'");
        return { rows: matches };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    // Exercise the public read path without constructing unrelated S3 clients.
    const service = Object.assign(Object.create(PublicService.prototype), {
      pool: { query } as unknown as Pool,
    }) as PublicService;

    for (let read = 0; read < 2; read++) {
      const [group] = await service.standings();
      expect(group.rows).toEqual([
        expect.objectContaining({ countryCode: 'BRB', played: 2, won: 2, lost: 0, points: 6, goalsFor: 95, goalsAgainst: 70, goalDiff: 25, rank: 1 }),
        expect.objectContaining({ countryCode: 'CAN', played: 2, won: 1, lost: 1, points: 3, goalsFor: 82, goalsAgainst: 85, goalDiff: -3, rank: 2 }),
        expect.objectContaining({ countryCode: 'LCA', played: 0, won: 0, lost: 0, points: 0, rank: 3 }),
        expect.objectContaining({ countryCode: 'USA', played: 2, won: 0, lost: 2, points: 0, goalsFor: 65, goalsAgainst: 87, goalDiff: -22, rank: 4 }),
      ]);
    }
    expect(JSON.stringify(matches)).toBe(recorded);
    expect(query).toHaveBeenCalledTimes(6);
    for (const [sql] of query.mock.calls) {
      expect(sql.trimStart()).toMatch(/^SELECT\b/);
    }
  });
});
