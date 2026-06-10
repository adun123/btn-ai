/**
 * Bulk Storage Service
 *
 * Handles presigned URL generation and file retrieval from Supabase Storage
 * to bypass Vercel's 4.5MB request body limit.
 */

const { randomUUID } = require('node:crypto');
const { getSupabase } = require('../../data/supabase');
const { createHttpError } = require('../../utils/httpError');

const BUCKET = 'bulk-uploads';
const SIGNED_URL_EXPIRY = 600; // 10 minutes

/**
 * Ensure the storage bucket exists (creates if missing).
 */
async function ensureBucket() {
  const supabase = getSupabase();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

/**
 * Generate presigned upload URLs for a list of files.
 */
async function generatePresignedUrls(files) {
  if (!files || files.length === 0) {
    throw createHttpError(400, 'At least one file entry is required');
  }

  await ensureBucket();
  const supabase = getSupabase();
  const uploadId = randomUUID();
  const urls = [];

  for (const file of files) {
    const ext = file.filename.split('.').pop()?.toLowerCase() || '';
    const path = `${uploadId}/${randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error) {
      throw createHttpError(500, `Failed to create upload URL: ${error.message}`);
    }

    urls.push({
      filename: file.filename,
      path,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  }

  return { uploadId, urls };
}

/**
 * Download files from Supabase Storage for processing.
 */
async function downloadFromStorage(uploadId, files) {
  const supabase = getSupabase();
  const downloaded = [];

  for (const file of files) {
    console.log(`[BulkStorage] downloading ${file.path} from Supabase Storage`);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(file.path);

    if (error) {
      console.error(`[BulkStorage] download failed for ${file.path}: ${error.message}`);
      throw createHttpError(500, `Failed to download ${file.filename}: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
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
 * Cleanup uploaded files from Supabase Storage after processing.
 */
async function cleanupUpload(uploadId) {
  try {
    const supabase = getSupabase();
    const { data: list } = await supabase.storage
      .from(BUCKET)
      .list(uploadId);

    if (list && list.length > 0) {
      const paths = list.map(f => `${uploadId}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
      console.log(`[BulkStorage] cleaned up ${paths.length} files for upload ${uploadId}`);
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
