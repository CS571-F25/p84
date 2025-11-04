import { useEffect, useState } from "react";
import { useWorkerStatus } from "@/lib/useWorkerStatus";

export function WorkerStatusIndicator() {
	const { isLoaded } = useWorkerStatus();
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (!isLoaded) {
			// Smoothly animate to 90% while loading
			const timer = setTimeout(() => setWidth(90), 50);
			return () => clearTimeout(timer);
		}
		// Jump to 100% when loaded, then fade out
		setWidth(100);
	}, [isLoaded]);

	if (width === 100 && isLoaded) {
		// Fade out after reaching 100%
		return (
			<div className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none">
				<div
					className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-opacity duration-500 opacity-0"
					style={{ width: "100%" }}
				/>
			</div>
		);
	}

	return (
		<div className="fixed top-0 left-0 right-0 h-1 z-50 pointer-events-none">
			<div
				className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-[7000ms] ease-out"
				style={{ width: `${width}%` }}
			/>
		</div>
	);
}
