import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { searchCardsQueryOptions } from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { useDebounce } from "@/lib/useDebounce";
import { ManaCost } from "../ManaCost";
import { toast } from "sonner";

interface CardSearchAutocompleteProps {
	format?: string;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardSelect?: (cardId: ScryfallId) => void;
}

export function CardSearchAutocomplete({
	format,
	onCardHover,
	onCardSelect,
}: CardSearchAutocompleteProps) {
	const [inputValue, setInputValue] = useState("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const prevSearchRef = useRef("");
	const resultRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

	const queryClient = useQueryClient();
	const debouncedSearch = useDebounce(inputValue, 300);

	const { data, isFetching } = useQuery(
		searchCardsQueryOptions(debouncedSearch),
	);

	const filteredCards =
		format && data
			? data.cards.filter((card) => {
					const legality = card.legalities?.[format];
					return legality === "legal" || legality === "restricted";
				})
			: (data?.cards ?? []);

	const displayCards = filteredCards.slice(0, 20);
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
		toast.success(`added ${card.name}`);
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
			.fetchQuery(searchCardsQueryOptions(searchTerm))
			.then((result) => {
				const topCard = result.cards[0];
				if (topCard) {
					onCardSelect?.(topCard.id);
					onCardHover?.(topCard.id);
					toast.success(`added ${topCard.name}`, { id: toastId });
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
		<div className="relative">
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
				className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
			/>

			{isFetching && debouncedSearch.trim().length > 0 && (
				<div className="absolute right-3 top-1/2 -translate-y-1/2">
					<div className="w-5 h-5 border-2 border-gray-300 dark:border-slate-600 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
				</div>
			)}

			{showDropdown && (
				<div
					ref={dropdownRef}
					onMouseLeave={handleMouseLeaveDropdown}
					role="listbox"
					className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg shadow-lg max-h-96 overflow-y-auto"
				>
					{hasResults ? (
						<div className="py-1">
							{displayCards.map((card, index) => (
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
											? "bg-blue-100 dark:bg-blue-900/30"
											: "hover:bg-gray-100 dark:hover:bg-slate-800"
									}`}
								>
									<div className="flex items-center justify-between gap-2">
										<div className="font-medium text-sm text-gray-900 dark:text-white truncate">
											{card.name}
										</div>
										{card.mana_cost && (
											<div className="flex-shrink-0">
												<ManaCost cost={card.mana_cost} size="small" />
											</div>
										)}
									</div>
								</button>
							))}
						</div>
					) : (
						<div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
							No results found
						</div>
					)}
				</div>
			)}
		</div>
	);
}
