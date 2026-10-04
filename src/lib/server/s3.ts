import { S3_ENDPOINT, S3_KEY_ID, S3_ACCESS_KEY } from "$app/env/private";
import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  endpoint: S3_ENDPOINT!,
  region: "auto",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: { accessKeyId: S3_KEY_ID!, secretAccessKey: S3_ACCESS_KEY! },
});
