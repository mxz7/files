<script lang="ts">
  import { page } from "$app/state";
  import { downloadPagePath } from "#lib/download.js";
  import { Copy, Download, Link } from "lucide-svelte";
  import { toast } from "svelte-sonner";

  let { id }: { id: string } = $props();

  const menuId = $props.id();
  const anchorName = `--copy-${menuId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  async function copyLink(kind: "direct" | "download", event: MouseEvent) {
    const menu = (event.currentTarget as HTMLButtonElement).closest("[popover]") as HTMLElement;

    menu.hidePopover();

    const url =
      kind === "direct"
        ? `https://file.maxz.dev/${id}`
        : `${page.url.origin}${downloadPagePath(id)}`;

    try {
      await navigator.clipboard.writeText(url);

      toast.success(kind === "direct" ? "Direct link copied" : "Download page link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }
</script>

<button
  class="btn btn-ghost tooltip tooltip-top"
  data-tip="Copy link"
  aria-label="Copy link options"
  popovertarget={menuId}
  style="anchor-name: {anchorName}"
>
  <Copy size={16} />
</button>

<ul
  id={menuId}
  popover
  class="dropdown dropdown-end menu bg-base-200 border-base-content/10 z-20 w-60 rounded-xl border p-2 shadow-lg"
  style="position-anchor: {anchorName}"
>
  <li>
    <button onclick={(event) => copyLink("direct", event)}>
      <Link size={16} />
      Copy direct link
    </button>
  </li>

  <li>
    <button onclick={(event) => copyLink("download", event)}>
      <Download size={16} />
      Copy download page link
    </button>
  </li>
</ul>
