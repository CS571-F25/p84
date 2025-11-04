import { useEffect, useState } from "react";
import { initializeWorker } from "./cards-worker-client";

/**
 * Hook to track worker initialization status
 *
 * IMPORTANT: This is ONLY for visual indication of the worker, not queries.
 * DO NOT use this as a substitute for checking query loading states or data availability.
 * Always check query.isLoading and or query.data in components that depend on card data.
 *
 * Note: initializeWorker() is idempotent/reentrant - safe to call multiple times.
 */
export function useWorkerStatus() {
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		let mounted = true;

		// initializeWorker is reentrant - calling it multiple times is safe
		initializeWorker().then(() => {
			if (mounted) {
				setIsLoaded(true);
			}
		});

		return () => {
			mounted = false;
		};
	}, []);

	return { isLoaded };
}
