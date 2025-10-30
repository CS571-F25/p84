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
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["@vitest/web-worker"],
		exclude: [...configDefaults.exclude, '**/.direnv/**']
	},
});
