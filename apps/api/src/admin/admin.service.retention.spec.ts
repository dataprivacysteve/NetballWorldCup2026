import { AdminService } from './admin.service';

describe('AdminService identity evidence retention', () => {
  it('records the LOC decision without deleting or unlinking the file', async () => {
    const document = {
      id: '8e24bc09-1c03-478d-bcd3-97f8a05ac780',
      playerId: '84b15770-f7c7-43a0-aacb-99db709ef924',
      delegationId: '24662277-680d-4669-80d7-f3bf8e3b27e5',
      objectKey: 'restricted/passport.pdf',
      contentType: 'application/pdf',
      documentType: 'passport',
    };
    let decisionValues: Record<string, unknown> | undefined;
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: jest.fn(async () => [document]) })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((values: Record<string, unknown>) => {
          decisionValues = values;
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => [{ ...document, ...values }]),
            })),
          };
        }),
      })),
      insert: jest.fn(() => ({ values: jest.fn(async () => undefined) })),
    };
    const service = Object.create(AdminService.prototype) as AdminService & {
      db: typeof db;
      s3: { send: jest.Mock };
      audit: jest.Mock;
    };
    service.db = db;
    service.s3 = { send: jest.fn() };
    service.audit = jest.fn(async () => undefined);

    await service.verifyIdentity(
      document.playerId,
      document.id,
      '152af33f-2232-467e-a5c2-d14a1e061692',
      'verified',
    );

    expect(service.s3.send).not.toHaveBeenCalled();
    expect(decisionValues).not.toHaveProperty('objectKey');
    expect(decisionValues).not.toHaveProperty('contentType');
    expect(decisionValues).toMatchObject({
      status: 'verified',
      documentDeletedAt: null,
    });
  });
});
