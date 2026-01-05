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

interface CardWireframeProps {
	card: Card;
	className?: string;
}

type ColorIdentity = "W" | "U" | "B" | "R" | "G";

const FRAME_COLORS: Record<
	ColorIdentity | "multicolor" | "colorless" | "land",
	{ border: string; frame: string; titleBg: string; titleText: string }
> = {
	W: {
		border: "border-amber-200 dark:border-amber-300",
		frame: "bg-amber-50 dark:bg-amber-950",
		titleBg: "bg-amber-100 dark:bg-amber-900",
		titleText: "text-amber-950 dark:text-amber-100",
	},
	U: {
		border: "border-blue-400 dark:border-blue-500",
		frame: "bg-blue-50 dark:bg-blue-950",
		titleBg: "bg-blue-200 dark:bg-blue-900",
		titleText: "text-blue-950 dark:text-blue-100",
	},
	B: {
		border: "border-gray-600 dark:border-gray-400",
		frame: "bg-gray-100 dark:bg-gray-900",
		titleBg: "bg-gray-300 dark:bg-gray-800",
		titleText: "text-gray-950 dark:text-gray-100",
	},
	R: {
		border: "border-red-400 dark:border-red-500",
		frame: "bg-red-50 dark:bg-red-950",
		titleBg: "bg-red-200 dark:bg-red-900",
		titleText: "text-red-950 dark:text-red-100",
	},
	G: {
		border: "border-green-500 dark:border-green-600",
		frame: "bg-green-50 dark:bg-green-950",
		titleBg: "bg-green-200 dark:bg-green-900",
		titleText: "text-green-950 dark:text-green-100",
	},
	multicolor: {
		border: "border-amber-400 dark:border-amber-500",
		frame: "bg-amber-50 dark:bg-amber-950",
		titleBg:
			"bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 dark:from-amber-800 dark:via-amber-700 dark:to-amber-800",
		titleText: "text-amber-950 dark:text-amber-100",
	},
	colorless: {
		border: "border-gray-400 dark:border-gray-500",
		frame: "bg-gray-100 dark:bg-slate-900",
		titleBg: "bg-gray-200 dark:bg-slate-800",
		titleText: "text-gray-900 dark:text-gray-100",
	},
	land: {
		border: "border-amber-600 dark:border-amber-700",
		frame: "bg-amber-100 dark:bg-amber-950",
		titleBg: "bg-amber-200 dark:bg-amber-900",
		titleText: "text-amber-950 dark:text-amber-100",
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
		<div className="flex flex-col h-full">
			{/* Type Line */}
			{face.type_line && (
				<div className="flex items-center justify-between px-[4cqw] py-[1.5cqw] text-[5cqw] tracking-tight text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700">
					<span className="truncate">{face.type_line}</span>
					{setCode && rarity && (
						<SetSymbol
							setCode={setCode}
							rarity={SET_SYMBOL_RARITY[rarity]}
							className="text-[7cqw] shrink-0"
						/>
					)}
				</div>
			)}

			{/* Oracle Text */}
			<div className="flex-1 px-[4cqw] py-[2cqw] text-[4.5cqw] leading-snug tracking-tight text-gray-800 dark:text-gray-200 overflow-hidden">
				{face.oracle_text ? (
					isPlaneswalker ? (
						<PlaneswalkerAbilities text={face.oracle_text} />
					) : (
						<OracleText text={face.oracle_text} />
					)
				) : (
					<span className="text-gray-400 dark:text-gray-500 italic">
						No text
					</span>
				)}
			</div>

			{/* Stats (P/T, Loyalty, Defense) */}
			{hasStats && (
				<div className="flex justify-end px-[2cqw] py-[1cqw]">
					<span className="text-[6cqw] font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-600 px-[2cqw] py-[0.5cqw] rounded">
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
				const loyaltyMatch = line.match(/^([+−-]?\d+):\s*(.*)$/);
				if (loyaltyMatch) {
					const [, cost, ability] = loyaltyMatch;
					return (
						<div key={line} className="flex gap-[1.5cqw] items-start">
							<span className="text-[4cqw] font-bold bg-gray-300 dark:bg-slate-600 px-[1.5cqw] rounded shrink-0">
								{cost}
							</span>
							<span className="text-[4cqw]">
								<OracleText text={ability} />
							</span>
						</div>
					);
				}
				return (
					<span key={line} className="text-[4cqw]">
						<OracleText text={line} />
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

function CardFooter({ card }: { card: Card }) {
	const collectorNum = card.collector_number;
	const setCode = card.set;

	return (
		<div className="flex items-center justify-between px-[3cqw] py-[1.5cqw] text-[3.5cqw] tracking-tight text-gray-600 dark:text-gray-400 border-t border-gray-300 dark:border-slate-600 bg-gray-50/80 dark:bg-slate-800/80">
			<div className="flex items-center gap-[1.5cqw]">
				<span>{setCode?.toUpperCase()}</span>
				{collectorNum && <span>#{collectorNum}</span>}
			</div>
			{card.artist && <span className="truncate italic">{card.artist}</span>}
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

	// Flip cards (Kamigawa style): show both faces, one upside down
	if (isFlipCard && isMultiFaced) {
		const topFace = isFlipped ? faces[1] : faces[0];
		const bottomFace = isFlipped ? faces[0] : faces[1];
		const frameColor = getFrameColor(card);

		return (
			<div className="relative group">
				<div
					className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col motion-safe:transition-transform motion-safe:duration-500`}
					style={{
						transform: isFlipped ? "rotate(180deg)" : "rotate(0deg)",
					}}
				>
					{/* Top half (current face) */}
					<div className="h-1/2 flex flex-col border-b-2 border-gray-300 dark:border-slate-600">
						{/* Title bar */}
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{topFace.name}
							</span>
							{topFace.mana_cost && (
								<ManaCost
									cost={topFace.mana_cost}
									className="w-[5cqw] h-[5cqw]"
								/>
							)}
						</div>
						<div className="flex-1 overflow-hidden">
							<FaceContent face={topFace} setCode={card.set} rarity={rarity} />
						</div>
					</div>

					{/* Bottom half (flipped face, shown upside down) */}
					<div className="h-1/2 flex flex-col rotate-180">
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{bottomFace.name}
							</span>
							{bottomFace.mana_cost && (
								<ManaCost
									cost={bottomFace.mana_cost}
									className="w-[5cqw] h-[5cqw]"
								/>
							)}
						</div>
						<div className="flex-1 overflow-hidden">
							<FaceContent
								face={bottomFace}
								showStats={false}
								setCode={card.set}
								rarity={rarity}
							/>
						</div>
					</div>
				</div>

				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-[2cqw] rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10"
						aria-label="Flip card"
					>
						<RotateCcw className="w-[4cqw] h-[4cqw]" />
					</button>
				)}
			</div>
		);
	}

	// Split cards (fuse style): both halves side by side, rotated
	if (isSplit && isMultiFaced) {
		const rotateScale = 5 / 7;
		const frameColor = getFrameColor(card);

		return (
			<div className="relative group">
				<div
					className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-row motion-safe:transition-transform motion-safe:duration-500`}
					style={{
						transformOrigin: "center center",
						transform: isFlipped
							? `rotate(90deg) scale(${rotateScale})`
							: "rotate(0deg)",
					}}
				>
					{/* Left half */}
					<div className="w-1/2 flex flex-col border-r border-gray-300 dark:border-slate-600">
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[5.5cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{faces[0].name}
							</span>
							{faces[0].mana_cost && (
								<ManaCost
									cost={faces[0].mana_cost}
									className="w-[5cqw] h-[5cqw]"
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

					{/* Right half */}
					<div className="w-1/2 flex flex-col">
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[2cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[5.5cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{faces[1].name}
							</span>
							{faces[1].mana_cost && (
								<ManaCost
									cost={faces[1].mana_cost}
									className="w-[5cqw] h-[5cqw]"
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
						<CardFooter card={card} />
					</div>
				</div>

				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10"
						aria-label="Rotate card"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
			</div>
		);
	}

	// Aftermath cards: top half normal, bottom half rotated 90°
	if (isAftermath && isMultiFaced) {
		const frameColor = getFrameColor(card);

		return (
			<div
				className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
			>
				{/* Top half - main spell */}
				<div className="h-[60%] flex flex-col border-b-2 border-gray-300 dark:border-slate-600">
					<div
						className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
					>
						<span
							className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
						>
							{faces[0].name}
						</span>
						{faces[0].mana_cost && (
							<ManaCost
								cost={faces[0].mana_cost}
								className="w-[5cqw] h-[5cqw]"
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
							<ManaCost
								cost={faces[1].mana_cost}
								className="w-[4cqw] h-[4cqw]"
							/>
						)}
					</div>
					<div className="flex-1 px-[3cqw] py-[1cqw] text-[4cqw] leading-tight tracking-tight text-gray-800 dark:text-gray-200 overflow-hidden">
						{faces[1].oracle_text && <OracleText text={faces[1].oracle_text} />}
					</div>
				</div>
			</div>
		);
	}

	// Adventure cards: main creature with adventure box
	if (isAdventure && isMultiFaced) {
		const mainFace = faces[0];
		const adventureFace = faces[1];
		const frameColor = getFrameColor(card);

		return (
			<div
				className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
			>
				{/* Title bar */}
				<div
					className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
				>
					<span
						className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
					>
						{mainFace.name}
					</span>
					{mainFace.mana_cost && (
						<ManaCost cost={mainFace.mana_cost} className="w-[5cqw] h-[5cqw]" />
					)}
				</div>

				{/* Art placeholder with adventure box */}
				<div className="h-[35%] bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center relative">
					{/* Adventure spell box */}
					<div className="absolute bottom-[2cqw] left-[2cqw] right-[40%] bg-gray-50/95 dark:bg-slate-800/95 rounded border border-gray-300 dark:border-slate-600 p-[1.5cqw]">
						<div className="flex items-center justify-between gap-[1cqw] mb-[0.5cqw]">
							<span className="font-bold text-[4cqw] tracking-tight text-gray-900 dark:text-white truncate">
								{adventureFace.name}
							</span>
							{adventureFace.mana_cost && (
								<ManaCost
									cost={adventureFace.mana_cost}
									className="w-[4cqw] h-[4cqw]"
								/>
							)}
						</div>
						<div className="text-[3.5cqw] text-gray-600 dark:text-gray-400 truncate">
							{adventureFace.type_line}
						</div>
						{adventureFace.oracle_text && (
							<div className="text-[3.5cqw] leading-tight tracking-tight text-gray-800 dark:text-gray-200 line-clamp-2">
								<OracleText text={adventureFace.oracle_text} />
							</div>
						)}
					</div>
				</div>

				{/* Main card body */}
				<div className="flex-1 flex flex-col overflow-hidden">
					<FaceContent face={mainFace} setCode={card.set} rarity={rarity} />
				</div>

				<CardFooter card={card} />
			</div>
		);
	}

	// Transform/MDFC: 3D flip between faces
	if (flipBehavior === "transform" && hasBack && isMultiFaced) {
		const frameColor = getFrameColor(card);

		return (
			<div className="relative group">
				<div
					className="w-full motion-safe:transition-transform motion-safe:duration-500"
					style={{
						transformStyle: "preserve-3d",
						transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					{/* Front */}
					<div
						className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} flex flex-col`}
						style={{ backfaceVisibility: "hidden" }}
					>
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{faces[0].name}
							</span>
							{faces[0].mana_cost && (
								<ManaCost
									cost={faces[0].mana_cost}
									className="w-[5cqw] h-[5cqw]"
								/>
							)}
						</div>
						<div className="h-[35%] bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center" />
						<div className="flex-1 flex flex-col overflow-hidden">
							<FaceContent face={faces[0]} setCode={card.set} rarity={rarity} />
						</div>
						<CardFooter card={card} />
					</div>

					{/* Back */}
					<div
						className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} flex flex-col absolute inset-0`}
						style={{
							backfaceVisibility: "hidden",
							transform: "rotateY(180deg)",
						}}
					>
						<div
							className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
						>
							<span
								className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
							>
								{faces[1]?.name}
							</span>
							{faces[1]?.mana_cost && (
								<ManaCost
									cost={faces[1].mana_cost}
									className="w-[5cqw] h-[5cqw]"
								/>
							)}
						</div>
						<div className="h-[35%] bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center" />
						<div className="flex-1 flex flex-col overflow-hidden">
							<FaceContent
								face={faces[1] || faces[0]}
								setCode={card.set}
								rarity={rarity}
							/>
						</div>
						<CardFooter card={card} />
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

	return (
		<div
			className={`@container aspect-[5/7] border-2 ${frameColor.border} rounded-[4.75%/3.5%] overflow-hidden ${frameColor.frame} ${className ?? ""} flex flex-col`}
		>
			{/* Title bar */}
			<div
				className={`flex items-center justify-between gap-[1cqw] px-[3cqw] py-[1cqw] ${frameColor.titleBg}`}
			>
				<span
					className={`font-bold text-[6cqw] tracking-tight truncate ${frameColor.titleText}`}
				>
					{faces[0].name}
				</span>
				{faces[0].mana_cost && (
					<ManaCost cost={faces[0].mana_cost} className="w-[5cqw] h-[5cqw]" />
				)}
			</div>

			{/* Art placeholder */}
			<div className="h-[35%] bg-gray-300/50 dark:bg-slate-700/50 flex items-center justify-center" />

			{/* Card body */}
			<div className="flex-1 flex flex-col overflow-hidden">
				<FaceContent face={faces[0]} setCode={card.set} rarity={rarity} />
			</div>

			<CardFooter card={card} />
		</div>
	);
}
