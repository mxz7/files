export function uploadToS3(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.timeout = 15 * 60 * 1000;

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("Upload failed"));
    };

    request.onerror = () => reject(new Error("Upload failed"));
    request.onabort = () => reject(new Error("Upload canceled"));
    request.ontimeout = () => reject(new Error("Upload timed out"));

    request.send(file);
  });
}
