import { BadRequestException } from '@nestjs/common';
import {
  normalizeProfilePhoto,
  validateIdentityDocument,
  validateProfilePhoto,
} from './file-validation';
import sharp from 'sharp';

function file(mimetype: string, bytes: number[]): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'upload',
    encoding: '7bit',
    mimetype,
    size: bytes.length,
    buffer: Buffer.from(bytes),
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('upload signature validation', () => {
  it('accepts genuine JPEG/PNG photos and rejects MIME spoofing', () => {
    expect(() =>
      validateProfilePhoto(file('image/jpeg', [0xff, 0xd8, 0xff, 0x00])),
    ).not.toThrow();
    expect(() =>
      validateProfilePhoto(file('image/png', [0x89, 0x50, 0x4e, 0x47])),
    ).not.toThrow();
    expect(() =>
      validateProfilePhoto(file('image/jpeg', [0x3c, 0x68, 0x74, 0x6d, 0x6c])),
    ).toThrow(BadRequestException);
  });

  it('accepts a signed PDF identity page and rejects executable content', () => {
    expect(() =>
      validateIdentityDocument(
        file('application/pdf', [...Buffer.from('%PDF-1.7')]),
      ),
    ).not.toThrow();
    expect(() =>
      validateIdentityDocument(file('application/pdf', [0x4d, 0x5a, 0x90])),
    ).toThrow(BadRequestException);
  });

  it('fully decodes and normalizes profile photos', async () => {
    const valid = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: '#1b2a6b',
      },
    })
      .png()
      .toBuffer();
    const normalized = await normalizeProfilePhoto(
      file('image/png', [...valid]),
    );
    expect(normalized.contentType).toBe('image/jpeg');
    const metadata = await sharp(normalized.buffer).metadata();
    expect(metadata).toMatchObject({ width: 600, height: 750, format: 'jpeg' });

    await expect(
      normalizeProfilePhoto(file('image/png', [0x89, 0x50, 0x4e, 0x47])),
    ).rejects.toThrow(BadRequestException);
  });
});
