import { configDefaults, defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		viteReact(),
	],
	resolve: {
		alias: {
			// Mock cloudflare:workers in tests - return empty env so it falls back to fetch
			"cloudflare:workers": new URL(
				"./src/lib/__tests__/cloudflare-workers-mock.ts",
				import.meta.url,
			).pathname,
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		exclude: [...configDefaults.exclude, "**/.direnv/**", "e2e/**"],
	},
});
