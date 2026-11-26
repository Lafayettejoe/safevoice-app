import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "./env";

// The S3 settings are optional in env.ts so the app can start without them.
// Anything that actually uses storage must have all five.
function getStorage() {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  } = env;

  if (
    !S3_ENDPOINT ||
    !S3_REGION ||
    !S3_BUCKET ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("Storage is not configured. Check the S3_ values in .env");
  }

  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    forcePathStyle: true, // Supabase needs this
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });

  return { client, bucket: S3_BUCKET };
}

// Saves one audio recording and returns its storage key.
// The key is random: it says nothing about who or what the recording is.
export async function uploadAudio(
  body: Uint8Array,
  contentType: string
): Promise<string> {
  const { client, bucket } = getStorage();
  const key = `audio/${randomUUID()}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return key;
}

// Reads a recording back (used later for transcription).
export async function readAudio(key: string): Promise<Uint8Array> {
  const { client, bucket } = getStorage();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  if (!result.Body) throw new Error("Audio file is empty");
  return result.Body.transformToByteArray();
}

// Deletes a recording (used by the deletion job).
export async function deleteAudio(key: string): Promise<void> {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}