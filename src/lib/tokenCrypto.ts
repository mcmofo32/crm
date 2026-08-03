import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:";

function getKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Versleutelt een token voor opslag in de database. Zonder
 * `TOKEN_ENCRYPTION_KEY` blijft het token onversleuteld (zoals voorheen),
 * zodat lokale/dev-omgevingen zonder die variabele blijven werken.
 */
export function encryptToken(plainText: string): string {
  const key = getKey();
  if (!key) return plainText;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Ontsleutelt een opgeslagen token. Tokens die vóór het instellen van
 * `TOKEN_ENCRYPTION_KEY` opgeslagen zijn, staan nog onversleuteld (geen
 * `enc:`-prefix) en worden ongewijzigd teruggegeven — zo hoeft niemand
 * zijn Google-agenda opnieuw te koppelen bij het invoeren van de key.
 */
export function decryptToken(stored: string | null): string | null {
  if (!stored || !stored.startsWith(PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY ontbreekt: kan het opgeslagen token niet ontsleutelen."
    );
  }

  const [ivB64, authTagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

  return decrypted.toString("utf8");
}
