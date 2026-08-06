export type NwcSubmissionExport = {
  tournament: {
    name: string;
    shortName: string | null;
    timezone: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  generatedAt: Date;
  delegations: Array<{
    id: string;
    countryCode: string;
    name: string;
    associationName: string | null;
    headOfDelegation: string | null;
    headCoach: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactRoleTitle: string | null;
    expectedSquadSize: number | null;
    travellingParty: number | null;
    arrivalDate: string | null;
    departureDate: string | null;
    dpaConsent: boolean;
    registrationStatus: string;
    registrationSubmittedAt: Date | null;
    rosterStatus: string;
    rosterSubmittedAt: Date | null;
    accreditedAt: Date | null;
  }>;
  people: Array<{
    delegationId: string;
    firstName: string;
    middleNames: string | null;
    lastName: string;
    nationality: string;
    category: string;
    rosterType: string | null;
    officialRole: string | null;
    otherOfficialTitle: string | null;
    role: string | null;
    jerseyNumber: number | null;
    isCaptain: boolean;
    dateOfBirth: string | null;
    isHeadOfDelegation: boolean;
    benchEligible: boolean;
    nationalityMatchesTeam: boolean;
    eligibilityConfirmed: boolean;
    eligibilityReference: string | null;
    biography: string;
    consentStatus: string;
    identityStatus: string;
    locReviewStatus: string;
    credentialStatus: string;
  }>;
};

type CellValue = string | number;
type ZipEntry = { name: string; data: Buffer };

const textEncoder = new TextEncoder();

function xml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function iso(value: Date | string | null): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.toISOString();
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function worksheetXml(
  rows: CellValue[][],
  widths: number[],
  options: { table?: boolean; readme?: boolean } = {},
): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          const style = options.readme
            ? rowIndex === 0
              ? 3
              : columnIndex === 0
                ? 2
                : 0
            : rowIndex === 0
              ? 1
              : rowIndex % 2 === 1
                ? 4
                : 0;
          if (typeof value === 'number') {
            return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
          }
          return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
        })
        .join('');
      const height = rowIndex === 0 ? ' ht="32" customHeight="1"' : '';
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    })
    .join('');
  const columns = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join('');
  const freeze = options.table
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const filter = options.table
    ? `<autoFilter ref="A1:${columnName(widths.length - 1)}${Math.max(rows.length, 1)}"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}<sheetFormatPr defaultRowHeight="15"/><cols>${columns}</cols><sheetData>${rowXml}</sheetData>${filter}</worksheet>`;
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const crcLookup = crcTable();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcLookup[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  };
}

function zip(entries: ZipEntry[], modifiedAt: Date): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const stamp = dosTime(modifiedAt);
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(textEncoder.encode(entry.name));
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function utf8(value: string): Buffer {
  return Buffer.from(textEncoder.encode(value));
}

