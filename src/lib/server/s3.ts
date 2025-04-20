import { S3_ENDPOINT, S3_KEY, S3_KEY_ID, S3_REGION } from "$env/static/private";
import { S3Client } from "@aws-sdk/client-s3";

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
