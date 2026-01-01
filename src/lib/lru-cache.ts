/**
 * LRU (Least Recently Used) cache with async getOrSet support
 */
export class LRUCache<K, V> {
	private cache = new Map<K, V>();
	private maxSize: number;

	constructor(maxSize: number) {
		if (maxSize <= 0) {
			throw new Error("LRU cache maxSize must be positive");
		}
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value as K;
			this.cache.delete(firstKey);
		}
		this.cache.set(key, value);
	}

	/**
	 * Get value from cache, or compute and store it if missing
	 * If factory throws, error bubbles and nothing is cached
	 */
	async getOrSet(key: K, factory: () => Promise<V>): Promise<V> {
		const cached = this.get(key);
		if (cached !== undefined) {
			return cached;
		}

		const value = await factory();
		this.set(key, value);
		return value;
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}

	/**
	 * Check if key exists without affecting LRU order
	 */
	has(key: K): boolean {
		return this.cache.has(key);
	}
}
