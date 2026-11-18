import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

// AES-256-GCM encryption for the two sensitive fields in the schema:
//   SurvivorIdentity.identityPayload
//   SurvivorContact.contactPayload
// No other file in the project may encrypt or decrypt anything.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // the standard size for GCM
const TAG_BYTES = 16; // the authentication tag, proves nobody changed the data
const VERSION = "v1"; // lets us rotate to a new key or format later

function getKey(): Buffer {
    return Buffer.from(env.ENCRYPTION_KEY, "hex");
}

// Output format: v1:<iv>:<tag>:<ciphertext>  (each part base64)
function encryptText(plaintext: string): string {
    const iv = randomBytes(IV_BYTES); // a new random IV for every encryption
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
        VERSION,
        iv.toString("base64"),
        tag.toString("base64"),
        encrypted.toString("base64"),
    ].join(":");
}

function decryptText(payload: string): string {
    const parts = payload.split(":");
    const [version, ivB64, tagB64, dataB64] = parts;

    if (
        parts.length !== 4 ||
        version !== VERSION ||
        ivB64 === undefined ||
        tagB64 === undefined ||
        dataB64 === undefined
    ) {
        throw new Error("Invalid encrypted payload format");
    }

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error("Invalid encrypted payload format");
    }

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    // final() throws if the data or tag was tampered with, or the key is wrong.
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        "utf8",
    );
}

export function encryptIdentityPayload(payload: Record<string, unknown>): string {
    return encryptText(JSON.stringify(payload));
}

// Returns unknown on purpose: the caller must check the shape with Zod.
export function decryptIdentityPayload(encrypted: string): unknown {
    return JSON.parse(decryptText(encrypted));
}

export function encryptContactPayload(contact: string): string {
    return encryptText(contact);
}

export function decryptContactPayload(encrypted: string): string {
    return decryptText(encrypted);
}