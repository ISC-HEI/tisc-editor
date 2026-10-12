import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function createClient() {
  return new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'garage',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

function client(): S3Client {
  if (!globalForS3.s3) globalForS3.s3 = createClient();
  return globalForS3.s3;
}

function bucket(): string {
  return requireEnv('S3_BUCKET');
}

/**
 * Stores an object (overwrites any existing object with the same key).
 */
export async function putObject(key: string, body: Uint8Array, contentType?: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Reads an object fully into memory. Throws if the object does not exist.
 */
export async function getObject(key: string): Promise<Uint8Array> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));

  if (!res.Body) throw new Error(`Empty body for object ${key}`);

  return res.Body.transformToByteArray();
}

/**
 * Copies an object inside the bucket, server side (no download/upload).
 */
export async function copyObject(sourceKey: string, destinationKey: string) {
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      CopySource: `${bucket()}/${sourceKey}`,
      Key: destinationKey,
    }),
  );
}

/**
 * Deletes several objects (batches of 1000). Missing keys are ignored.
 */
export async function deleteObjects(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);

    const res = await client().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );

    if (res.Errors && res.Errors.length > 0) {
      throw new Error(`Failed to delete ${res.Errors.length} object(s): ${res.Errors[0].Message}`);
    }
  }
}

/**
 * Deletes every object whose key starts with the given prefix.
 */
export async function deleteByPrefix(prefix: string) {
  let continuationToken: string | undefined;

  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (res.Contents ?? []).map((object) => object.Key!).filter(Boolean);

    if (keys.length > 0) await deleteObjects(keys);

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
}

/**
 * Like Promise.all(items.map(fn)) but with at most `limit` calls in flight.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}
