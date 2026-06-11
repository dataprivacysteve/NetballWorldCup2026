import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';

// Photo bytes are streamed THROUGH the API into MinIO (gameday-photos), not
// uploaded direct from the browser: the teams page is HTTPS and MinIO is
// plain HTTP on localhost, so a direct/presigned upload would be blocked as
// mixed content in dev. Server-to-server PutObject sidesteps that and keeps
// the API in control of validation. Identical SDK in production — only the
// endpoint/keys change. (NB: this is the ordinary photo bucket, not the
// Section 11 restricted identity bucket.)
@Injectable()
export class PhotoService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle:
        config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
    this.bucket = config.getOrThrow<string>('S3_BUCKET_PHOTOS');
  }

  async upload(playerId: string, file: Express.Multer.File) {
    const { db, delegationId } = getTenant();

    const [player] = await db
      .select()
      .from(schema.player)
      .where(eq(schema.player.id, playerId));
    if (!player) throw new NotFoundException('Player not found');

    const objectKey = `${delegationId}/${playerId}/${randomUUID()}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const [row] = await db
      .insert(schema.playerPhoto)
      .values({
        playerId,
        delegationId,
        objectKey,
        contentType: file.mimetype,
        status: 'uploaded',
        uploadedAt: new Date(),
      })
      .returning();
    return row;
  }
}
