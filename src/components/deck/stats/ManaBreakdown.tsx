import { CardSymbol } from "@/components/CardSymbol";
import type { ManaSymbolsData, SourceTempo } from "@/lib/deck-stats";
import type { ManaColorWithColorless } from "@/lib/scryfall-types";
import type { StatsSelection } from "@/lib/stats-selection";

interface ManaBreakdownProps {
	data: ManaSymbolsData[];
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

const COLOR_ORDER: ManaColorWithColorless[] = ["W", "U", "B", "R", "G", "C"];

const COLOR_NAMES: Record<ManaColorWithColorless, string> = {
	W: "White",
	U: "Blue",
	B: "Black",
	R: "Red",
	G: "Green",
	C: "Colorless",
};

export function ManaBreakdown({
	data,
	selection,
	onSelect,
}: ManaBreakdownProps) {
	const byColor = new Map(data.map((d) => [d.color, d]));

	const activeColors = COLOR_ORDER.filter((c) => {
		const d = byColor.get(c);
		return d && (d.symbolCount > 0 || d.sourceCount > 0);
	});

	if (activeColors.length === 0) {
		return null;
	}

	const totalImmediate = data.reduce((s, d) => s + d.immediateSourceCount, 0);
	const totalSources = data.reduce((s, d) => s + d.sourceCount, 0);
	const totalSymbols = data.reduce((s, d) => s + d.symbolCount, 0);
	const immediatePercent =
		totalSources > 0 ? Math.round((totalImmediate / totalSources) * 100) : 0;

	const isSelected = (
		color: ManaColorWithColorless,
		type: "symbol" | SourceTempo,
	) =>
		selection?.chart === "mana" &&
		selection.color === color &&
		selection.type === type;

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700 col-span-full xl:col-span-2">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
				Mana Breakdown
			</h3>
			<div
				className="grid gap-4"
				style={{
					gridTemplateColumns: `repeat(${activeColors.length}, minmax(0, 1fr))`,
				}}
			>
				{activeColors.map((color) => {
					const d = byColor.get(color);
					if (!d) return null;
					return (
						<ManaColumn
							key={color}
							data={d}
							colorName={COLOR_NAMES[color]}
							totalSymbols={totalSymbols}
							totalSources={totalSources}
							isSelected={(type) => isSelected(color, type)}
							onSelect={(type) => onSelect({ chart: "mana", color, type })}
						/>
					);
				})}
			</div>
			<div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
				<div className="flex gap-3 text-xs">
					<span
						className="flex items-center gap-1 cursor-help"
						title="Untapped lands, fast mana rocks, shocklands (pay life = your choice)"
					>
						<span className="w-2 h-2 rounded-full bg-emerald-500" />
						<span className="text-gray-600 dark:text-gray-400">Immediate</span>
					</span>
					<span
						className="flex items-center gap-1 cursor-help"
						title="Check lands, fast lands, battle lands - may enter tapped based on game state"
					>
						<span className="w-2 h-2 rounded-full bg-sky-500" />
						<span className="text-gray-600 dark:text-gray-400">
							Conditional
						</span>
					</span>
					<span
						className="flex items-center gap-1 cursor-help"
						title="Tap lands, mana dorks (summoning sickness)"
					>
						<span className="w-2 h-2 rounded-full bg-rose-500" />
						<span className="text-gray-600 dark:text-gray-400">Delayed</span>
					</span>
					<span
						className="flex items-center gap-1 cursor-help"
						title="Bouncelands - enter tapped and return a land"
					>
						<span className="w-2 h-2 rounded-full bg-violet-500" />
						<span className="text-gray-600 dark:text-gray-400">Bounce</span>
					</span>
				</div>
				{totalSources > 0 && (
					<div
						className="text-xs text-gray-600 dark:text-gray-400 cursor-help"
						title={`${totalImmediate} of ${totalSources} sources can produce mana the turn they enter`}
					>
						{immediatePercent}% of sources produce mana immediately
					</div>
				)}
			</div>
		</div>
	);
}

interface ManaColumnProps {
	data: ManaSymbolsData;
	colorName: string;
	totalSymbols: number;
	totalSources: number;
	isSelected: (type: "symbol" | SourceTempo) => boolean;
	onSelect: (type: "symbol" | SourceTempo) => void;
}

