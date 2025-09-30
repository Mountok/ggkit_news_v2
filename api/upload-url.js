import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REQUIRED_ENV = ["YOS_ACCESS_KEY_ID", "YOS_SECRET_ACCESS_KEY", "YOS_BUCKET", "YOS_REGION"];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) {
    console.error(`Missing env var: ${k}`);
  }
}

const s3 = new S3Client({
  region: process.env.YOS_REGION,
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: process.env.YOS_ACCESS_KEY_ID,
    secretAccessKey: process.env.YOS_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { filename, contentType, mode } = req.body || {};
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    if (!String(contentType).startsWith("image/")) {
      return res.status(400).json({ error: "Only image/* contentType allowed" });
    }

    const safe = String(filename).replace(/[^\w.\-]/g, "_");
    let key;
    if (["1.jpg","2.jpg","3.jpg","4.jpg"].includes(safe)) {
      key = `public/${safe}`;
    } else {
      return res.status(400).json({ error: "Можно загружать только 1.jpg, 2.jpg, 3.jpg или 4.jpg" });
    }

    const cmd = new PutObjectCommand({
      Bucket: process.env.YOS_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "public-read" // можно убрать, если публичность задана политикой бакета
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 }); // 5 минут
    const publicUrl = `https://storage.yandexcloud.net/${process.env.YOS_BUCKET}/${encodeURIComponent(key)}`;

    return res.status(200).json({ uploadUrl, key, publicUrl });
  } catch (e) {
    console.error("upload-url error:", e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
