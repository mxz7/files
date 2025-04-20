import { createCatppuccinPlugin } from "@catppuccin/daisyui";

export default createCatppuccinPlugin(
  "mocha",
  {
    "--depth": false,
    "--noise": false,
  },
  {
    default: true,
  },
);