function ManaColumn({
	data,
	colorName,
	totalSymbols,
	totalSources,
	isSelected,
	onSelect,
}: ManaColumnProps) {
	const sourceCount = data.sourceCount;
	const immediatePercent =
		sourceCount > 0 ? (data.immediateSourceCount / sourceCount) * 100 : 0;
	const conditionalPercent =
		sourceCount > 0 ? (data.conditionalSourceCount / sourceCount) * 100 : 0;
	const delayedPercent =
		sourceCount > 0 ? (data.delayedSourceCount / sourceCount) * 100 : 0;
	const bouncePercent =
		sourceCount > 0 ? (data.bounceSourceCount / sourceCount) * 100 : 0;

	const hasSymbols = data.symbolCount > 0;
	const greyedOut = !hasSymbols;

	return (
		<div
			className={`flex flex-col items-center gap-1 ${greyedOut ? "opacity-40" : ""}`}
		>
			<button
				type="button"
				onClick={() => onSelect("symbol")}
				disabled={!hasSymbols}
				title={
					hasSymbols
						? `${data.symbolCount} ${colorName.toLowerCase()} pips in card costs`
						: `No ${colorName.toLowerCase()} pips in deck`
				}
				className={`p-1 rounded transition-all ${
					isSelected("symbol")
						? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30"
						: hasSymbols
							? "hover:bg-gray-100 dark:hover:bg-slate-800"
							: "cursor-default"
				}`}
			>
				<div className="rounded-full ring-1 ring-black/20 dark:ring-transparent">
					<CardSymbol symbol={data.color} size="large" />
				</div>
			</button>

			<div
				className="text-lg font-semibold text-gray-900 dark:text-white cursor-help"
				title={
					totalSymbols > 0
						? `${data.symbolCount} of ${totalSymbols} total pips are ${colorName.toLowerCase()}`
						: "No pips in deck"
				}
			>
				{Math.round(data.symbolPercent)}%
			</div>
			<div
				className="text-xs text-gray-500 dark:text-gray-400 cursor-help"
				title={`${data.symbolCount} ${colorName.toLowerCase()} mana symbols in card costs`}
			>
				{data.symbolCount} pips
			</div>

			<Sparkline distribution={data.symbolDistribution} color={data.color} />

			{sourceCount > 0 && (
				<div className="w-full mt-2">
					<div
						className="flex h-3 rounded-md overflow-hidden bg-gray-200 dark:bg-slate-700 cursor-help"
						title={`${sourceCount} sources produce ${colorName.toLowerCase()} mana (${Math.round((sourceCount / totalSources) * 100)}% of all sources)`}
					>
						{data.immediateSourceCount > 0 && (
							<button
								type="button"
								className={`bg-emerald-500 transition-opacity ${
									isSelected("immediate")
										? "opacity-100"
										: "opacity-80 hover:opacity-100"
								}`}
								style={{ width: `${immediatePercent}%` }}
								title={`Immediate: ${data.immediateSourceCount} of ${sourceCount} ${colorName.toLowerCase()} sources (${Math.round(immediatePercent)}%)\nCan produce mana the turn they enter`}
								onClick={() => onSelect("immediate")}
							/>
						)}
						{data.conditionalSourceCount > 0 && (
							<button
								type="button"
								className={`bg-sky-500 transition-opacity ${
									isSelected("conditional")
										? "opacity-100"
										: "opacity-80 hover:opacity-100"
								}`}
								style={{ width: `${conditionalPercent}%` }}
								title={`Conditional: ${data.conditionalSourceCount} of ${sourceCount} ${colorName.toLowerCase()} sources (${Math.round(conditionalPercent)}%)\nMay enter tapped depending on game state`}
								onClick={() => onSelect("conditional")}
							/>
						)}
						{data.delayedSourceCount > 0 && (
							<button
								type="button"
								className={`bg-rose-500 transition-opacity ${
									isSelected("delayed")
										? "opacity-100"
										: "opacity-80 hover:opacity-100"
								}`}
								style={{ width: `${delayedPercent}%` }}
								title={`Delayed: ${data.delayedSourceCount} of ${sourceCount} ${colorName.toLowerCase()} sources (${Math.round(delayedPercent)}%)\nEnter tapped or have summoning sickness`}
								onClick={() => onSelect("delayed")}
							/>
						)}
						{data.bounceSourceCount > 0 && (
							<button
								type="button"
								className={`bg-violet-500 transition-opacity ${
									isSelected("bounce")
										? "opacity-100"
										: "opacity-80 hover:opacity-100"
								}`}
								style={{ width: `${bouncePercent}%` }}
								title={`Bounce: ${data.bounceSourceCount} of ${sourceCount} ${colorName.toLowerCase()} sources (${Math.round(bouncePercent)}%)\nEnter tapped and return a land`}
								onClick={() => onSelect("bounce")}
							/>
						)}
					</div>
					<div
						className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 cursor-help"
						title={`${sourceCount} cards produce ${colorName.toLowerCase()} mana`}
					>
						{sourceCount} sources
					</div>
				</div>
			)}
		</div>
	);
}

function Sparkline({
	distribution,
	color,
}: {
	distribution: { bucket: string; count: number }[];
	color: ManaColorWithColorless;
}) {
	const maxCount = Math.max(...distribution.map((d) => d.count), 1);
	const total = distribution.reduce((s, d) => s + d.count, 0);

	const barColor = {
		W: "bg-amber-200",
		U: "bg-blue-400",
		B: "bg-gray-600",
		R: "bg-red-400",
		G: "bg-green-400",
		C: "bg-gray-400",
	}[color];

	return (
		<div className="flex items-end h-6 w-full">
			{distribution.map((d, i) => (
				<div
					key={d.bucket}
					className={`flex-1 ${barColor} rounded-t-sm cursor-help ${i < distribution.length - 1 ? "border-r-2 border-black/30 dark:border-black/50" : ""}`}
					style={{
						height: `${(d.count / maxCount) * 100}%`,
						minHeight: d.count > 0 ? "2px" : "0",
					}}
					title={`MV ${d.bucket}: ${d.count} pips${total > 0 ? ` (${Math.round((d.count / total) * 100)}%)` : ""}`}
				/>
			))}
		</div>
	);
}
