/**
 * Debug route for screenshotting a single card wireframe.
 * Used by the screenshot comparison script.
 *
 * Usage: /components/card-wireframe/[scryfall-id]
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { CardWireframe } from "@/components/CardWireframe";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { isScryfallId, type ScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/components/wireframe/$id")({
	ssr: false,
	component: SingleWireframeDebug,
});

function SingleWireframeDebug() {
	const { id } = Route.useParams();
	const isValidId = isScryfallId(id);

	const {
		data: card,
		isLoading,
		error,
	} = useQuery(getCardByIdQueryOptions(isValidId ? id : ("" as ScryfallId)));

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-500 flex items-center justify-center p-8">
				<Loader2 className="w-8 h-8 animate-spin text-white" />
			</div>
		);
	}

	if (error || !card) {
		return (
			<div className="min-h-screen bg-gray-500 flex items-center justify-center p-8">
				<div className="text-white text-center">
					<p className="text-xl font-bold">Card not found</p>
					<p className="text-sm opacity-75">{id}</p>
				</div>
			</div>
		);
	}

	// Render wireframe at a fixed size on neutral background for screenshotting
	return (
		<div
			className="min-h-screen bg-gray-500 flex items-center justify-center p-8"
			data-card-loaded="true"
		>
			<div data-wireframe-target className="w-[250px]">
				<CardWireframe card={card} />
			</div>
		</div>
	);
}
