import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { TagAutocomplete } from "@/components/deck/TagAutocomplete";
import { ManaCost } from "@/components/ManaCost";
import { getPrimaryFace } from "@/lib/card-faces";
import type { DeckCard, Section } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";

interface CardModalProps {
	card: DeckCard;
	isOpen: boolean;
	onClose: () => void;
	onUpdateQuantity: (quantity: number) => void;
	onUpdateTags: (tags: string[]) => void;
	onMoveToSection: (section: Section) => void;
	onDelete: () => void;
	readOnly?: boolean;
	allTags?: string[];
}

export function CardModal({
	card,
	isOpen,
	onClose,
	onUpdateQuantity,
	onUpdateTags,
	onMoveToSection,
	onDelete,
	readOnly = false,
	allTags = [],
}: CardModalProps) {
	const [quantity, setQuantity] = useState(card.quantity);
	const [tags, setTags] = useState<string[]>(card.tags ?? []);

	const titleId = useId();

	const { data: cardData } = useQuery(getCardByIdQueryOptions(card.scryfallId));
	const primaryFace = cardData ? getPrimaryFace(cardData) : null;

	// Suggestions: all tags except ones already on this card
	const tagSuggestions = allTags.filter((t) => !tags.includes(t));

	useEffect(() => {
		setQuantity(card.quantity);
		setTags(card.tags ?? []);
	}, [card]);

	// Keyboard shortcuts: Escape to close, 1-9 to set quantity
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}

			// Number keys 1-9 set quantity (only when not typing in an input)
			const isTyping =
				document.activeElement instanceof HTMLInputElement ||
				document.activeElement instanceof HTMLTextAreaElement;
			if (!readOnly && !isTyping) {
				const num = Number.parseInt(e.key, 10);
				if (num >= 1 && num <= 9) {
					setQuantity(num);
					onUpdateQuantity(num);
				}
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [isOpen, onClose, onUpdateQuantity, readOnly]);

	if (!isOpen) return null;

	const handleQuantityChange = (newQuantity: number) => {
		if (newQuantity >= 1) {
			setQuantity(newQuantity);
			onUpdateQuantity(newQuantity);
		}
	};

	const handleAddTag = (tag: string) => {
		if (!tags.includes(tag)) {
			const newTags = [...tags, tag];
			setTags(newTags);
			onUpdateTags(newTags);
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		const newTags = tags.filter((t) => t !== tagToRemove);
		setTags(newTags);
		onUpdateTags(newTags);
	};

	const handleDelete = () => {
		onDelete();
		onClose();
	};

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Modal */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto border border-gray-300 dark:border-slate-700"
				>
					{/* Header */}
					<div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-800">
						<div className="flex-1 min-w-0">
							{primaryFace ? (
								<>
									<div className="flex items-baseline gap-2 mb-2 flex-wrap">
										<h2
											id={titleId}
											className="text-2xl font-bold text-gray-900 dark:text-white"
										>
											{primaryFace.name}
										</h2>
										{primaryFace.mana_cost && (
											<div className="flex-shrink-0">
												<ManaCost cost={primaryFace.mana_cost} size="small" />
											</div>
										)}
									</div>
									{primaryFace.type_line && (
										<div className="text-sm text-gray-600 dark:text-gray-400">
											{primaryFace.type_line}
										</div>
									)}
								</>
							) : (
								<h2
									id={titleId}
									className="text-2xl font-bold text-gray-900 dark:text-white"
								>
									Loading...
								</h2>
							)}
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-4"
						>
							<X className="w-6 h-6" />
						</button>
					</div>

					{/* Body */}
					<div className="p-6 space-y-6">
						{/* Card image - only shown on mobile where sidebar preview is hidden */}
						{cardData && (
							<div className="md:hidden flex justify-center">
								<div className="w-48">
									<CardImage
										card={cardData}
										size="normal"
										className="w-full h-auto shadow-lg rounded-[4.75%/3.5%]"
									/>
								</div>
							</div>
						)}

						{/* Quantity */}
						<div>
							<div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Quantity
							</div>
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => handleQuantityChange(quantity - 1)}
									disabled={readOnly || quantity <= 1}
									className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<Minus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
								</button>
								<input
									type="number"
									min="1"
									value={quantity}
									onChange={(e) =>
										handleQuantityChange(
											Number.parseInt(e.target.value, 10) || 1,
										)
									}
									disabled={readOnly}
									className="w-20 px-3 py-2 text-center bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
								/>
								<button
									type="button"
									onClick={() => handleQuantityChange(quantity + 1)}
									disabled={readOnly}
									className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<Plus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
								</button>
							</div>
						</div>

						{/* Section */}
						<div>
							<div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Section
							</div>
							<select
								value={card.section}
								onChange={(e) => onMoveToSection(e.target.value as Section)}
								disabled={readOnly}
								className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<option value="commander">Commander</option>
								<option value="mainboard">Mainboard</option>
								<option value="sideboard">Sideboard</option>
								<option value="maybeboard">Maybeboard</option>
							</select>
						</div>

						{/* Tags */}
						<div>
							<div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Tags
							</div>
							<div className="mb-2">
								<TagAutocomplete
									suggestions={tagSuggestions}
									onAdd={handleAddTag}
									disabled={readOnly}
								/>
							</div>
							{tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{tags.map((tag) => (
										<button
											key={tag}
											type="button"
											onClick={() => !readOnly && handleRemoveTag(tag)}
											disabled={readOnly}
											className="group px-3 py-1 bg-cyan-100 dark:bg-cyan-900 hover:bg-cyan-200 dark:hover:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed text-cyan-800 dark:text-cyan-200 rounded-lg text-sm transition-colors flex items-center gap-1"
										>
											{tag}
											{!readOnly && (
												<X className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
											)}
										</button>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Footer */}
					<div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-800">
						<button
							type="button"
							onClick={handleDelete}
							disabled={readOnly}
							className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
						>
							<Trash2 className="w-4 h-4" />
							Delete
						</button>
						<button
							type="button"
							onClick={onClose}
							className="px-6 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
