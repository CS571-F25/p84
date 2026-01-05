import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCardDataProvider } from "@/lib/card-data-provider";
import { prefetchCards } from "@/lib/card-prefetch";
import type { Deck } from "@/lib/deck-types";
import {
	findAllCanonicalPrintings,
	findAllCheapestPrintings,
	updateDeckPrintings,
} from "@/lib/printing-selection";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DeckActionsMenuProps {
	deck: Deck;
	onUpdateDeck: (updater: (prev: Deck) => Deck) => Promise<void>;
	onCardsChanged?: (changedIds: Set<ScryfallId>) => void;
}

export function DeckActionsMenu({
	deck,
	onUpdateDeck,
	onCardsChanged,
}: DeckActionsMenuProps) {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	const handleSetAllToCheapest = async () => {
		setIsOpen(false);
		const toastId = toast.loading("Finding cheapest printings...");

		try {
			const provider = await getCardDataProvider();
			const updates = await findAllCheapestPrintings(deck, provider);

			if (updates.size > 0) {
				const newIds = [...new Set(updates.values())];
				await prefetchCards(queryClient, newIds);
				await onUpdateDeck((prev) => updateDeckPrintings(prev, updates));
				onCardsChanged?.(new Set(newIds));
				toast.success(`Updated ${updates.size} printing(s)`, { id: toastId });
			} else {
				toast.success("All cards already at cheapest", { id: toastId });
			}
		} catch {
			toast.error("Failed to update printings", { id: toastId });
		}
	};

	const handleSetAllToBest = async () => {
		setIsOpen(false);
		const toastId = toast.loading("Finding best printings...");

		try {
			const provider = await getCardDataProvider();
			const updates = await findAllCanonicalPrintings(deck, provider);

			if (updates.size > 0) {
				const newIds = [...new Set(updates.values())];
				await prefetchCards(queryClient, newIds);
				await onUpdateDeck((prev) => updateDeckPrintings(prev, updates));
				onCardsChanged?.(new Set(newIds));
				toast.success(`Updated ${updates.size} printing(s)`, { id: toastId });
			} else {
				toast.success("All cards already at best", { id: toastId });
			}
		} catch {
			toast.error("Failed to update printings", { id: toastId });
		}
	};

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
				aria-label="Deck actions"
				aria-expanded={isOpen}
			>
				<MoreVertical size={16} />
			</button>

			{isOpen && (
				<div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
					<button
						type="button"
						onClick={handleSetAllToCheapest}
						className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white text-sm"
					>
						Set all to cheapest
					</button>
					<button
						type="button"
						onClick={handleSetAllToBest}
						className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white text-sm"
					>
						Set all to best
					</button>
				</div>
			)}
		</div>
	);
}
