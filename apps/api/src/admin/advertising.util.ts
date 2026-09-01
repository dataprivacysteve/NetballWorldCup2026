import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

type Surface = 'website' | 'display';
type Tier = 'gold' | 'silver' | 'bronze' | 'supporter';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function normalizeAdvertisingCreative(
  file: Express.Multer.File | undefined,
  surface: Surface,
  tier: Tier,
): Promise<{
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Advertising image is required');
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Advertising image must be JPEG, PNG, or WebP');
  }

  const dimensions =
    surface === 'display'
      ? { width: 1500, height: 500 }
      : tier === 'gold'
        ? { width: 970, height: 200 }
        : tier === 'supporter'
          ? { width: 600, height: 300 }
          : { width: 1200, height: 200 };

  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: 50_000_000,
    }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('missing dimensions');
    return {
      buffer: await image
        .resize(dimensions.width, dimensions.height, {
          fit: 'contain',
          background: { r: 7, g: 16, b: 34, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toBuffer(),
      contentType: 'image/webp',
      ...dimensions,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Advertising image could not be decoded');
  }
}

export async function normalizeNewsImage(
  file: Express.Multer.File | undefined,
): Promise<{ buffer: Buffer; contentType: "image/webp"; width: number; height: number }> {
  if (!file?.buffer?.length) {
    throw new BadRequestException("News image is required");
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new BadRequestException("News image must be JPEG, PNG, or WebP");
  }
  try {
    const buffer = await sharp(file.buffer, {
      failOn: "error",
      limitInputPixels: 50_000_000,
    })
      .rotate()
      .resize(1200, 750, { fit: "cover", position: "attention" })
      .webp({ quality: 88 })
      .toBuffer();
    return { buffer, contentType: "image/webp", width: 1200, height: 750 };
  } catch {
    throw new BadRequestException("News image could not be decoded");
  }
}
