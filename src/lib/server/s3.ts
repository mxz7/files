import { env } from "$env/dynamic/private";
import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env.S3_KEY_ID,
    secretAccessKey: env.S3_KEY,
  },
});

export default s3;
