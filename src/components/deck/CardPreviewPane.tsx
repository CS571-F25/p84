import type { ScryfallId } from "@/lib/scryfall-types";
import { CardImage } from "../CardImage";

interface CardPreviewPaneProps {
	cardId: ScryfallId | null;
}

export function CardPreviewPane({ cardId }: CardPreviewPaneProps) {
	if (!cardId) {
		return (
			<div className="sticky top-8 bg-gray-100 dark:bg-slate-800 rounded-lg p-6 h-[37.5rem] flex items-center justify-center border border-gray-300 dark:border-slate-700">
				<p className="text-gray-500 dark:text-gray-400 text-center">
					Hover over a card to preview it here
				</p>
			</div>
		);
	}

	// For now, just show placeholder until we integrate with card data
	return (
		<div className="sticky top-8 bg-gray-100 dark:bg-slate-800 rounded-lg p-6 h-[37.5rem] flex items-center justify-center border border-gray-300 dark:border-slate-700">
			<div className="max-w-full max-h-full flex items-center justify-center">
				<CardImage
					card={{ id: cardId, name: "Card" } as any}
					size="large"
					className="shadow-[0_0.5rem_1.875rem_rgba(0,0,0,0.4)] dark:shadow-[0_0.5rem_1.875rem_rgba(0,0,0,0.8)] max-w-full h-auto max-h-full object-contain rounded-[4.75%/3.5%]"
				/>
			</div>
		</div>
	);
}
