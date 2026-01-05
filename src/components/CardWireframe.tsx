/**
 * Card wireframe - text-based card placeholder
 *
 * Renders card data as styled text matching card layout.
 * Useful for loading states before images arrive.
 *
 * TODO: Could add "art" mode (with art_crop) and "dense" mode (compact text-only)
 * if needed in the future.
 */

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import {
	canFlip,
	getAllFaces,
	getFlipBehavior,
	hasBackImage,
} from "@/lib/card-faces";
import type { Card, CardFace, Rarity } from "@/lib/scryfall-types";
import { ManaCost } from "./ManaCost";
import { OracleText } from "./OracleText";
import { SetSymbol } from "./SetSymbol";

// Layout constants for card proportions (container query units)
const LAYOUT = {
	artHeight: "h-[47%]",
	titlePadding: "px-[5.5cqw] pt-[4cqw] pb-[0.75cqw]",
	titleText: "text-[5.5cqw]",
	typePadding: "pl-[6cqw] pr-[5cqw] pt-[1.5cqw] pb-[0cqw]",
	typeText: "text-[4.5cqw]",
	oracleText: "text-[4cqw]",
	oraclePadding: "px-[5.5cqw] py-[1.5cqw]",
	footerPadding: "px-[3cqw] pt-[0.5cqw] pb-[1.5cqw]",
	footerText: "text-[3cqw]",
	manaSize: "w-[4cqw] h-[4cqw]",
	manaSmall: "w-[3.5cqw] h-[3.5cqw]",
	setSymbol: "text-[7cqw]",
	ptText: "text-[6cqw]",
	ptPadding: "px-[2.5cqw] py-[0.75cqw]",
	ptPosition: "bottom-[6.5cqw] right-[8cqw]",
} as const;

interface CardWireframeProps {
	card: Card;
	className?: string;
}

type ColorIdentity = "W" | "U" | "B" | "R" | "G";

// MTG-authentic frame colors (muted, earthy tones)
const FRAME_COLORS: Record<
	ColorIdentity | "multicolor" | "colorless" | "land",
	{ frame: string; titleBg: string; titleText: string }
> = {
	W: {
		frame: "bg-[#f8f4e8] dark:bg-[#3d3a33]",
		titleBg: "bg-gradient-to-r from-[#f5f0dc] to-[#e8e0c8]",
		titleText: "text-[#2a261e]",
	},
	U: {
		frame: "bg-[#0e68ab] dark:bg-[#0a3d5c]",
		titleBg: "bg-gradient-to-r from-[#1a7dc4] to-[#0d5a94]",
		titleText: "text-white",
	},
	B: {
		frame: "bg-[#3d3a4a] dark:bg-[#1a1820]",
		titleBg: "bg-gradient-to-r from-[#4a4558] to-[#2d2a38]",
		titleText: "text-[#c8c4d0]",
	},
	R: {
		frame: "bg-[#d04030] dark:bg-[#6b2018]",
		titleBg: "bg-gradient-to-r from-[#e85040] to-[#c03828]",
		titleText: "text-white",
	},
	G: {
		frame: "bg-[#2d6b4a] dark:bg-[#1a3d2a]",
		titleBg: "bg-gradient-to-r from-[#3a8060] to-[#285840]",
		titleText: "text-white",
	},
	multicolor: {
		frame: "bg-[#c9a858] dark:bg-[#6b5828]",
		titleBg: "bg-gradient-to-r from-[#dab868] to-[#b89840]",
		titleText: "text-[#2a2618]",
	},
	colorless: {
		frame: "bg-[#a8a8a8] dark:bg-[#4a4a4a]",
		titleBg: "bg-gradient-to-r from-[#c0c0c0] to-[#989898]",
		titleText: "text-[#2a2a2a]",
	},
	land: {
		frame: "bg-[#b89858] dark:bg-[#5c4828]",
		titleBg: "bg-gradient-to-r from-[#c8a868] to-[#a08040]",
		titleText: "text-[#2a2618]",
	},
};

function getFrameColor(
	card: Card,
): (typeof FRAME_COLORS)[keyof typeof FRAME_COLORS] {
	const colors = card.colors ?? card.color_identity ?? [];
	const isLand = card.type_line?.includes("Land") && colors.length === 0;

	if (isLand) return FRAME_COLORS.land;
	if (colors.length === 0) return FRAME_COLORS.colorless;
	if (colors.length > 1) return FRAME_COLORS.multicolor;
	return FRAME_COLORS[colors[0] as ColorIdentity] ?? FRAME_COLORS.colorless;
}

