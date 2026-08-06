import { buildNwcSubmissionWorkbook } from './nwc-submission-export';

function storedZipEntries(buffer: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString();
    expect(compression).toBe(0);
    entries.set(name, buffer.subarray(dataStart, dataStart + size).toString());
    offset = dataStart + size;
  }
  return entries;
}

describe('buildNwcSubmissionWorkbook', () => {
  it('creates a minimised Open XML workbook without internal identifiers', async () => {
    const buffer = await buildNwcSubmissionWorkbook({
      tournament: {
        name: 'Americas Qualifier 2026',
        shortName: 'AQ26',
        timezone: 'America/Barbados',
        startsOn: '2026-10-01',
        endsOn: '2026-10-10',
      },
      generatedAt: new Date('2026-08-06T12:00:00.000Z'),
      delegations: [
        {
          id: 'internal-delegation-id',
          countryCode: 'BRB',
          name: 'Barbados',
          associationName: 'Barbados Netball Association',
          headOfDelegation: 'Jordan Example',
          headCoach: 'Alex Example',
          contactName: 'Taylor Example',
          contactEmail: 'team@example.com',
          contactPhone: '+1 246 555 0100',
          contactRoleTitle: 'Team Manager',
          expectedSquadSize: 15,
          travellingParty: 22,
          arrivalDate: '2026-09-29',
          departureDate: '2026-10-11',
          dpaConsent: true,
          registrationStatus: 'approved',
          registrationSubmittedAt: new Date('2026-07-01T12:00:00Z'),
          rosterStatus: 'submitted',
          rosterSubmittedAt: new Date('2026-08-01T12:00:00Z'),
          accreditedAt: null,
        },
      ],
      people: [
        {
          delegationId: 'internal-delegation-id',
          firstName: 'Casey & Co',
          middleNames: null,
          lastName: 'Example',
          nationality: 'BRB',
          category: 'player',
          rosterType: 'active',
          officialRole: null,
          otherOfficialTitle: null,
          role: 'GS',
          jerseyNumber: 7,
          isCaptain: true,
          dateOfBirth: '2001-02-03',
          isHeadOfDelegation: false,
          benchEligible: true,
          nationalityMatchesTeam: true,
          eligibilityConfirmed: true,
          eligibilityReference: null,
          biography: 'Player biography',
          consentStatus: 'player',
          identityStatus: 'verified',
          locReviewStatus: 'verified',
          credentialStatus: 'not issued',
        },
      ],
    });

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const entries = storedZipEntries(buffer);
    expect([...entries.keys()]).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
        'xl/worksheets/sheet3.xml',
      ]),
    );
    expect(entries.get('xl/workbook.xml')).toContain('name="Delegations"');
    expect(entries.get('xl/worksheets/sheet3.xml')).toContain('Casey &amp; Co');
    expect(entries.get('xl/worksheets/sheet3.xml')).not.toContain(
      'internal-delegation-id',
    );
    expect(buffer.readUInt32LE(buffer.length - 22)).toBe(0x06054b50);
  });
});
