import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const PDF = Buffer.from('%PDF-');

function startsWith(bytes: Buffer, signature: Buffer): boolean {
  return bytes.subarray(0, signature.length).equals(signature);
}

export function validateProfilePhoto(file: Express.Multer.File | undefined) {
  if (!file?.buffer?.length) throw new BadRequestException('Photo is required');
  const valid =
    (file.mimetype === 'image/jpeg' && startsWith(file.buffer, JPEG)) ||
    (file.mimetype === 'image/png' && startsWith(file.buffer, PNG));
  if (!valid) {
    throw new BadRequestException('Photo must be a valid JPEG or PNG image');
  }
}

export async function normalizeProfilePhoto(
  file: Express.Multer.File | undefined,
): Promise<{ buffer: Buffer; contentType: 'image/jpeg' }> {
  validateProfilePhoto(file);
  try {
    const image = sharp(file!.buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('missing dimensions');
    }
    if (metadata.width < 240 || metadata.height < 240) {
      throw new BadRequestException(
        'Profile photo must be at least 240 by 240 pixels',
      );
    }
    return {
      buffer: await image
        .rotate()
        .resize(600, 750, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer(),
      contentType: 'image/jpeg',
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(
      'Photo could not be decoded as a complete JPEG or PNG image',
    );
  }
}

export function validateIdentityDocument(
  file: Express.Multer.File | undefined,
) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Passport or national-ID file is required');
  }
  const valid =
    (file.mimetype === 'image/jpeg' && startsWith(file.buffer, JPEG)) ||
    (file.mimetype === 'image/png' && startsWith(file.buffer, PNG)) ||
    (file.mimetype === 'application/pdf' && startsWith(file.buffer, PDF));
  if (!valid) {
    throw new BadRequestException(
      'Identity document must be a valid JPEG, PNG, or PDF file',
    );
  }
}
