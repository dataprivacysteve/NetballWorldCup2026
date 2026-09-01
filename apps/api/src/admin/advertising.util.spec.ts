import sharp from 'sharp';
import { normalizeAdvertisingCreative, normalizeNewsImage } from './advertising.util';

function upload(buffer: Buffer, mimetype = 'image/png') {
  return { buffer, mimetype } as Express.Multer.File;
}

describe('advertising creative normalization', () => {
  it('normalizes the in-house creative to 1500 by 500', async () => {
    const source = await sharp({
      create: {
        width: 900,
        height: 900,
        channels: 4,
        background: '#f4c430',
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeAdvertisingCreative(
      upload(source),
      'display',
      'gold',
    );
    const metadata = await sharp(normalized.buffer).metadata();

    expect(metadata.width).toBe(1500);
    expect(metadata.height).toBe(500);
    expect(normalized.contentType).toBe('image/webp');
  });

  it.each([
    ['gold', 970, 200],
    ['silver', 1200, 200],
    ['bronze', 1200, 200],
    ['supporter', 600, 300],
  ] as const)('normalizes the %s website placement', async (tier, width, height) => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 400,
        channels: 4,
        background: '#1b2a6b',
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeAdvertisingCreative(
      upload(source),
      'website',
      tier,
    );
    const metadata = await sharp(normalized.buffer).metadata();

    expect(metadata.width).toBe(width);
    expect(metadata.height).toBe(height);
  });
});

describe('news image normalization', () => {
  it('crops newsroom images to the website card ratio', async () => {
    const source = await sharp({
      create: {
        width: 1800,
        height: 900,
        channels: 4,
        background: '#071022',
      },
    })
      .png()
      .toBuffer();

    const normalized = await normalizeNewsImage(upload(source));
    const metadata = await sharp(normalized.buffer).metadata();

    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(750);
    expect(normalized.contentType).toBe('image/webp');
  });

  it('rejects unsupported newsroom image formats', async () => {
    await expect(
      normalizeNewsImage(upload(Buffer.from('not-an-image'), 'image/svg+xml')),
    ).rejects.toThrow('News image must be JPEG, PNG, or WebP');
  });
});
