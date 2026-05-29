/**
 * ZIP Extractor using Node.js built-in modules.
 *
 * Parses ZIP files without external dependencies using the ZIP format specification.
 * Supports: Store (no compression) and Deflate compression methods.
 */

const zlib = require('node:zlib');

// ZIP file format constants
const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/**
 * Extract files from a ZIP buffer.
 * @param {Buffer} zipBuffer
 * @returns {Array<{ filename: string, buffer: Buffer }>}
 */
function extractZipBuffer(zipBuffer) {
  const files = [];

  // Find End of Central Directory record (search backwards from end)
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= 0; i -= 1) {
    if (zipBuffer.readUInt32LE(i) === END_OF_CENTRAL_DIR_SIG) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP file: End of Central Directory not found');
  }

  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const entryCount = zipBuffer.readUInt16LE(eocdOffset + 10);

  // Parse Central Directory
  let offset = centralDirOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > zipBuffer.length) break;
    if (zipBuffer.readUInt32LE(offset) !== CENTRAL_DIR_SIG) break;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 24);
    const filenameLen = zipBuffer.readUInt16LE(offset + 28);
    const extraLen = zipBuffer.readUInt16LE(offset + 30);
    const commentLen = zipBuffer.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);

    const filename = zipBuffer.slice(offset + 46, offset + 46 + filenameLen).toString('utf8');

    offset += 46 + filenameLen + extraLen + commentLen;

    // Skip directories
    if (filename.endsWith('/') || filename.endsWith('\\')) continue;

    // Read local file header to get actual data offset
    if (localHeaderOffset + 30 > zipBuffer.length) continue;
    if (zipBuffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIG) continue;

    const localFilenameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

    if (dataOffset + compressedSize > zipBuffer.length) continue;

    const compressedData = zipBuffer.slice(dataOffset, dataOffset + compressedSize);

    let fileBuffer;
    try {
      if (compressionMethod === 0) {
        // Stored (no compression)
        fileBuffer = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate
        fileBuffer = zlib.inflateRawSync(compressedData);
      } else {
        // Unsupported compression method, skip
        continue;
      }
    } catch (err) {
      // Skip files that fail to decompress
      continue;
    }

    files.push({ filename, buffer: fileBuffer });
  }

  return files;
}

module.exports = { extractZipBuffer };
