import { useQuery } from "@tanstack/react-query";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";
import { CardImage } from "../CardImage";

interface CardPreviewPaneProps {
	cardId: ScryfallId;
}

export function CardPreviewPane({ cardId }: CardPreviewPaneProps) {
	const { data } = useQuery(getCardByIdQueryOptions(cardId));

	return (
		<div className="sticky top-8 bg-gray-100 dark:bg-slate-800 rounded-lg p-6 h-[37.5rem] flex items-center justify-center border border-gray-300 dark:border-slate-700">
			<div className="max-w-full max-h-full flex items-center justify-center">
				{cardId && (
					<CardImage
						card={{ id: cardId, name: data?.name ?? "" }}
						size="large"
						className="shadow-[0_0.5rem_1.875rem_rgba(0,0,0,0.4)] dark:shadow-[0_0.5rem_1.875rem_rgba(0,0,0,0.8)] max-w-full h-auto max-h-full object-contain rounded-[4.75%/3.5%]"
					/>
				)}
			</div>
		</div>
	);
}
