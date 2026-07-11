import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { S3Client } from "@aws-sdk/client-s3";

const { S3_ENDPOINT, S3_REGION, S3_KEY_ID, S3_KEY } = env;

if (!building) {
  if (!S3_ENDPOINT || !S3_REGION || !S3_KEY_ID || !S3_KEY) {
    throw new Error("Missing required S3 configuration");
  }
}

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: S3_KEY_ID,
    secretAccessKey: S3_KEY,
  },
});

export default s3;
