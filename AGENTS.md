# Files — Agent Instructions

SvelteKit application for files.maxz.dev.

## Commands

```bash
pnpm dev       # Start the development server
pnpm build     # Build for production
pnpm check     # Run Svelte and TypeScript checks
pnpm lint      # Check formatting with Prettier
pnpm format    # Format with Prettier
```

## Svelte MCP Workflow

Use the Svelte MCP server for Svelte and SvelteKit work:

- Call `list-sections` first to discover the available documentation and identify relevant sections from their `use_cases`.
- Call `get-documentation` for every section relevant to the task before making framework-specific decisions.
