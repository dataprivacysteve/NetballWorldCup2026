import 'reflect-metadata';
import { validate } from 'class-validator';
import { RegisterDelegationDto } from './dto';

function validRegistration(countryCode: string): RegisterDelegationDto {
  return Object.assign(new RegisterDelegationDto(), {
    countryCode,
    teamName: 'St. Vincent',
    associationName: 'St. Vincent and the Grenadines Netball Association',
    teamManager: 'Team Manager',
    contactEmail: 'manager@example.test',
    password: 'test-password',
    confirmPassword: 'test-password',
    contactPhone: '+1 784 555 0100',
    expectedSquadSize: 12,
    dpaConsent: true,
  });
}

describe('RegisterDelegationDto', () => {
  it('accepts a configured tournament code that differs from ISO alpha-3', async () => {
    const errors = await validate(validRegistration('SVG'));
    expect(
      errors.find((error) => error.property === 'countryCode'),
    ).toBeUndefined();
  });

  it('still rejects malformed delegation codes', async () => {
    const errors = await validate(validRegistration('STVG'));
    expect(
      errors.find((error) => error.property === 'countryCode'),
    ).toBeDefined();
  });
});
