export function downloadPagePath(id: string): string {
  const path = id.split("/").map(encodeURIComponent).join("/");

  return `/download/${path}`;
}

export function downloadFileName(label: string | null, id: string): string {
  const storedName = id.split("/").at(-1) || "download";
  const extension = storedName.includes(".") ? storedName.split(".").at(-1) : undefined;
  const name = (label || storedName).toWellFormed().replace(/[\x00-\x1f\x7f/\\]/g, "_");

  if (!extension || name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) return name;

  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;

  return `${base || "download"}.${extension}`;
}

export function attachmentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
  });

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
