<script lang="ts">
  import { ArrowLeft, ArrowRight } from "lucide-svelte";

  interface Props {
    currentPage: number;
    lastPage: number;
    route: string;
  }

  let { currentPage, lastPage, route }: Props = $props();
</script>

<div class="mt-2 flex w-full justify-center">
  <div class="join grid grid-cols-3">
    <a
      class="btn btn-ghost join-item {currentPage === 1 ? 'btn-disabled' : ''}"
      href="{route}?page={currentPage - 1 < 1 ? 1 : currentPage - 1}"
    >
      <ArrowLeft />
    </a>
    <span class="btn btn-ghost join-item">{currentPage}</span>
    <a
      class="btn btn-ghost join-item {currentPage === lastPage ? 'btn-disabled' : ''}"
      href="{route}?page={currentPage + 1 > lastPage ? lastPage : currentPage + 1}"
    >
      <ArrowRight />
    </a>
  </div>
</div>
