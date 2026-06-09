/**
 * Bulk Storage Service
 *
 * Handles presigned URL generation and file retrieval from AWS S3
 * to bypass Vercel's 4.5MB request body limit.
 *
 * Uses the same S3 bucket as the evidence upload flow.
 */

const { randomUUID } = require('node:crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createHttpError } = require('../../utils/httpError');

const BUCKET = process.env.S3_BUCKET;
const SIGNED_URL_EXPIRY = 600; // 10 minutes
const BULK_PREFIX = 'bulk-uploads';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

/**
 * Generate presigned upload URLs for a list of files.
 * @param {{ filename: string, contentType: string }[]} files
 * @returns {{ uploadId: string, urls: { filename: string, path: string, signedUrl: string }[] }}
 */
async function generatePresignedUrls(files) {
  if (!files || files.length === 0) {
    throw createHttpError(400, 'At least one file entry is required');
  }

  const uploadId = randomUUID();
  const urls = [];

  for (const file of files) {
    const ext = file.filename.split('.').pop()?.toLowerCase() || '';
    const s3Key = `${BULK_PREFIX}/${uploadId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: file.contentType,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: SIGNED_URL_EXPIRY,
      unhoistableHeaders: new Set(['content-type']),
    });

    urls.push({
      filename: file.filename,
      path: s3Key,
      signedUrl,
      token: '', // S3 doesn't use tokens, kept for API compatibility
    });
  }

  return { uploadId, urls };
}

/**
 * Download files from S3 for processing.
 * @param {string} uploadId
 * @param {{ filename: string, path: string, contentType: string }[]} files
 * @returns {Array<{ buffer: Buffer, originalname: string, mimetype: string, size: number }>}
 */
async function downloadFromStorage(uploadId, files) {
  const downloaded = [];

  for (const file of files) {
    console.log(`[BulkStorage] downloading ${file.path} from S3 bucket ${BUCKET}`);

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: file.path,
    });

    let response;
    try {
      response = await s3.send(command);
    } catch (err) {
      console.error(`[BulkStorage] download failed for ${file.path}: ${err.message}`);
      throw createHttpError(500, `Failed to download ${file.filename} from storage: ${err.message}`);
    }

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    console.log(`[BulkStorage] downloaded ${file.filename}: ${buffer.length} bytes`);
    downloaded.push({
      buffer,
      originalname: file.filename,
      mimetype: file.contentType || guessMime(file.filename),
      size: buffer.length,
    });
  }

  if (downloaded.length === 0) {
    throw createHttpError(400, 'No files could be downloaded from storage');
  }

  return downloaded;
}

/**
 * Cleanup uploaded files from S3 after processing.
 */
async function cleanupUpload(uploadId) {
  try {
    const prefix = `${BULK_PREFIX}/${uploadId}/`;
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    });

    const listResult = await s3.send(listCommand);
    const objects = listResult.Contents;

    if (objects && objects.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: objects.map(obj => ({ Key: obj.Key })),
        },
      });
      await s3.send(deleteCommand);
      console.log(`[BulkStorage] cleaned up ${objects.length} files for upload ${uploadId}`);
    }
  } catch (err) {
    console.warn(`[BulkStorage] cleanup failed for ${uploadId}: ${err.message}`);
  }
}

function guessMime(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', zip: 'application/zip' };
  return map[ext] || 'application/octet-stream';
}

module.exports = { generatePresignedUrls, downloadFromStorage, cleanupUpload };
