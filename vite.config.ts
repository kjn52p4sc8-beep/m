import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pwa } from "./scripts/pwa";
export default defineConfig({ plugins: [react(), tailwindcss(), pwa()] });
