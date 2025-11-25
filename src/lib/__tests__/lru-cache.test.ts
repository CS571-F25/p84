import { describe, expect, it } from "vitest";
import { LRUCache } from "../lru-cache";

describe("LRUCache", () => {
	it("throws if maxSize is not positive", () => {
		expect(() => new LRUCache(0)).toThrow("maxSize must be positive");
		expect(() => new LRUCache(-1)).toThrow("maxSize must be positive");
	});

	it("stores and retrieves values", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);

		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBeUndefined();
	});

	it("evicts least recently used item when full", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);

		expect(cache.size).toBe(3);

		cache.set("d", 4);

		expect(cache.size).toBe(3);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBe(2);
		expect(cache.get("c")).toBe(3);
		expect(cache.get("d")).toBe(4);
	});

	it("refreshes item order on get", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);

		cache.get("a");

		cache.set("d", 4);

		expect(cache.get("a")).toBe(1);
		expect(cache.get("b")).toBeUndefined();
	});

	it("refreshes item order on set", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);

		cache.set("a", 10);

		cache.set("d", 4);

		expect(cache.get("a")).toBe(10);
		expect(cache.get("b")).toBeUndefined();
	});

	it("clears all items", () => {
		const cache = new LRUCache<string, number>(3);
		cache.set("a", 1);
		cache.set("b", 2);

		expect(cache.size).toBe(2);

		cache.clear();

		expect(cache.size).toBe(0);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBeUndefined();
	});

	describe("getOrSet", () => {
		it("returns cached value if present", async () => {
			const cache = new LRUCache<string, number>(3);
			cache.set("a", 1);

			let factoryCalled = false;
			const result = await cache.getOrSet("a", async () => {
				factoryCalled = true;
				return 999;
			});

			expect(result).toBe(1);
			expect(factoryCalled).toBe(false);
		});

		it("computes and caches value if missing", async () => {
			const cache = new LRUCache<string, number>(3);

			let factoryCalled = false;
			const result = await cache.getOrSet("a", async () => {
				factoryCalled = true;
				return 42;
			});

			expect(result).toBe(42);
			expect(factoryCalled).toBe(true);
			expect(cache.get("a")).toBe(42);
		});

		it("bubbles errors from factory without caching", async () => {
			const cache = new LRUCache<string, number>(3);

			await expect(
				cache.getOrSet("a", async () => {
					throw new Error("factory error");
				}),
			).rejects.toThrow("factory error");

			expect(cache.get("a")).toBeUndefined();
			expect(cache.size).toBe(0);
		});

		it("calls factory again on subsequent attempts after error", async () => {
			const cache = new LRUCache<string, number>(3);

			let attempt = 0;
			const factory = async () => {
				attempt++;
				if (attempt === 1) {
					throw new Error("first attempt failed");
				}
				return 42;
			};

			await expect(cache.getOrSet("a", factory)).rejects.toThrow(
				"first attempt failed",
			);
			expect(cache.get("a")).toBeUndefined();

			const result = await cache.getOrSet("a", factory);
			expect(result).toBe(42);
			expect(cache.get("a")).toBe(42);
		});

		it("respects LRU eviction with getOrSet", async () => {
			const cache = new LRUCache<string, number>(2);

			await cache.getOrSet("a", async () => 1);
			await cache.getOrSet("b", async () => 2);
			await cache.getOrSet("c", async () => 3);

			expect(cache.get("a")).toBeUndefined();
			expect(cache.get("b")).toBe(2);
			expect(cache.get("c")).toBe(3);
		});
	});
});
