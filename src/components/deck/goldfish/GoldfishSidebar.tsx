import { useDroppable } from "@dnd-kit/core";
import { Droplet, Minus, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { CardInstance, PlayerState } from "@/lib/goldfish/types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { GoldfishCard } from "./GoldfishCard";
import { GoldfishPile } from "./GoldfishPile";

interface GoldfishSidebarProps {
	library: CardInstance[];
	graveyard: CardInstance[];
	exile: CardInstance[];
	player: PlayerState;
	cardLookup?: (id: ScryfallId) => Card | undefined;
	onHover?: (instanceId: number | null) => void;
	onClick?: (instanceId: number) => void;
	onDraw: () => void;
	onUntapAll: () => void;
	onMulligan: () => void;
	onReset: () => void;
	onAdjustLife: (amount: number) => void;
	onAdjustPoison: (amount: number) => void;
}

export function GoldfishSidebar({
	library,
	graveyard,
	exile,
	player,
	cardLookup,
	onHover,
	onClick,
	onDraw,
	onUntapAll,
	onMulligan,
	onReset,
	onAdjustLife,
	onAdjustPoison,
}: GoldfishSidebarProps) {
	const { setNodeRef: setLibraryRef, isOver: isOverLibrary } = useDroppable({
		id: "zone-library",
		data: { zone: "library" },
	});

	return (
		<div className="w-48 flex flex-col gap-3 p-2 bg-gray-100 dark:bg-zinc-900 rounded-lg overflow-y-auto overflow-x-hidden">
			{/* Library */}
			<div
				ref={setLibraryRef}
				className={`rounded-lg border-2 border-dashed p-2 transition-colors ${
					isOverLibrary
						? "border-green-500 bg-green-500/10"
						: "border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50"
				}`}
			>
				<div className="flex items-center justify-between mb-2">
					<span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
						Library ({library.length})
					</span>
					<span className="text-xs text-gray-500 dark:text-zinc-300">
						D to draw
					</span>
				</div>
				{library.length > 0 ? (
					<GoldfishCard
						instance={library[0]}
						card={cardLookup?.(library[0].cardId)}
						onHover={onHover}
						onClick={onDraw}
						fromLibrary
					/>
				) : (
					<div className="h-40 aspect-[5/7] rounded-[4.75%/3.5%] border-2 border-dashed border-gray-300 dark:border-zinc-600" />
				)}
			</div>

			{/* Graveyard */}
			<GoldfishPile
				zone="graveyard"
				label="Graveyard"
				cards={graveyard}
				cardLookup={cardLookup}
				onHover={onHover}
				onClick={onClick}
			/>

			{/* Exile */}
			<GoldfishPile
				zone="exile"
				label="Exile"
				cards={exile}
				cardLookup={cardLookup}
				onHover={onHover}
				onClick={onClick}
			/>

			{/* Player Stats */}
			<div className="space-y-2">
				{/* Life */}
				<div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800">
					<button
						type="button"
						onClick={() => onAdjustLife(-1)}
						className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700"
						aria-label="Decrease life"
					>
						<Minus className="w-4 h-4" />
					</button>
					<span className="text-lg font-bold text-gray-700 dark:text-zinc-200">
						{player.life}
					</span>
					<button
						type="button"
						onClick={() => onAdjustLife(1)}
						className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700"
						aria-label="Increase life"
					>
						<Plus className="w-4 h-4" />
					</button>
				</div>

				{/* Poison */}
				<div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800">
					<button
						type="button"
						onClick={() => onAdjustPoison(-1)}
						className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700"
						aria-label="Decrease poison"
					>
						<Minus className="w-4 h-4" />
					</button>
					<span className="flex items-center gap-1 text-lg font-bold text-green-600 dark:text-green-400">
						<Droplet className="w-4 h-4" />
						{player.poison}
					</span>
					<button
						type="button"
						onClick={() => onAdjustPoison(1)}
						className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700"
						aria-label="Increase poison"
					>
						<Plus className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Actions */}
			<div className="space-y-2">
				<button
					type="button"
					onClick={onUntapAll}
					className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
				>
					<RotateCcw className="w-4 h-4" />
					Untap All (U)
				</button>
				<button
					type="button"
					onClick={onMulligan}
					className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-300 dark:hover:bg-zinc-600"
				>
					<RefreshCw className="w-4 h-4" />
					Mulligan
				</button>
				<button
					type="button"
					onClick={onReset}
					className="w-full px-3 py-2 text-sm font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
				>
					Reset Game
				</button>
			</div>

			{/* Keyboard hints */}
			<div className="text-xs text-gray-400 dark:text-zinc-400 space-y-1">
				<p>T/Space: tap • F: flip</p>
				<p>G: graveyard • E: exile</p>
				<p>H: hand • B: play</p>
			</div>
		</div>
	);
}
