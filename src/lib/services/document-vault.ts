import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export function validateVaultFile(file: File) {
  if (file.size === 0) throw new Error("Choose a file with content");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Each document must be 4 MB or smaller");
  if (!ACCEPTED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error("Upload a PDF, image, Word document, or text file");
  }
}

export function encryptVaultFile(data: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, vaultKey(), iv);
  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
  return { encryptedData, encryptionIv: iv, encryptionTag: cipher.getAuthTag(), checksum: checksum(data) };
}

export function decryptVaultFile(input: { encryptedData: Uint8Array; encryptionIv: Uint8Array; encryptionTag: Uint8Array }) {
  const decipher = createDecipheriv(ALGORITHM, vaultKey(), input.encryptionIv);
  decipher.setAuthTag(Buffer.from(input.encryptionTag));
  return Buffer.concat([decipher.update(input.encryptedData), decipher.final()]);
}

export function vaultEncryptionKeyId() {
  return createHash("sha256").update(`finarc:vault:key-id:${vaultSecret()}`).digest("hex").slice(0, 16);
}

function checksum(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function vaultKey() {
  return createHash("sha256").update(`finarc:vault:v1:${vaultSecret()}`).digest();
}

function vaultSecret() {
  return process.env.FINARC_DOCUMENT_SECRET || process.env.FINARC_AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || "finarc-local-development-document-secret";
}
