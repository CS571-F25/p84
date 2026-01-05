/**
 * Live overlay comparison for wireframe alignment.
 * Shows scan with wireframe overlaid at adjustable opacity.
 *
 * Usage: /components/wireframe-compare/[scryfall-id]
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CardWireframe } from "@/components/CardWireframe";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { isScryfallId, type ScryfallId } from "@/lib/scryfall-types";
import { getImageUri } from "@/lib/scryfall-utils";

export const Route = createFileRoute("/components/wireframe-compare/$id")({
	ssr: false,
	component: WireframeCompare,
});

function WireframeCompare() {
	const { id } = Route.useParams();
	const isValidId = isScryfallId(id);
	const [opacity, setOpacity] = useState(0.5);
	const [showWireframe, setShowWireframe] = useState(true);
	const [showScan, setShowScan] = useState(true);

	const {
		data: card,
		isLoading,
		error,
	} = useQuery(getCardByIdQueryOptions(isValidId ? id : ("" as ScryfallId)));

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-800 flex items-center justify-center p-8">
				<Loader2 className="w-8 h-8 animate-spin text-white" />
			</div>
		);
	}

	if (error || !card) {
		return (
			<div className="min-h-screen bg-gray-800 flex items-center justify-center p-8">
				<div className="text-white text-center">
					<p className="text-xl font-bold">Card not found</p>
					<p className="text-sm opacity-75">{id}</p>
				</div>
			</div>
		);
	}

	const scanUrl = getImageUri(card.id, "large");

	return (
		<div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-8 gap-6">
			<div className="flex gap-4 items-center text-white">
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={showScan}
						onChange={(e) => setShowScan(e.target.checked)}
					/>
					Scan
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={showWireframe}
						onChange={(e) => setShowWireframe(e.target.checked)}
					/>
					Wireframe
				</label>
				<label className="flex items-center gap-2">
					Opacity:
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={opacity}
						onChange={(e) => setOpacity(Number(e.target.value))}
						className="w-32"
					/>
					{Math.round(opacity * 100)}%
				</label>
			</div>

			<div className="relative w-[488px] aspect-[488/680]">
				{showScan && (
					<img
						src={scanUrl}
						alt={card.name}
						className="absolute inset-0 w-full h-full rounded-[4.75%/3.5%]"
					/>
				)}
				{showWireframe && (
					<div
						className="absolute inset-0"
						style={{ opacity: showScan ? opacity : 1 }}
					>
						<CardWireframe card={card} className="w-full h-full" />
					</div>
				)}
			</div>

			<p className="text-gray-400 text-sm">
				{card.name} ({id})
			</p>
		</div>
	);
}
