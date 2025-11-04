import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { vi } from "vitest";

const PUBLIC_DIR = join(process.cwd(), "public");

/**
 * Mock global fetch to serve files from public directory
 * Use this in tests that need to load cards.json or other static assets
 */
export function mockFetchFromPublicDir() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();

			if (url.startsWith("/data/")) {
				const filePath = join(PUBLIC_DIR, url);
				try {
					const content = await readFile(filePath, "utf-8");
					return new Response(content, {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch {}
			}

			return new Response(null, { status: 404 });
		}),
	);
}
