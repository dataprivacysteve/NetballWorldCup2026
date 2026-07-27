import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { getTenant } from '../tenant/tenant-context';
import * as schema from '../db/schema';
import { IdentityUploadDto } from './dto';
import { validateIdentityDocument } from './file-validation';
import { assertRosterEditable } from './roster-editability';

@Injectable()
export class IdentityService {
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
    this.bucket = config.get<string>('S3_BUCKET_IDENTITY', 'gameday-identity');
  }

  async status(playerId: string) {
    const { db } = getTenant();
    const [player] = await db
      .select({
        id: schema.player.id,
        category: schema.player.category,
      })
      .from(schema.player)
      .where(eq(schema.player.id, playerId));
    if (!player) throw new NotFoundException('Person not found');
    const [document] = await db
      .select({
        id: schema.identityDocument.id,
        documentType: schema.identityDocument.documentType,
        issuingCountry: schema.identityDocument.issuingCountry,
        nationality: schema.identityDocument.nationality,
        expiresOn: schema.identityDocument.expiresOn,
        status: schema.identityDocument.status,
        reviewNote: schema.identityDocument.reviewNote,
        uploadedAt: schema.identityDocument.uploadedAt,
        verifiedAt: schema.identityDocument.verifiedAt,
      })
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    return document ?? null;
  }

  async upload(
    playerId: string,
    dto: IdentityUploadDto,
    file: Express.Multer.File | undefined,
  ) {
    await assertRosterEditable();
    validateIdentityDocument(file);
    if (dto.documentType === 'passport' && !dto.expiresOn) {
      throw new BadRequestException('Passport expiry date is required');
    }
    const { db, delegationId, userId } = getTenant();
    const [player] = await db
      .select({
        id: schema.player.id,
        category: schema.player.category,
        nationality: schema.player.nationality,
      })
      .from(schema.player)
      .where(eq(schema.player.id, playerId));
    if (!player) throw new NotFoundException('Person not found');
    const [event] = await db
      .select({
        categories: schema.tournament.identityRequiredCategories,
        endsOn: schema.tournament.endsOn,
      })
      .from(schema.tournament)
      .limit(1);
    if (!event?.categories.includes(player.category)) {
      throw new BadRequestException(
        'Identity documents are not collected for this person category',
      );
    }
    if (dto.nationality.toUpperCase() !== player.nationality.toUpperCase()) {
      throw new BadRequestException(
        'Document nationality must match the player nationality on the roster',
      );
    }
    if (dto.expiresOn && event.endsOn && dto.expiresOn < event.endsOn) {
      throw new BadRequestException(
        `Identity document must remain valid through ${event.endsOn}`,
      );
    }

    const [current] = await db
      .select()
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    const objectKey = `${delegationId}/${playerId}/${randomUUID()}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file!.buffer,
        ContentType: file!.mimetype,
      }),
    );

    const values = {
      delegationId,
      playerId,
      documentType: dto.documentType,
      issuingCountry: dto.issuingCountry.toUpperCase(),
      nationality: dto.nationality.toUpperCase(),
      expiresOn: dto.expiresOn ?? null,
      objectKey,
      contentType: file!.mimetype,
      status: 'pending' as const,
      reviewNote: null,
      uploadedAt: new Date(),
      verifiedAt: null,
      verifiedBy: null,
      documentDeletedAt: null,
    };
    try {
      // A replacement receives a fresh identifier. LOC decisions are bound to
      // that identifier, so a reviewer cannot decide a file that was replaced
      // after they opened it. The verification-event FK cascades this key
      // rotation so the full lineage remains attributed.
      const [document] = current
        ? await db
            .update(schema.identityDocument)
            .set({ ...values, id: randomUUID() })
            .where(eq(schema.identityDocument.id, current.id))
            .returning()
        : await db.insert(schema.identityDocument).values(values).returning();

      await db.insert(schema.identityVerificationEvent).values({
        identityDocumentId: document.id,
        delegationId,
        actorUserId: userId,
        action: current ? 'replaced' : 'uploaded',
      });
      await db.insert(schema.teamAuditEvent).values({
        delegationId,
        actorUserId: userId,
        action: current
          ? 'identity.document.replaced'
          : 'identity.document.uploaded',
        targetType: 'person',
        targetId: playerId,
        details: {
          documentId: document.id,
          documentType: document.documentType,
          expiresOn: document.expiresOn,
        },
      });
      if (current?.objectKey) {
        // Failure rolls back the metadata pointer; the catch removes the new
        // object so the restricted bucket never accumulates an orphan copy.
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: current.objectKey,
          }),
        );
      }
      return this.status(playerId);
    } catch (error) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }))
        .catch(() => undefined);
      throw error;
    }
  }

  async deleteObjectForPlayer(playerId: string) {
    await assertRosterEditable();
    const { db } = getTenant();
    const [document] = await db
      .select()
      .from(schema.identityDocument)
      .where(eq(schema.identityDocument.playerId, playerId));
    if (document?.objectKey) {
      await this.s3
        .send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: document.objectKey,
          }),
        )
        .catch(() => undefined);
    }
  }
}