interface FaceContentProps {
	face: CardFace;
	showStats?: boolean;
	setCode?: string;
	rarity?: Rarity;
}

function FaceContent({
	face,
	showStats = true,
	setCode,
	rarity,
}: FaceContentProps) {
	const hasPT = face.power !== undefined && face.toughness !== undefined;
	const hasLoyalty = face.loyalty !== undefined;
	const hasDefense = face.defense !== undefined;
	const hasStats = showStats && (hasPT || hasLoyalty || hasDefense);
	const isPlaneswalker = face.type_line?.includes("Planeswalker");

	return (
		<div className="relative flex flex-col h-full">
			{/* Type Line */}
			{face.type_line && (
				<div
					className={`flex items-center justify-between ${LAYOUT.typePadding} ${LAYOUT.typeText} tracking-tight text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700`}
				>
					<span className="truncate">{face.type_line}</span>
					{setCode && rarity && (
						<SetSymbol
							setCode={setCode}
							rarity={SET_SYMBOL_RARITY[rarity]}
							className={`${LAYOUT.setSymbol} shrink-0`}
						/>
					)}
				</div>
			)}

			{/* Oracle Text - centered for short text */}
			<div
				className={`flex-1 grid place-content-center ${LAYOUT.oraclePadding} ${LAYOUT.oracleText} leading-snug tracking-tight text-gray-800 dark:text-gray-200 overflow-hidden`}
			>
				{face.oracle_text ? (
					isPlaneswalker ? (
						<PlaneswalkerAbilities text={face.oracle_text} />
					) : (
						<div>
							<OracleText text={face.oracle_text} symbolSize="text" />
						</div>
					)
				) : (
					<span className="text-gray-400 dark:text-gray-500 italic">
						No text
					</span>
				)}
			</div>

			{/* Stats (P/T, Loyalty, Defense) - absolute positioned to overlap footer */}
			{hasStats && (
				<div className="absolute bottom-0 right-[3cqw] translate-y-1/2">
					<span
						className={`${LAYOUT.ptText} font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 ${LAYOUT.ptPadding} rounded-sm border border-gray-400 dark:border-slate-500`}
					>
						{hasPT && `${face.power}/${face.toughness}`}
						{hasLoyalty && face.loyalty}
						{hasDefense && face.defense}
					</span>
				</div>
			)}
		</div>
	);
}

function PlaneswalkerAbilities({ text }: { text: string }) {
	const lines = text.split("\n");

	return (
		<div className="flex flex-col gap-[1.5cqw]">
			{lines.map((line) => {
				// Match loyalty costs: +N, -N, −N, 0, -X, −X, etc.
				const loyaltyMatch = line.match(/^([+−-]?(?:\d+|X)):\s*(.*)$/);
				if (loyaltyMatch) {
					const [, cost, ability] = loyaltyMatch;
					// Determine badge color based on cost type (muted colors)
					const isPositive = cost.startsWith("+");
					const isNegative = cost.startsWith("-") || cost.startsWith("−");
					const badgeColor = isPositive
						? "bg-emerald-700/80 dark:bg-emerald-800/80 text-white"
						: isNegative
							? "bg-rose-700/80 dark:bg-rose-800/80 text-white"
							: "bg-gray-500/80 dark:bg-slate-600/80 text-white";
					return (
						<div key={line} className="flex gap-[1.5cqw] items-start">
							<span
								className={`text-[3.5cqw] font-bold px-[1.5cqw] py-[0.25cqw] rounded shrink-0 ${badgeColor}`}
							>
								{cost}
							</span>
							<span className="text-[4cqw]">
								<OracleText text={ability} symbolSize="text" />
							</span>
						</div>
					);
				}
				return (
					<span key={line} className="text-[4cqw]">
						<OracleText text={line} symbolSize="text" />
					</span>
				);
			})}
		</div>
	);
}

function isAftermathCard(card: Card): boolean {
	const faces = getAllFaces(card);
	return (
		card.layout === "split" &&
		faces.length > 1 &&
		(faces[1].oracle_text?.includes("Aftermath") ?? false)
	);
}

const SET_SYMBOL_RARITY: Record<
	Rarity,
	"common" | "uncommon" | "rare" | "mythic" | "timeshifted"
