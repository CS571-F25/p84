import { useId, useState } from "react";

/**
 * Seeded PRNG (mulberry32)
 */
export function createSeededRng(seed: number): () => number {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Shuffle array using seeded RNG
 */
export function seededShuffle<T>(array: T[], rng: () => number): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Hook that provides a stable seed across SSR and hydration.
 *
 * On SSR: generates a random seed, embeds it in a hidden span
 * On hydration: reads the seed from the DOM
 * On client-only: generates a fresh seed
 */
export function useSeededRandom(): {
	seed: number;
	rng: () => number;
	SeedEmbed: () => React.ReactElement;
} {
	const id = useId();

	const [seed] = useState(() => {
		if (typeof document !== "undefined") {
			const el = document.getElementById(id);
			if (el?.dataset.seed) {
				return parseInt(el.dataset.seed, 10);
			}
		}
		return Math.floor(Math.random() * 2147483647);
	});

	const rng = createSeededRng(seed);
	const SeedEmbed = () => <span id={id} data-seed={seed} hidden />;

	return { seed, rng, SeedEmbed };
}