export async function buildNwcSubmissionWorkbook(
  data: NwcSubmissionExport,
): Promise<Buffer> {
  const delegationById = new Map(
    data.delegations.map((delegation) => [delegation.id, delegation]),
  );
  const personCount = new Map<string, number>();
  for (const person of data.people) {
    personCount.set(
      person.delegationId,
      (personCount.get(person.delegationId) ?? 0) + 1,
    );
  }

  const readmeRows: CellValue[][] = [
    ['NWC submission export', data.tournament.name],
    ['Generated', data.generatedAt.toISOString()],
    ['Competition timezone', data.tournament.timezone],
    ['Delegations', data.delegations.length],
    ['People', data.people.length],
    [
      'Purpose',
      'Authorised LOC operational copy for preparing the Netball World Cup submission.',
    ],
    [
      'Data minimisation',
      'This workbook excludes identity-document files, credential QR tokens, internal database identifiers, and LOC review notes.',
    ],
    [
      'Security',
      'Contains personal data. Store only in an approved encrypted location, share only through the approved NWC channel, and securely delete working copies when no longer required.',
    ],
    [
      'Recovery note',
      'This export is an operational continuity copy. It does not replace encrypted platform backups and tested database recovery procedures.',
    ],
  ];

  const delegationRows: CellValue[][] = [
    [
      'Country code',
      'Delegation',
      'Association',
      'Head of delegation',
      'Head coach',
      'Contact name',
      'Contact role',
      'Contact email',
      'Contact phone',
      'Expected squad',
      'Travelling party',
      'Arrival date',
      'Departure date',
      'Data consent recorded',
      'Registration status',
      'Registration submitted',
      'Roster status',
      'Roster submitted',
      'Accredited',
      'People in export',
    ],
  ];
  for (const delegation of data.delegations) {
    delegationRows.push([
      delegation.countryCode,
      delegation.name,
      delegation.associationName ?? '',
      delegation.headOfDelegation ?? '',
      delegation.headCoach ?? '',
      delegation.contactName ?? '',
      delegation.contactRoleTitle ?? '',
      delegation.contactEmail ?? '',
      delegation.contactPhone ?? '',
      delegation.expectedSquadSize ?? '',
      delegation.travellingParty ?? '',
      iso(delegation.arrivalDate),
      iso(delegation.departureDate),
      yesNo(delegation.dpaConsent),
      delegation.registrationStatus,
      iso(delegation.registrationSubmittedAt),
      delegation.rosterStatus,
      iso(delegation.rosterSubmittedAt),
      iso(delegation.accreditedAt),
      personCount.get(delegation.id) ?? 0,
    ]);
  }

  const peopleRows: CellValue[][] = [
    [
      'Country code',
      'Delegation',
      'First name',
      'Middle names',
      'Last name',
      'Date of birth',
      'Nationality',
      'Category',
      'Roster type',
      'Official role',
      'Other official title',
      'Playing position / role',
      'Jersey number',
      'Captain',
      'Head of delegation',
      'Bench eligible',
      'Nationality matches team',
      'Eligibility confirmed',
      'Eligibility reference',
      'Biography',
      'Consent status',
      'Identity verification',
      'LOC person review',
      'Credential status',
    ],
  ];
  for (const person of data.people) {
    const delegation = delegationById.get(person.delegationId);
    peopleRows.push([
      delegation?.countryCode ?? '',
      delegation?.name ?? '',
      person.firstName,
      person.middleNames ?? '',
      person.lastName,
      iso(person.dateOfBirth),
      person.nationality,
      person.category,
      person.rosterType ?? '',
      person.officialRole ?? '',
      person.otherOfficialTitle ?? '',
      person.role ?? '',
      person.jerseyNumber ?? '',
      yesNo(person.isCaptain),
      yesNo(person.isHeadOfDelegation),
      yesNo(person.benchEligible),
      yesNo(person.nationalityMatchesTeam),
      yesNo(person.eligibilityConfirmed),
      person.eligibilityReference ?? '',
      person.biography,
      person.consentStatus,
      person.identityStatus,
      person.locReviewStatus,
      person.credentialStatus,
    ]);
  }

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF1B2A6B"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF1B2A6B"/><sz val="16"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B2A6B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF2FA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>GameDay LOC Platform</dc:creator><dc:title>${xml(data.tournament.name)} - NWC submission</dc:title><dc:subject>Netball World Cup submission export</dc:subject><dcterms:created xsi:type="dcterms:W3CDTF">${data.generatedAt.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${data.generatedAt.toISOString()}</dcterms:modified></cp:coreProperties>`;

  return zip(
    [
      {
        name: '[Content_Types].xml',
        data: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
        ),
      },
      {
        name: '_rels/.rels',
        data: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
        ),
      },
      { name: 'docProps/core.xml', data: utf8(core) },
      {
        name: 'xl/workbook.xml',
        data: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Read me" sheetId="1" r:id="rId1"/><sheet name="Delegations" sheetId="2" r:id="rId2"/><sheet name="People" sheetId="3" r:id="rId3"/></sheets></workbook>`,
        ),
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: utf8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
        ),
      },
      { name: 'xl/styles.xml', data: utf8(styles) },
      {
        name: 'xl/worksheets/sheet1.xml',
        data: utf8(worksheetXml(readmeRows, [28, 92], { readme: true })),
      },
      {
        name: 'xl/worksheets/sheet2.xml',
        data: utf8(
          worksheetXml(
            delegationRows,
            [
              14, 24, 25, 24, 22, 22, 20, 30, 19, 15, 16, 15, 15, 18, 18, 24,
              16, 24, 24, 16,
            ],
            { table: true },
          ),
        ),
      },
      {
        name: 'xl/worksheets/sheet3.xml',
        data: utf8(
          worksheetXml(
            peopleRows,
            [
              14, 24, 18, 20, 18, 15, 14, 15, 15, 18, 23, 23, 15, 12, 18, 15,
              20, 19, 24, 60, 18, 21, 18, 18,
            ],
            { table: true },
          ),
        ),
      },
    ],
    data.generatedAt,
  );
}
