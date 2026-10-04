<script lang="ts">
  import { getDownloadFile } from "#lib/api/downloads.remote.js";
  import { formatBytes } from "#lib/format.js";
  import { page } from "$app/state";
  import {
    Download,
    File,
    FileArchive,
    FileAudio,
    FileImage,
    FileCode,
    FileSpreadsheet,
    FileType,
    FileCog,
    Presentation,
    BookOpen,
    FileText,
    FileVideo,
  } from "lucide-svelte";
  import { toast } from "svelte-sonner";

  const id = $derived(page.params.id ?? "");
  const file = $derived(await getDownloadFile(id));
  const extension = $derived(file.name.split(".").at(-1)?.toUpperCase() ?? "FILE");

  const FileIcon = $derived.by(() => {
    const type = file.contentType.toLowerCase();
    const ext = extension.toLowerCase();

    if (
      type.startsWith("image/") ||
      /^(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic|ico)$/.test(ext)
    ) {
      return FileImage;
    }
    if (type.startsWith("video/") || /^(mp4|webm|mov|mkv|avi|m4v)$/.test(ext)) return FileVideo;
    if (type.startsWith("audio/") || /^(mp3|wav|flac|ogg|m4a|aac|opus)$/.test(ext))
      return FileAudio;

    if (/zip|compressed|tar|rar|7z/.test(type) || /^(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext)) {
      return FileArchive;
    }

    if (/spreadsheet|excel|csv/.test(type) || /^(xlsx?|ods|csv|tsv)$/.test(ext)) {
      return FileSpreadsheet;
    }

    if (/presentation|powerpoint/.test(type) || /^(pptx?|odp)$/.test(ext)) {
      return Presentation;
    }

    if (/epub|ebook/.test(type) || /^(epub|mobi)$/.test(ext)) return BookOpen;
    if (type.startsWith("font/") || /^(woff2?|ttf|otf)$/.test(ext)) return FileType;

    if (
      /json|javascript|xml/.test(type) ||
      /^(html?|css|js|ts|jsx|tsx|json|xml|py|rs|go|sh|sql|svelte)$/.test(ext)
    ) {
      return FileCode;
    }

    if (/pdf|word|document|rtf/.test(type) || /^(pdf|docx?|odt|rtf|txt|md)$/.test(ext)) {
      return FileText;
    }

    if (/^(exe|msi|dmg|apk|deb|rpm|appimage)$/.test(ext)) return FileCog;
    if (type.startsWith("text/")) return FileText;

    return File;
  });

  let downloading = $state(false);

  function formatDate(date: Date): string {
    return (
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date) + " UTC"
    );
  }

  async function download(event: MouseEvent) {
    event.preventDefault();

    if (downloading) return;

    downloading = true;

    try {
      // Refresh on click so an old page cannot hand out an expired signed URL.
      await getDownloadFile(id).refresh();

      const latest = await getDownloadFile(id);

      window.location.assign(latest.downloadUrl);
    } catch {
      toast.error("This file couldn't be downloaded. It may have expired or been removed.");
    } finally {
      downloading = false;
    }
  }
</script>

<svelte:head>
  <title>{file.label} — download :: files.maxz.dev</title>
  <meta name="robots" content="noindex, noarchive" />
  <meta
    name="description"
    content="Download {file.label} ({formatBytes(file.bytes)}), uploaded by {file.uploader}."
  />
  <meta property="og:title" content={file.label} />
  <meta
    property="og:description"
    content="{formatBytes(file.bytes)} · uploaded by {file.uploader} · files.maxz.dev"
  />
  <meta property="og:type" content="website" />
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
  <p class="text-base-content/60 mb-4 text-sm font-semibold">Shared file</p>

  <section
    class="card bg-base-200 border-base-content/10 border shadow-sm"
    aria-labelledby="file-name"
  >
    <div class="card-body gap-6 p-6 sm:p-8">
      <div class="flex items-start gap-4">
        <div class="bg-primary/10 text-primary shrink-0 rounded-xl p-4">
          <FileIcon size={32} aria-hidden="true" />
        </div>

        <div class="min-w-0 flex-1">
          <h1 id="file-name" class="text-primary text-2xl font-bold [overflow-wrap:anywhere]">
            {file.label}
          </h1>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="badge badge-soft badge-primary">{extension}</span>
            <span class="text-base-content/70 text-sm">{formatBytes(file.bytes)}</span>
          </div>
        </div>
      </div>

      <a
        href={file.downloadUrl}
        download={file.name}
        onclick={download}
        aria-disabled={downloading}
        class="btn btn-primary btn-lg w-full {downloading ? 'btn-disabled' : ''}"
      >
        {#if downloading}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Download size={20} />
        {/if}

        Download file · {formatBytes(file.bytes)}
      </a>

      <dl class="border-base-content/10 grid gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-2">
        <div>
          <dt class="text-base-content/60 text-sm">Uploaded by</dt>
          <dd class="mt-1 font-medium [overflow-wrap:anywhere]">{file.uploader}</dd>
        </div>

        <div>
          <dt class="text-base-content/60 text-sm">File size</dt>
          <dd class="mt-1 font-medium">{formatBytes(file.bytes)}</dd>
        </div>

        <div>
          <dt class="text-base-content/60 text-sm">Upload date</dt>
          <dd class="mt-1 font-medium">
            <time datetime={file.uploadedAt.toISOString()}>{formatDate(file.uploadedAt)}</time>
          </dd>
        </div>

        <div>
          <dt class="text-base-content/60 text-sm">Expires</dt>
          <dd class="mt-1 font-medium">
            <time datetime={file.expiresAt.toISOString()}>{formatDate(file.expiresAt)}</time>
          </dd>
        </div>

        <div>
          <dt class="text-base-content/60 text-sm">File type</dt>
          <dd class="mt-1 font-medium [overflow-wrap:anywhere]">{file.contentType}</dd>
        </div>

        <div>
          <dt class="text-base-content/60 text-sm">File name</dt>
          <dd class="mt-1 font-medium [overflow-wrap:anywhere]">{file.name}</dd>
        </div>
      </dl>
    </div>
  </section>
</main>
