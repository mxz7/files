import type { Tweened } from "svelte/motion";

export type FileData = {
  status: "processing" | "uploading" | "done" | "error";
  progress: Tweened<number>;
  name: string;
  type: string;
  size: number;
  id: string;
  uploadedId?: string;
};
