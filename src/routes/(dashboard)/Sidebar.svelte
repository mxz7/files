<script lang="ts">
  import { page } from "$app/stores";
  import { auth } from "$lib/stores";
  import { Files, Gift, KeyRound, LogOut, ShieldCheck, Upload, UserSearch } from "lucide-svelte";
</script>

<div class="drawer-side z-10 -mt-2 rounded-lg pt-2 lg:h-fit">
  <label for="my-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
  <ul class="menu bg-base-200 text-base-content min-h-full w-80 p-4">
    <li>
      <a
        href="/files"
        class="{$page.url.pathname === '/files'
          ? 'text-primary font-semibold'
          : ''} flex items-center"
      >
        <Files size={16} strokeWidth={2.5} />
        <span>files</span>
      </a>
    </li>

    <li>
      <a
        href="/upload"
        class="{$page.url.pathname === '/upload'
          ? 'text-primary font-semibold'
          : ''} flex items-center"
      >
        <Upload size={16} strokeWidth={2.5} />
        <span>upload</span>
      </a>
    </li>

    <li>
      <a
        href="/keys"
        class="{$page.url.pathname === '/keys'
          ? 'text-primary font-semibold'
          : ''} flex items-center"
      >
        <KeyRound size={16} strokeWidth={2.5} />
        <span>keys</span>
      </a>
    </li>

    {#if $auth && $auth.authenticated && $auth.user.admin}
      <ul class="ml-2">
        <li>
          <h2 class="-ml-1 font-semibold">
            <ShieldCheck size={16} strokeWidth={2.5} />
            <span>admin</span>
          </h2>
        </li>

        <li>
          <a
            href="/invites"
            class="{$page.url.pathname.startsWith('/invites')
              ? 'text-primary font-semibold'
              : ''} flex items-center"
          >
            <Gift size={16} strokeWidth={2.5} />
            <span>invites</span>
          </a>
        </li>

        <li>
          <a
            href="/users"
            class="{$page.url.pathname.startsWith('/users')
              ? 'text-primary font-semibold'
              : ''} flex items-center"
          >
            <UserSearch size={16} strokeWidth={2.5} />
            <span>users</span>
          </a>
        </li>
      </ul>
    {/if}

    <li>
      <a href="/logout" class="flex items-center">
        <LogOut size={16} strokeWidth={2.5} />
        <span>log out</span>
      </a>
    </li>
  </ul>
</div>
