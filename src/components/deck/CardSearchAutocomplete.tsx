import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getPrimaryFace } from "@/lib/card-faces";
import { type Deck, getCommanderColorIdentity } from "@/lib/deck-types";
import {
	getCardByIdQueryOptions,
	searchCardsQueryOptions,
} from "@/lib/queries";
import type {
	Card,
	ScryfallId,
	SearchRestrictions,
} from "@/lib/scryfall-types";
import { useDebounce } from "@/lib/useDebounce";
import { usePersistedState } from "@/lib/usePersistedState";
import { ManaCost } from "../ManaCost";

interface CardSearchAutocompleteProps {
	deck?: Deck;
	format?: string;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardSelect?: (cardId: ScryfallId) => void;
}

export function CardSearchAutocomplete({
	deck,
	format,
	onCardHover,
	onCardSelect,
}: CardSearchAutocompleteProps) {
	const [inputValue, setInputValue] = useState("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [legalityFilterEnabled, setLegalityFilterEnabled] = usePersistedState(
		"deckbelcher:searchLegalityFilter",
		true,
	);

	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const prevSearchRef = useRef("");
	const resultRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

	const queryClient = useQueryClient();
	const { value: debouncedSearch } = useDebounce(inputValue, 300);
	const toggleId = useId();

	// Calculate search restrictions
	const restrictions: SearchRestrictions | undefined = useMemo(() => {
		if (!legalityFilterEnabled || !format) return undefined;

		const hasCommanderColorIdentity =
			format === "commander" || format === "paupercommander";

		const colorIdentity =
			hasCommanderColorIdentity && deck
				? getCommanderColorIdentity(deck, (id) =>
						queryClient.getQueryData(getCardByIdQueryOptions(id).queryKey),
					)
				: undefined;

		return {
			format,
			colorIdentity,
		};
	}, [legalityFilterEnabled, format, deck, queryClient]);

	const { data, isFetching } = useQuery(
		searchCardsQueryOptions(debouncedSearch, restrictions, 20),
	);

	const displayCards = data?.cards ?? [];
	const hasResults = displayCards.length > 0;
	const showDropdown =
		isDropdownOpen && debouncedSearch.trim().length > 0 && !isFetching && data;

	// Auto-preview top result when search changes and results load
	if (
		debouncedSearch !== prevSearchRef.current &&
		displayCards.length > 0 &&
		debouncedSearch.trim().length > 0
	) {
		prevSearchRef.current = debouncedSearch;
		onCardHover?.(displayCards[0].id);
	}

	useEffect(() => {
		setIsDropdownOpen(inputValue.trim().length > 0);
		setSelectedIndex(0);
	}, [inputValue]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				!inputRef.current?.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Scroll selected item into view
	useEffect(() => {
		const selectedElement = resultRefs.current.get(selectedIndex);
		if (selectedElement) {
			selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [selectedIndex]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	};

	const handleCardSelect = (card: Card) => {
		onCardSelect?.(card.id);
		onCardHover?.(card.id);
		setInputValue("");
		setIsDropdownOpen(false);
		setSelectedIndex(0);
		inputRef.current?.focus();
	};

	const handleEnter = () => {
		if (debouncedSearch === inputValue) {
			if (displayCards[selectedIndex]) {
				handleCardSelect(displayCards[selectedIndex]);
			} else {
				toast.error(`no card found for "${debouncedSearch}"`);
			}
			return;
		}

		const searchTerm = inputValue;
		setInputValue("");
		setIsDropdownOpen(false);
		setSelectedIndex(0);

		const toastId = toast.loading(`searching for "${searchTerm}"...`);

		queryClient
			.fetchQuery(searchCardsQueryOptions(searchTerm, restrictions, 1))
			.then((result) => {
				const topCard = result.cards[0];
				if (topCard) {
					onCardSelect?.(topCard.id);
					onCardHover?.(topCard.id);
					toast.dismiss(toastId);
				} else {
					toast.error(`no card found for "${searchTerm}"`, { id: toastId });
				}
			})
			.catch(() => {
				toast.error("search failed", { id: toastId });
			});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		switch (e.key) {
			case "Enter":
				e.preventDefault();
				if (inputValue.trim().length > 0) {
					handleEnter();
				}
				break;
			case "Escape":
				e.preventDefault();
				setIsDropdownOpen(false);
				break;
			case "ArrowDown":
				if (!showDropdown || !hasResults) return;
				e.preventDefault();
				setSelectedIndex((prev) => {
					const newIndex = prev < displayCards.length - 1 ? prev + 1 : prev;
					if (displayCards[newIndex]) {
						onCardHover?.(displayCards[newIndex].id);
					}
					return newIndex;
				});
				break;
			case "ArrowUp":
				if (!showDropdown || !hasResults) return;
				e.preventDefault();
				setSelectedIndex((prev) => {
					const newIndex = prev > 0 ? prev - 1 : prev;
					if (displayCards[newIndex]) {
						onCardHover?.(displayCards[newIndex].id);
					}
					return newIndex;
				});
				break;
		}
	};

	const handleMouseEnterCard = (card: Card) => {
		onCardHover?.(card.id);
	};

	const handleMouseLeaveDropdown = () => {
		onCardHover?.(null);
	};

	return (
		<div className="flex gap-3 items-center">
			{/* Legality filter toggle */}
			{format && (
				<div className="flex items-center gap-2 flex-shrink-0">
					<label
						htmlFor={toggleId}
						className="text-sm text-gray-700 dark:text-zinc-300 whitespace-nowrap"
					>
						Legal only
					</label>
					<button
						id={toggleId}
						type="button"
						role="switch"
						aria-checked={legalityFilterEnabled}
						onClick={() => setLegalityFilterEnabled(!legalityFilterEnabled)}
						className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
							legalityFilterEnabled
								? "bg-cyan-600"
								: "bg-gray-300 dark:bg-zinc-600"
						}`}
					>
						<span
							className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
								legalityFilterEnabled ? "translate-x-6" : "translate-x-1"
							}`}
						/>
					</button>
				</div>
			)}

			<div className="relative flex-1">
				<input
					ref={inputRef}
					type="text"
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onFocus={() => {
						if (inputValue.trim().length > 0) {
							setIsDropdownOpen(true);
						}
					}}
					placeholder="Search for a card..."
					className="w-full px-4 py-2 pr-10 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
				/>

				{isFetching && debouncedSearch.trim().length > 0 && (
					<div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
						<div className="w-5 h-5 border-2 border-gray-300 dark:border-zinc-600 border-t-cyan-500 dark:border-t-cyan-400 rounded-full animate-spin" />
					</div>
				)}

				{showDropdown && (
					<div
						ref={dropdownRef}
						onMouseLeave={handleMouseLeaveDropdown}
						role="listbox"
						className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg max-h-96 overflow-y-auto top-full"
					>
						{hasResults ? (
							<div className="py-1">
								{displayCards.map((card, index) => {
									const face = getPrimaryFace(card);
									return (
										<button
											type="button"
											key={card.id}
											ref={(el) => {
												if (el) {
													resultRefs.current.set(index, el);
												} else {
													resultRefs.current.delete(index);
												}
											}}
											onMouseEnter={() => {
												handleMouseEnterCard(card);
												setSelectedIndex(index);
											}}
											onClick={() => handleCardSelect(card)}
											className={`w-full px-3 py-1.5 text-left cursor-pointer transition-colors ${
												index === selectedIndex
													? "bg-cyan-100 dark:bg-cyan-900/50"
													: "hover:bg-gray-100 dark:hover:bg-zinc-800"
											}`}
										>
											<div className="flex items-center justify-between gap-2">
												<div className="font-medium text-sm text-gray-900 dark:text-white truncate">
													{face.name}
												</div>
												{face.mana_cost && (
													<div className="flex-shrink-0">
														<ManaCost cost={face.mana_cost} size="small" />
													</div>
												)}
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<div className="px-4 py-8 text-center text-gray-500 dark:text-zinc-300">
								No results found
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
