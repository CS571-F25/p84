import type { ReactNode } from "react";

interface DroppableSectionHeaderProps {
	children: ReactNode;
}

export function DroppableSectionHeader({
	children,
}: DroppableSectionHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-3 px-3 py-2">
			{children}
		</div>
	);
}
