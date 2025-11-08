import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { vi } from "vitest";

const PUBLIC_DIR = join(process.cwd(), "public");

/**
 * Mock global fetch to serve files from public directory
 * Use this in tests that need to load cards.json or other static assets
 *
 * Handles both relative (/data/...) and absolute (http://localhost:3000/data/...) URLs
 */
export function mockFetchFromPublicDir() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();

			// Extract path from absolute URL or use as-is if relative
			let path = url;
			try {
				const parsed = new URL(url);
				path = parsed.pathname;
			} catch {
				// Already a relative path
			}

			if (path.startsWith("/data/")) {
				const filePath = join(PUBLIC_DIR, path);
				try {
					if (filePath.endsWith(".bin")) {
						const buffer = await readFile(filePath);
						return new Response(buffer, {
							status: 200,
							headers: { "Content-Type": "application/octet-stream" },
						});
					}

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
