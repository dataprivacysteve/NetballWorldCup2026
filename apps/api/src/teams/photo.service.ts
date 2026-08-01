import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { desc, eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { normalizeProfilePhoto } from './file-validation';
import { assertRosterEditable } from './roster-editability';

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
    const normalized = await normalizeProfilePhoto(file);
    await assertRosterEditable();
    const { db, delegationId, userId } = getTenant();

    const [player] = await db
      .select()
      .from(schema.player)
      .where(eq(schema.player.id, playerId));
    if (!player) throw new NotFoundException('Player not found');

    const previous = await db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
    const objectKey = `${delegationId}/${playerId}/${randomUUID()}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: normalized.buffer,
        ContentType: normalized.contentType,
      }),
    );

    try {
      const [row] = await db
        .insert(schema.playerPhoto)
        .values({
          playerId,
          delegationId,
          objectKey,
          contentType: normalized.contentType,
          status: 'uploaded',
          uploadedAt: new Date(),
        })
        .returning();
      for (const photo of previous) {
        await db
          .delete(schema.playerPhoto)
          .where(eq(schema.playerPhoto.id, photo.id));
        // Do not suppress replacement deletion failures. Throwing rolls the
        // tenant transaction back to the prior metadata; the catch below also
        // removes the newly uploaded object.
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: photo.objectKey,
          }),
        );
      }
      await db.insert(schema.teamAuditEvent).values({
        delegationId,
        actorUserId: userId,
        action: previous.length
          ? 'roster.photo.replaced'
          : 'roster.photo.uploaded',
        targetType: 'person',
        targetId: playerId,
        details: { photoId: row.id },
      });
      return row;
    } catch (error) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }))
        .catch(() => undefined);
      throw error;
    }
  }

  async deleteForPlayer(playerId: string) {
    await assertRosterEditable();
    const { db } = getTenant();
    const photos = await db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId));
    for (const photo of photos) {
      await this.s3
        .send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: photo.objectKey,
          }),
        )
        .catch(() => undefined);
    }
  }

  // Streams the player's most recent photo bytes back from MinIO. Tenant-scoped
  // (the player lookup runs under RLS), so a delegation can only fetch its own
  // photos. The browser reaches this through the API with the tenant header —
  // it never talks to MinIO directly (which is plain HTTP).
  async getLatestImage(playerId: string) {
    const { db } = getTenant();
    const [photo] = await db
      .select()
      .from(schema.playerPhoto)
      .where(eq(schema.playerPhoto.playerId, playerId))
      .orderBy(desc(schema.playerPhoto.uploadedAt))
      .limit(1);
    if (!photo || photo.objectKey.endsWith('/seed.png')) {
      throw new NotFoundException('No usable photo for this player');
    }

    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: photo.objectKey }),
    );
    const bytes = await object.Body!.transformToByteArray();
    return {
      contentType: photo.contentType ?? 'application/octet-stream',
      buffer: Buffer.from(bytes),
    };
  }
}
