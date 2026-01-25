import { Bookmark } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import type { ScryfallId } from "@/lib/scryfall-types";

export interface CardSpreadProps {
	cardIds: string[];
	/** Fallback icon when no cards (default: Bookmark) */
	emptyIcon?: React.ReactNode;
}

export function CardSpread({ cardIds, emptyIcon }: CardSpreadProps) {
	const cards = cardIds.slice(0, 3).reverse();

	if (cards.length === 0) {
		return (
			<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
				{emptyIcon ?? (
					<Bookmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
				)}
			</div>
		);
	}

	const layouts: Record<
		number,
		{
			rotations: number[];
			xPercents: number[];
			hoverRotations: number[];
			hoverZ: number;
		}
	> = {
		1: {
			rotations: [0],
			xPercents: [20],
			hoverRotations: [90],
			hoverZ: 8,
		},
		2: {
			rotations: [-8, 8],
			xPercents: [12, 28],
			hoverRotations: [-11, 11],
			hoverZ: 8,
		},
		3: {
			rotations: [-12, 0, 12],
			xPercents: [10, 22, 34],
			hoverRotations: [-14, 0, 14],
			hoverZ: 8,
		},
	};

	const layout = layouts[cards.length] ?? layouts[3];

	return (
		<div
			className="relative shrink-0 w-24 h-[90px]"
			style={{ perspective: "150px" }}
		>
			{cards.map((id, i) => (
				<div
					key={id}
					className={`absolute w-3/5 shadow-md motion-safe:transition-all motion-safe:ease-out motion-safe:group-hover:shadow-xl ${cards.length === 1 ? "origin-center motion-safe:duration-[350ms]" : "origin-bottom motion-safe:duration-200"}`}
					style={
						{
							left: `${layout.xPercents[i]}%`,
							bottom: "5%",
							transform: `rotate(${layout.rotations[i]}deg)`,
							zIndex: i,
							"--base-rotate": `${layout.rotations[i]}deg`,
							"--hover-rotate": `${layout.hoverRotations[i]}deg`,
							"--hover-z": `${layout.hoverZ}px`,
						} as React.CSSProperties
					}
				>
					<CardImage card={{ id: id as ScryfallId, name: "" }} size="small" />
				</div>
			))}
			<style>{`
				.group:hover [style*="--hover-rotate"] {
					transform: rotate(var(--hover-rotate)) translateZ(var(--hover-z)) !important;
				}
				@media (prefers-reduced-motion: reduce) {
					.group:hover [style*="--hover-rotate"] {
						transform: rotate(var(--base-rotate)) !important;
					}
				}
			`}</style>
		</div>
	);
}