> = {
	common: "common",
	uncommon: "uncommon",
	rare: "rare",
	mythic: "mythic",
	special: "timeshifted",
	bonus: "mythic",
};

const RARITY_LETTER: Record<Rarity, string> = {
	common: "C",
	uncommon: "U",
	rare: "R",
	mythic: "M",
	special: "S",
	bonus: "B",
};

function CardFooter({ card }: { card: Card }) {
	const collectorNum = card.collector_number?.padStart(4, "0");
	const setCode = card.set?.toUpperCase();
	const rarityLetter = RARITY_LETTER[card.rarity ?? "common"];

	return (
		<div
			className={`flex flex-col ${LAYOUT.footerPadding} ${LAYOUT.footerText} tracking-tight text-white bg-black`}
		>
			{/* Top row: rarity collector set•lang */}
			<span>
				{rarityLetter} {collectorNum} {setCode}•EN
			</span>
			{/* Bottom row: brush icon + artist */}
			{card.artist && (
				<div className="flex items-center gap-[0.5cqw]">
					<span>✎</span>
					<span className="truncate">{card.artist}</span>
				</div>
			)}
		</div>
	);
}

export function CardWireframe({ card, className }: CardWireframeProps) {
	const [isFlipped, setIsFlipped] = useState(false);

	const faces = getAllFaces(card);
	const isMultiFaced = faces.length > 1;
	const flippable = canFlip(card);
	const flipBehavior = getFlipBehavior(card.layout);
	const hasBack = hasBackImage(card.layout);
	const isAdventure = card.layout === "adventure";
	const isAftermath = isAftermathCard(card);
	const isFlipCard = card.layout === "flip";
	const isSplit = card.layout === "split" && !isAftermath;

	const rarity = card.rarity || "common";

	const handleFlip = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsFlipped(!isFlipped);
	};

	// Flip cards (Kamigawa style): title → text → type line, art in middle
	if (isFlipCard && isMultiFaced) {
		const topFace = isFlipped ? faces[1] : faces[0];
		const bottomFace = isFlipped ? faces[0] : faces[1];
		const frameColor = getFrameColor(card);

		return (
			<div className="relative group">
				<div
					className={`@container aspect-[5/7] border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col motion-safe:transition-transform motion-safe:duration-500`}
					style={{
						transform: isFlipped ? "rotate(180deg)" : "rotate(0deg)",
					}}
				>
					{/* Top half: Title → Text → Type+P/T */}
					<div className="h-[42%] flex flex-col">
						{/* Title bar */}
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[0.5cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[5cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{topFace.name}
							</span>
							{topFace.mana_cost && (
								<ManaCost
									cost={topFace.mana_cost}
									className={LAYOUT.manaSize}
								/>
							)}
						</div>
						{/* Text box */}
						<div className="flex-1 px-[2cqw] py-[1cqw] text-[3.5cqw] leading-tight text-gray-800 dark:text-gray-200 overflow-hidden">
							{topFace.oracle_text && (
								<OracleText text={topFace.oracle_text} symbolSize="text" />
							)}
						</div>
						{/* Type line + P/T */}
						<div className="flex items-center justify-between px-[2cqw] py-[0.5cqw] bg-gray-100/80 dark:bg-slate-800/80 border-t border-gray-300 dark:border-slate-600">
							<div className="flex items-center gap-[1cqw] min-w-0">
								<span className="text-[3cqw] text-gray-700 dark:text-gray-300 truncate">
									{topFace.type_line}
								</span>
								{card.set && (
									<SetSymbol
										setCode={card.set}
										rarity={SET_SYMBOL_RARITY[rarity]}
										className="text-[4cqw] shrink-0"
									/>
								)}
							</div>
							{(topFace.power || topFace.toughness) && (
								<span className="font-bold text-[5cqw] text-gray-900 dark:text-white shrink-0">
									{topFace.power}/{topFace.toughness}
								</span>
							)}
						</div>
					</div>

					{/* Art area in the middle */}
					<div className="h-[14%] bg-gray-300/50 dark:bg-slate-700/50 border-y-2 border-gray-400 dark:border-slate-500" />

					{/* Bottom half (flipped face, shown upside down) */}
					<div className="h-[36%] flex flex-col rotate-180">
						{/* Title bar */}
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[0.5cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[5cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{bottomFace.name}
							</span>
						</div>
						{/* Text box */}
						<div className="flex-1 px-[2cqw] py-[1cqw] text-[3.5cqw] leading-tight text-gray-800 dark:text-gray-200 overflow-hidden">
							{bottomFace.oracle_text && (
								<OracleText text={bottomFace.oracle_text} symbolSize="text" />
							)}
						</div>
						{/* Type line */}
						<div className="flex items-center justify-between px-[2cqw] py-[0.5cqw] bg-gray-100/80 dark:bg-slate-800/80 border-t border-gray-300 dark:border-slate-600">
							<span className="text-[3cqw] text-gray-700 dark:text-gray-300 truncate">
								{bottomFace.type_line}
							</span>
							{(bottomFace.power || bottomFace.toughness) && (
								<span className="font-bold text-[5cqw] text-gray-900 dark:text-white">
									{bottomFace.power}/{bottomFace.toughness}
								</span>
							)}
						</div>
					</div>

					{/* Footer */}
					<CardFooter card={card} />
				</div>

				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-[0.5cqw] rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-all z-10"
						aria-label="Flip card"
					>
						<RotateCcw className="w-[2cqw] h-[2cqw]" />
					</button>
				)}
			</div>
		);
	}

	// Split cards (fuse style): stacked vertically
	if (isSplit && isMultiFaced) {
		const frameColor = getFrameColor(card);

		return (
			<div
				className={`@container aspect-[5/7] border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
			>
				{/* Top half */}
				<div className="h-1/2 flex flex-col border-b border-gray-300 dark:border-slate-600">
					<div
						className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[0.75cqw] ${frameColor.titleBg}`}
					>
						<span
							className={`font-bold text-[5cqw] tracking-tight truncate ${frameColor.titleText}`}
						>
							{faces[0].name}
						</span>
						{faces[0].mana_cost && (
							<ManaCost
								cost={faces[0].mana_cost}
								className="w-[4.5cqw] h-[4.5cqw]"
							/>
						)}
					</div>
					<div className="flex-1 overflow-hidden">
						<FaceContent
							face={faces[0]}
							showStats={false}
							setCode={card.set}
							rarity={rarity}
						/>
					</div>
				</div>

				{/* Bottom half */}
				<div className="h-1/2 flex flex-col">
					<div
						className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[0.75cqw] ${frameColor.titleBg}`}
					>
						<span
							className={`font-bold text-[5cqw] tracking-tight truncate ${frameColor.titleText}`}
						>
							{faces[1].name}
						</span>
						{faces[1].mana_cost && (
							<ManaCost
								cost={faces[1].mana_cost}
								className="w-[4.5cqw] h-[4.5cqw]"
							/>
						)}
					</div>
					<div className="flex-1 overflow-hidden">
						<FaceContent
							face={faces[1]}
							showStats={false}
							setCode={card.set}
							rarity={rarity}
						/>
					</div>
				</div>

				<CardFooter card={card} />
			</div>
		);
	}

	// Aftermath cards: top half normal, bottom half rotated 90°
	if (isAftermath && isMultiFaced) {
		const frameColor = getFrameColor(card);

		return (
			<div
				className={`@container aspect-[5/7] border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
			>
				{/* Top half - main spell */}
				<div className="h-[60%] flex flex-col border-b-2 border-gray-300 dark:border-slate-600">
					<div
						className={`flex items-center justify-between gap-[1cqw] ${LAYOUT.titlePadding} ${frameColor.titleBg}`}
					>
						<span
							className={`font-bold ${LAYOUT.titleText} tracking-tight truncate ${frameColor.titleText}`}
						>
							{faces[0].name}
						</span>
						{faces[0].mana_cost && (
							<ManaCost cost={faces[0].mana_cost} className={LAYOUT.manaSize} />
						)}
					</div>
					<div className="flex-1 overflow-hidden">
						<FaceContent
							face={faces[0]}
							showStats={false}
							setCode={card.set}
							rarity={rarity}
						/>
					</div>
				</div>

				{/* Bottom half - aftermath (shown sideways) */}
				<div className="h-[40%] flex flex-col bg-gray-100/50 dark:bg-slate-800/50">
					<div
						className={`flex items-center gap-[1cqw] px-[2cqw] py-[1cqw] ${frameColor.titleBg} border-b border-gray-300 dark:border-slate-600`}
					>
						<span className="text-[3.5cqw] text-gray-500 dark:text-gray-400 italic">
							Aftermath
						</span>
						<span
							className={`font-bold text-[5cqw] tracking-tight truncate ${frameColor.titleText}`}
						>
							{faces[1].name}
						</span>
						{faces[1].mana_cost && (
							<ManaCost cost={faces[1].mana_cost} className={LAYOUT.manaSize} />
						)}
					</div>
					<div className="flex-1 px-[3cqw] py-[1cqw] text-[4cqw] leading-tight tracking-tight text-gray-800 dark:text-gray-200 overflow-hidden">
						{faces[1].oracle_text && (
							<OracleText text={faces[1].oracle_text} symbolSize="text" />
						)}
					</div>
				</div>
			</div>
		);
	}

	// Adventure cards: main creature with adventure box in text area
	if (isAdventure && isMultiFaced) {
		const mainFace = faces[0];
		const adventureFace = faces[1];
		const frameColor = getFrameColor(card);

		return (
			<div
				className={`@container relative aspect-[5/7] border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
			>
				{/* Title bar */}
				<div
					className={`flex items-center justify-between gap-[1cqw] ${LAYOUT.titlePadding} ${frameColor.titleBg}`}
				>
					<span
						className={`font-bold ${LAYOUT.titleText} tracking-tight truncate ${frameColor.titleText}`}
					>
						{mainFace.name}
					</span>
					{mainFace.mana_cost && (
						<ManaCost cost={mainFace.mana_cost} className={LAYOUT.manaSize} />
					)}
				</div>

				{/* Art placeholder */}
				<div
					className={`${LAYOUT.artHeight} bg-gray-300/50 dark:bg-slate-700/50`}
				/>

				{/* Type line */}
				<div
					className={`flex items-center justify-between ${LAYOUT.typePadding} ${LAYOUT.typeText} tracking-tight text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700`}
				>
					<span className="truncate">{mainFace.type_line}</span>
					{card.set && (
						<SetSymbol
							setCode={card.set}
							rarity={SET_SYMBOL_RARITY[rarity]}
							className={`${LAYOUT.setSymbol} shrink-0`}
						/>
					)}
				</div>

				{/* Text box with adventure on left, creature text on right */}
				<div className="flex-1 flex gap-[1cqw] px-[2cqw] py-[1.5cqw] overflow-hidden">
					{/* Adventure box */}
					<div className="w-[50%] bg-gray-100 dark:bg-slate-800 rounded border-2 border-gray-400 dark:border-slate-500 px-[1.5cqw] py-[1cqw] flex flex-col overflow-hidden">
						<div className="flex items-center justify-between gap-[0.5cqw] shrink-0">
							<span className="font-bold text-[3.5cqw] text-gray-900 dark:text-white truncate">
								{adventureFace.name}
							</span>
							{adventureFace.mana_cost && (
								<ManaCost
									cost={adventureFace.mana_cost}
									className="w-[3cqw] h-[3cqw] shrink-0"
								/>
							)}
						</div>
						<div className="text-[2.5cqw] text-gray-600 dark:text-gray-400 truncate shrink-0">
							{adventureFace.type_line}
						</div>
						{adventureFace.oracle_text && (
							<div className="flex-1 text-[2.5cqw] leading-snug text-gray-800 dark:text-gray-200 overflow-hidden mt-[0.5cqw]">
								<OracleText
									text={adventureFace.oracle_text}
									symbolSize="text"
								/>
							</div>
						)}
					</div>

					{/* Creature text */}
					<div className="flex-1 flex flex-col justify-center overflow-hidden">
						{mainFace.oracle_text && (
							<div className="text-[3.5cqw] leading-snug text-gray-800 dark:text-gray-200 overflow-hidden">
								<OracleText text={mainFace.oracle_text} symbolSize="text" />
							</div>
						)}
					</div>
				</div>

				<CardFooter card={card} />

				{/* P/T box */}
				{(mainFace.power || mainFace.toughness) && (
					<div className={`absolute ${LAYOUT.ptPosition}`}>
						<span
							className={`${LAYOUT.ptText} font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 ${LAYOUT.ptPadding} rounded-sm border border-gray-400 dark:border-slate-500`}
						>
							{mainFace.power}/{mainFace.toughness}
						</span>
					</div>
				)}
			</div>
		);
	}

	// Transform/MDFC: 3D flip between faces
	if (flipBehavior === "transform" && hasBack && isMultiFaced) {
		const frameColor = getFrameColor(card);
		const isMdfc = card.layout === "modal_dfc";
		const backFace = faces[1];

		return (
			<div className={`relative group ${className ?? ""}`}>
				<div
					className="relative w-full aspect-[5/7] motion-safe:transition-transform motion-safe:duration-500"
					style={{
						transformStyle: "preserve-3d",
						transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					{/* Front */}
					<div
						className={`@container absolute inset-0 border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} flex flex-col`}
						style={{ backfaceVisibility: "hidden" }}
					>
						<div
							className={`flex items-center justify-between gap-[1cqw] ${LAYOUT.titlePadding} ${frameColor.titleBg}`}
						>
							<div className="flex items-center gap-[2cqw] min-w-0">
								<span className="text-[4cqw] leading-none text-gray-600 dark:text-gray-300 border border-gray-500 dark:border-gray-400 rounded-full w-[5cqw] h-[5cqw] flex items-center justify-center shrink-0">
									▲
								</span>
								<span
									className={`font-bold ${LAYOUT.titleText} tracking-tight truncate ${frameColor.titleText}`}
								>
									{faces[0].name}
								</span>
							</div>
							{faces[0].mana_cost && (
								<ManaCost
									cost={faces[0].mana_cost}
									className={LAYOUT.manaSize}
								/>
							)}
						</div>
						<div
							className={`${LAYOUT.artHeight} bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center`}
						/>
						<div className="flex-1 flex flex-col overflow-hidden relative">
							<FaceContent
								face={faces[0]}
								setCode={card.set}
								rarity={rarity}
								showStats={false}
							/>
							{/* Transform back face P/T hint */}
							{!isMdfc && backFace && backFace.power !== undefined && (
								<span className="absolute bottom-[8cqw] right-[4cqw] text-[4.5cqw] text-gray-400 dark:text-gray-500">
									{backFace.power}/{backFace.toughness}
								</span>
							)}
						</div>
						{/* MDFC back face hint */}
						{isMdfc && backFace && (
							<div className="flex items-center gap-[1.5cqw] px-[3cqw] py-[1cqw] text-[3.5cqw] bg-gray-200/80 dark:bg-slate-700/80 border-t border-gray-300 dark:border-slate-600 overflow-hidden">
								<span className="text-[3cqw] leading-none text-gray-600 dark:text-gray-300 border border-gray-500 dark:border-gray-400 rounded-full w-[4cqw] h-[4cqw] flex items-center justify-center shrink-0">
									▼
								</span>
								<span className="font-medium text-gray-700 dark:text-gray-300 shrink-0">
									{backFace.type_line?.split("—")[0]?.trim()}
								</span>
								{backFace.oracle_text && (
									<>
										<span className="text-gray-500 dark:text-gray-400 shrink-0">
											·
										</span>
										<span className="truncate text-gray-700 dark:text-gray-300">
											<OracleText
												text={
													backFace.oracle_text
														.split("\n")
														.find((l) => l.includes("{T}:")) ||
													backFace.oracle_text.split("\n")[0]
												}
												symbolSize="text"
											/>
										</span>
									</>
								)}
							</div>
						)}
						<CardFooter card={card} />
						{/* P/T for front face */}
						{(faces[0].power !== undefined ||
							faces[0].loyalty !== undefined ||
							faces[0].defense !== undefined) && (
							<div className={`absolute ${LAYOUT.ptPosition}`}>
								<span
									className={`${LAYOUT.ptText} font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 ${LAYOUT.ptPadding} rounded-sm border border-gray-400 dark:border-slate-500`}
								>
									{faces[0].power !== undefined &&
										`${faces[0].power}/${faces[0].toughness}`}
									{faces[0].loyalty}
									{faces[0].defense}
								</span>
							</div>
						)}
					</div>

					{/* Back */}
					<div
						className={`@container absolute inset-0 border-[0.8cqw] border-black rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} flex flex-col`}
						style={{
							backfaceVisibility: "hidden",
							transform: "rotateY(180deg)",
						}}
					>
						<div
							className={`flex items-center justify-between gap-[1cqw] ${LAYOUT.titlePadding} ${frameColor.titleBg}`}
						>
							<div className="flex items-center gap-[2cqw] min-w-0">
								<span className="text-[4cqw] leading-none text-gray-600 dark:text-gray-300 border border-gray-500 dark:border-gray-400 rounded-full w-[5cqw] h-[5cqw] flex items-center justify-center shrink-0">
									▼
								</span>
								<span
									className={`font-bold ${LAYOUT.titleText} tracking-tight truncate ${frameColor.titleText}`}
								>
									{faces[1]?.name}
								</span>
							</div>
							{faces[1]?.mana_cost && (
								<ManaCost
									cost={faces[1].mana_cost}
									className={LAYOUT.manaSize}
								/>
							)}
						</div>
						<div
							className={`${LAYOUT.artHeight} bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center`}
						/>
						<div className="flex-1 flex flex-col overflow-hidden">
							<FaceContent
								face={faces[1] || faces[0]}
								setCode={card.set}
								rarity={rarity}
								showStats={false}
							/>
						</div>
						{/* MDFC front face hint */}
						{isMdfc && (
							<div className="flex items-center gap-[1.5cqw] px-[3cqw] py-[1cqw] text-[3.5cqw] bg-gray-200/80 dark:bg-slate-700/80 border-t border-gray-300 dark:border-slate-600">
								<span className="text-[5cqw] leading-none text-gray-600 dark:text-gray-300">
									◢
								</span>
								<span className="font-medium text-gray-700 dark:text-gray-300">
									{faces[0].type_line?.split("—")[0]?.trim()}
								</span>
								{faces[0].mana_cost && (
									<>
										<span className="text-gray-500 dark:text-gray-400">·</span>
										<ManaCost
											cost={faces[0].mana_cost}
											className="w-[3.5cqw] h-[3.5cqw]"
										/>
									</>
								)}
							</div>
						)}
						<CardFooter card={card} />
						{/* P/T for back face */}
						{faces[1] &&
							(faces[1].power !== undefined ||
								faces[1].loyalty !== undefined ||
								faces[1].defense !== undefined) && (
								<div className={`absolute ${LAYOUT.ptPosition}`}>
									<span
										className={`${LAYOUT.ptText} font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 ${LAYOUT.ptPadding} rounded-sm border border-gray-400 dark:border-slate-500`}
									>
										{faces[1].power !== undefined &&
											`${faces[1].power}/${faces[1].toughness}`}
										{faces[1].loyalty}
										{faces[1].defense}
									</span>
								</div>
							)}
					</div>
				</div>

				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className="absolute top-[15%] right-[8%] p-2 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10"
						aria-label="Transform card"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
			</div>
		);
	}

	// Default: single-faced card
	const frameColor = getFrameColor(card);
	const face = faces[0];
	const hasPT = face.power !== undefined && face.toughness !== undefined;
	const hasLoyalty = face.loyalty !== undefined;
	const hasDefense = face.defense !== undefined;

	return (
		<div className={`@container aspect-[5/7] ${className ?? ""}`}>
			<div className="relative w-full h-full bg-black rounded-[4.75%/3.5%] p-[1.2cqw]">
				<div
					className={`h-full ${frameColor.frame} rounded-[3%/2%] overflow-hidden flex flex-col`}
				>
					{/* Title bar */}
					<div
						className={`flex items-center justify-between gap-[1cqw] ${LAYOUT.titlePadding} ${frameColor.titleBg}`}
					>
						<span
							className={`font-bold ${LAYOUT.titleText} tracking-tight truncate ${frameColor.titleText}`}
						>
							{face.name}
						</span>
						{face.mana_cost && (
							<ManaCost cost={face.mana_cost} className={LAYOUT.manaSize} />
						)}
					</div>

					{/* Art placeholder */}
					<div
						className={`${LAYOUT.artHeight} bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center`}
					/>

					{/* Card body */}
					<div className="flex-1 flex flex-col overflow-hidden">
						<FaceContent
							face={face}
							setCode={card.set}
							rarity={rarity}
							showStats={false}
						/>
					</div>

					<CardFooter card={card} />

					{/* P/T / Loyalty / Defense - positioned at bottom-right corner */}
					{(hasPT || hasLoyalty || hasDefense) && (
						<div className={`absolute ${LAYOUT.ptPosition}`}>
							<span
								className={`${LAYOUT.ptText} font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 ${LAYOUT.ptPadding} rounded-sm border border-gray-400 dark:border-slate-500`}
							>
								{hasPT && `${face.power}/${face.toughness}`}
								{hasLoyalty && face.loyalty}
								{hasDefense && face.defense}
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
