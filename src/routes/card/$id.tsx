import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CardImage, CardPreview } from "@/components/CardImage";
import { ManaCost } from "@/components/ManaCost";
import { OracleText } from "@/components/OracleText";
import { getCardWithPrintingsQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";
import { isScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/card/$id")({
	loader: async ({ context, params }) => {
		// Validate ID format
		if (!isScryfallId(params.id)) {
			return null;
		}

		// Prefetch card data during SSR
		const queryOptions = getCardWithPrintingsQueryOptions(params.id);
		await context.queryClient.ensureQueryData(queryOptions);
	},
	component: CardDetailPage,
});

function CardDetailPage() {
	const { id } = Route.useParams();

	const isValidId = isScryfallId(id);
	const { data, isLoading } = useQuery(
		getCardWithPrintingsQueryOptions(isValidId ? id : ("" as ScryfallId)),
	);

	if (!isValidId) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-red-600 dark:text-red-400 text-lg">
					Invalid card ID format
				</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900">
				<div className="max-w-7xl mx-auto px-6 py-8">
					<div className="flex items-center justify-center py-20">
						<p className="text-gray-600 dark:text-gray-400 text-lg">
							Loading card...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-red-600 dark:text-red-400 text-lg">Card not found</p>
			</div>
		);
	}

	const { card, otherPrintings } = data;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div className="flex justify-center lg:justify-end">
						<CardImage
							card={card}
							size="large"
							className="shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] max-w-full h-auto max-h-[80vh] object-contain"
						/>
					</div>

					<div className="space-y-6">
						<div>
							<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
								{card.name}
							</h1>
							{card.mana_cost && (
								<div className="mb-2">
									<ManaCost cost={card.mana_cost} size="large" />
								</div>
							)}
							{card.type_line && (
								<p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
									{card.type_line}
								</p>
							)}
						</div>

						{card.oracle_text && (
							<div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4 border border-gray-300 dark:border-slate-700">
								<p className="text-gray-900 dark:text-gray-200">
									<OracleText text={card.oracle_text} />
								</p>
							</div>
						)}

						{(card.power || card.toughness || card.loyalty) && (
							<div className="flex gap-4 text-gray-700 dark:text-gray-300">
								{card.power && card.toughness && (
									<div>
										<span className="text-gray-600 dark:text-gray-400">
											P/T:
										</span>{" "}
										<span className="font-semibold">
											{card.power}/{card.toughness}
										</span>
									</div>
								)}
								{card.loyalty && (
									<div>
										<span className="text-gray-600 dark:text-gray-400">
											Loyalty:
										</span>{" "}
										<span className="font-semibold">{card.loyalty}</span>
									</div>
								)}
							</div>
						)}

						<div className="grid grid-cols-2 gap-4 text-sm">
							{card.set_name && (
								<div>
									<p className="text-gray-600 dark:text-gray-400">Set</p>
									<p className="text-gray-900 dark:text-white">
										{card.set_name} ({card.set?.toUpperCase()})
									</p>
								</div>
							)}
							{card.rarity && (
								<div>
									<p className="text-gray-600 dark:text-gray-400">Rarity</p>
									<p className="text-gray-900 dark:text-white capitalize">
										{card.rarity}
									</p>
								</div>
							)}
							{card.artist && (
								<div>
									<p className="text-gray-600 dark:text-gray-400">Artist</p>
									<p className="text-gray-900 dark:text-white">{card.artist}</p>
								</div>
							)}
							{card.collector_number && (
								<div>
									<p className="text-gray-600 dark:text-gray-400">
										Collector Number
									</p>
									<p className="text-gray-900 dark:text-white">
										{card.collector_number}
									</p>
								</div>
							)}
						</div>

						{otherPrintings && otherPrintings.length > 0 && (
							<div>
								<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
									Other Printings ({otherPrintings.length})
								</h2>
								<div className="grid grid-cols-4 md:grid-cols-6 gap-2">
									{otherPrintings.slice(0, 12).map((printing) => (
										<CardPreview
											key={printing.id}
											cardId={printing.id}
											name={printing.name}
											setName={printing.set_name}
											href={`/card/${printing.id}`}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
