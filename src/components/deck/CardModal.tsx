import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ManaCost } from "@/components/ManaCost";
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
}

export function CardModal({
	card,
	isOpen,
	onClose,
	onUpdateQuantity,
	onUpdateTags,
	onMoveToSection,
	onDelete,
}: CardModalProps) {
	const [quantity, setQuantity] = useState(card.quantity);
	const [tags, setTags] = useState<string[]>(card.tags ?? []);
	const [newTag, setNewTag] = useState("");

	const { data: cardData } = useQuery(getCardByIdQueryOptions(card.scryfallId));

	useEffect(() => {
		setQuantity(card.quantity);
		setTags(card.tags ?? []);
	}, [card]);

	// Close on escape
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const handleQuantityChange = (newQuantity: number) => {
		if (newQuantity >= 1) {
			setQuantity(newQuantity);
			onUpdateQuantity(newQuantity);
		}
	};

	const handleAddTag = () => {
		const trimmed = newTag.trim();
		if (trimmed && !tags.includes(trimmed)) {
			const newTags = [...tags, trimmed];
			setTags(newTags);
			onUpdateTags(newTags);
			setNewTag("");
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
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						onClose();
					}
				}}
				role="button"
				tabIndex={0}
				aria-label="Close modal"
			/>

			{/* Modal */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto border border-gray-300 dark:border-slate-700">
					{/* Header */}
					<div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-800">
						<div className="flex-1 min-w-0">
							{cardData ? (
								<>
									<div className="flex items-baseline gap-2 mb-2 flex-wrap">
										<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
											{cardData.name}
										</h2>
										{cardData.mana_cost && (
											<div className="flex-shrink-0">
												<ManaCost cost={cardData.mana_cost} size="small" />
											</div>
										)}
									</div>
									{cardData.type_line && (
										<div className="text-sm text-gray-600 dark:text-gray-400">
											{cardData.type_line}
										</div>
									)}
								</>
							) : (
								<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
									Loading...
								</h2>
							)}
						</div>
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-4"
						>
							<X className="w-6 h-6" />
						</button>
					</div>

					{/* Body */}
					<div className="p-6 space-y-6">
						{/* Quantity */}
						<div>
							<div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Quantity
							</div>
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => handleQuantityChange(quantity - 1)}
									disabled={quantity <= 1}
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
									className="w-20 px-3 py-2 text-center bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
								/>
								<button
									type="button"
									onClick={() => handleQuantityChange(quantity + 1)}
									className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
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
								className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
							<div className="flex gap-2 mb-2">
								<input
									type="text"
									value={newTag}
									onChange={(e) => setNewTag(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddTag();
										}
									}}
									placeholder="Add tag..."
									className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
								/>
								<button
									type="button"
									onClick={handleAddTag}
									className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
								>
									Add
								</button>
							</div>
							{tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{tags.map((tag) => (
										<button
											key={tag}
											type="button"
											onClick={() => handleRemoveTag(tag)}
											className="group px-3 py-1 bg-cyan-100 dark:bg-cyan-900 hover:bg-cyan-200 dark:hover:bg-cyan-800 text-cyan-800 dark:text-cyan-200 rounded-lg text-sm transition-colors flex items-center gap-1"
										>
											{tag}
											<X className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
							className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
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
