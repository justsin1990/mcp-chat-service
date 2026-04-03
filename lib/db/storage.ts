import { supabase } from "@/lib/supabase";

const BUCKET = "chat-images";

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mimeType });
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mimeType] ?? "png";
}

export async function uploadBase64Image(
  base64Data: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const ext = mimeToExt(mimeType);
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `${fileName}`;
    const blob = base64ToBlob(base64Data, mimeType);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, blob, { contentType: mimeType, upsert: false });

    if (error) {
      console.error("Image upload failed:", error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch {
    return null;
  }
}
