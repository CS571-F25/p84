import type { ReactNode } from "react";
import { useEffect } from "react";

interface DrawerProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	side?: "left" | "right";
	size?: "sm" | "md" | "lg";
	"aria-label"?: string;
	"aria-labelledby"?: string;
}

const SIZE_CLASSES = {
	sm: "w-80",
	md: "w-[30rem]",
	lg: "w-[40rem]",
} as const;

export function Drawer({
	isOpen,
	onClose,
	children,
	side = "right",
	size = "md",
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledby,
}: DrawerProps) {
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const positionClass = side === "left" ? "left-0" : "right-0";
	const borderClass = side === "left" ? "border-r" : "border-l";

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Drawer panel */}
			<div className="fixed inset-0 z-50 pointer-events-none">
				<div
					role="dialog"
					aria-modal="true"
					aria-label={ariaLabel}
					aria-labelledby={ariaLabelledby}
					className={`fixed inset-y-0 ${positionClass} ${SIZE_CLASSES[size]} max-w-[90vw] bg-white dark:bg-zinc-900 ${borderClass} border-gray-200 dark:border-zinc-600 shadow-2xl pointer-events-auto flex flex-col motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out`}
				>
					{children}
				</div>
			</div>
		</>
	);
}
