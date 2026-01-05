/**
 * Card wireframe - text-based card display
 *
 * Renders card data as styled text instead of an image.
 * Useful for loading states, dense views, or accessibility.
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
import { getImageUri } from "@/lib/scryfall-utils";
import { ManaCost } from "./ManaCost";
import { OracleText } from "./OracleText";

interface CardWireframeProps {
	card: Card;
	mode?: "dense" | "art" | "placeholder";
	sizing?: "fixed" | "content";
	className?: string;
}

const RARITY_COLORS: Record<Rarity, { border: string; text: string }> = {
	common: {
		border: "border-gray-400 dark:border-gray-500",
		text: "text-gray-600 dark:text-gray-400",
	},
	uncommon: {
		border: "border-slate-400 dark:border-slate-400",
		text: "text-slate-500 dark:text-slate-300",
	},
	rare: {
		border: "border-amber-500 dark:border-amber-400",
		text: "text-amber-600 dark:text-amber-400",
	},
	mythic: {
		border: "border-orange-500 dark:border-orange-400",
		text: "text-orange-600 dark:text-orange-400",
	},
	special: {
		border: "border-purple-500 dark:border-purple-400",
		text: "text-purple-600 dark:text-purple-400",
	},
	bonus: {
		border: "border-fuchsia-500 dark:border-fuchsia-400",
		text: "text-fuchsia-600 dark:text-fuchsia-400",
	},
};

interface CardFaceWireframeProps {
	face: CardFace;
	rarity?: Rarity;
	showFooter?: boolean;
	set?: string;
	collectorNumber?: string;
	artist?: string;
	className?: string;
}

function CardFaceWireframe({
	face,
	rarity = "common",
	showFooter = true,
	set,
	collectorNumber,
	artist,
	className,
}: CardFaceWireframeProps) {
	const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS.common;
	const hasPT = face.power !== undefined && face.toughness !== undefined;
	const hasLoyalty = face.loyalty !== undefined;
	const hasDefense = face.defense !== undefined;
	const hasStats = hasPT || hasLoyalty || hasDefense;

	return (
		<div
			className={`flex flex-col bg-gray-50 dark:bg-slate-800 ${className ?? ""}`}
		>
			{/* Header: Name + Mana Cost */}
			<div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-slate-700">
				<span
					className={`font-semibold text-sm truncate ${rarityStyle.text}`}
					title={face.name}
				>
					{face.name}
				</span>
				{face.mana_cost && <ManaCost cost={face.mana_cost} size="small" />}
			</div>

			{/* Type Line */}
			{face.type_line && (
				<div className="px-2 py-1 text-xs text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700 truncate">
					{face.type_line}
				</div>
			)}

			{/* Oracle Text */}
			<div className="flex-1 px-2 py-1.5 text-xs text-gray-800 dark:text-gray-200 leading-relaxed overflow-hidden">
				{face.oracle_text ? (
					<OracleText text={face.oracle_text} />
				) : (
					<span className="text-gray-400 dark:text-gray-500 italic">
						No text
					</span>
				)}
			</div>

			{/* Stats (P/T, Loyalty, Defense) */}
			{hasStats && (
				<div className="flex justify-end px-2 py-1 border-t border-gray-200 dark:border-slate-700">
					<span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
						{hasPT && `${face.power}/${face.toughness}`}
						{hasLoyalty && face.loyalty}
						{hasDefense && face.defense}
					</span>
				</div>
			)}

			{/* Footer: Set, Collector Number, Artist */}
			{showFooter && (set || collectorNumber || artist) && (
				<div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-slate-700">
					<span className="truncate">
						{set && collectorNumber
							? `${set.toUpperCase()} #${collectorNumber}`
							: set?.toUpperCase()}
					</span>
					{artist && (
						<span className="truncate italic" title={artist}>
							{artist}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

export function CardWireframe({
	card,
	mode = "dense",
	sizing = "fixed",
	className,
}: CardWireframeProps) {
	const [isFlipped, setIsFlipped] = useState(false);

	const faces = getAllFaces(card);
	const isMultiFaced = faces.length > 1;
	const flippable = canFlip(card);
	const flipBehavior = getFlipBehavior(card.layout);
	const hasBack = hasBackImage(card.layout);

	const rarity = card.rarity || "common";
	const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS.common;

	// For art/placeholder, use artist from card or first face
	const artist = card.artist || faces[0]?.artist;

	// Dense mode: stack faces vertically
	if (mode === "dense") {
		const baseClasses = `border-2 ${rarityStyle.border} rounded-lg overflow-hidden ${className ?? ""}`;

		if (sizing === "content") {
			return (
				<div className={baseClasses}>
					{faces.map((face, i) => (
						<CardFaceWireframe
							key={face.name}
							face={face}
							rarity={rarity}
							showFooter={i === faces.length - 1}
							set={card.set}
							collectorNumber={card.collector_number}
							artist={artist}
							className={
								i > 0
									? "border-t-2 border-dashed border-gray-300 dark:border-slate-600"
									: ""
							}
						/>
					))}
				</div>
			);
		}

		// Fixed sizing with scroll + shadow indicators
		return (
			<div className={`${baseClasses} relative`}>
				<div
					className="overflow-y-auto max-h-48 scrollbar-thin"
					style={{
						maskImage:
							"linear-gradient(to bottom, transparent, black 8px, black calc(100% - 8px), transparent)",
						WebkitMaskImage:
							"linear-gradient(to bottom, transparent, black 8px, black calc(100% - 8px), transparent)",
					}}
				>
					{faces.map((face, i) => (
						<CardFaceWireframe
							key={face.name}
							face={face}
							rarity={rarity}
							showFooter={i === faces.length - 1}
							set={card.set}
							collectorNumber={card.collector_number}
							artist={artist}
							className={
								i > 0
									? "border-t-2 border-dashed border-gray-300 dark:border-slate-600"
									: ""
							}
						/>
					))}
				</div>
			</div>
		);
	}

	// Art or Placeholder mode: full card aspect ratio
	const showArt = mode === "art";
	const rotateScale = 5 / 7;

	// For single-faced or transform/MDFC cards
	const renderFaceContent = (faceIndex: number) => {
		const face = faces[faceIndex] || faces[0];
		return (
			<CardFaceWireframe
				face={face}
				rarity={rarity}
				showFooter={true}
				set={card.set}
				collectorNumber={card.collector_number}
				artist={face.artist || artist}
				className="flex-1"
			/>
		);
	};

	const handleFlip = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsFlipped(!isFlipped);
	};

	// Button position varies by card type
	const buttonPosition =
		flipBehavior === "rotate90"
			? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
			: flipBehavior === "rotate180"
				? "top-[15%] right-[15%]"
				: "top-[15%] right-[8%]";

	const baseClasses = `aspect-[5/7] border-2 ${rarityStyle.border} rounded-[4.75%/3.5%] overflow-hidden bg-gray-100 dark:bg-slate-900 ${className ?? ""}`;

	// For split cards (rotate90) - show both halves side by side, then rotate
	if (flipBehavior === "rotate90" && isMultiFaced) {
		return (
			<div className="relative group">
				<div
					className={`${baseClasses} flex flex-col motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out`}
					style={{
						transformOrigin: "center center",
						transform: isFlipped
							? `rotate(90deg) scale(${rotateScale})`
							: "rotate(0deg)",
					}}
				>
					{/* Art area or placeholder */}
					<div className="h-[40%] bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
						{showArt ? (
							<img
								src={getImageUri(card.id, "art_crop", "front")}
								alt=""
								className="w-full h-full object-cover"
								loading="lazy"
							/>
						) : (
							<span className="text-gray-400 dark:text-gray-500 text-xs">
								{card.type_line || "Split Card"}
							</span>
						)}
					</div>
					{/* Show both faces stacked in body */}
					<div className="h-[60%] flex flex-col overflow-hidden">
						{faces.map((face, i) => (
							<CardFaceWireframe
								key={face.name}
								face={face}
								rarity={rarity}
								showFooter={i === faces.length - 1}
								set={card.set}
								collectorNumber={card.collector_number}
								artist={face.artist || artist}
								className={`flex-1 ${i > 0 ? "border-t border-dashed border-gray-300 dark:border-slate-600" : ""}`}
							/>
						))}
					</div>
				</div>
				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className={`absolute ${buttonPosition} p-2 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10`}
						aria-label="Rotate card"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
			</div>
		);
	}

	// For flip cards (Kamigawa style - rotate180)
	if (flipBehavior === "rotate180" && isMultiFaced) {
		return (
			<div className="relative group">
				<div
					className={`${baseClasses} flex flex-col motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out`}
					style={{
						transformOrigin: "center center",
						transform: isFlipped ? "rotate(180deg)" : "rotate(0deg)",
					}}
				>
					{/* Art area or placeholder */}
					<div className="h-[40%] bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
						{showArt ? (
							<img
								src={getImageUri(card.id, "art_crop", "front")}
								alt=""
								className="w-full h-full object-cover"
								loading="lazy"
							/>
						) : (
							<span className="text-gray-400 dark:text-gray-500 text-xs">
								{faces[0].type_line || "Flip Card"}
							</span>
						)}
					</div>
					{/* Show primary face */}
					<div className="h-[60%] flex flex-col overflow-hidden">
						{renderFaceContent(0)}
					</div>
				</div>
				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className={`absolute ${buttonPosition} p-2 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10`}
						aria-label="Flip card"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
			</div>
		);
	}

	// For transform/MDFC (3D flip to back)
	if (flipBehavior === "transform" && hasBack && isMultiFaced) {
		return (
			<div className="relative group">
				<div
					className="w-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out"
					style={{
						transformStyle: "preserve-3d",
						transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					{/* Front face */}
					<div
						className={`${baseClasses} flex flex-col`}
						style={{ backfaceVisibility: "hidden" }}
					>
						<div className="h-[40%] bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
							{showArt ? (
								<img
									src={getImageUri(card.id, "art_crop", "front")}
									alt=""
									className="w-full h-full object-cover"
									loading="lazy"
								/>
							) : (
								<span className="text-gray-400 dark:text-gray-500 text-xs">
									{faces[0].type_line || "Front"}
								</span>
							)}
						</div>
						<div className="h-[60%] flex flex-col overflow-hidden">
							{renderFaceContent(0)}
						</div>
					</div>

					{/* Back face */}
					<div
						className={`${baseClasses} flex flex-col absolute inset-0`}
						style={{
							backfaceVisibility: "hidden",
							transform: "rotateY(180deg)",
						}}
					>
						<div className="h-[40%] bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
							{showArt ? (
								<img
									src={getImageUri(card.id, "art_crop", "back")}
									alt=""
									className="w-full h-full object-cover"
									loading="lazy"
								/>
							) : (
								<span className="text-gray-400 dark:text-gray-500 text-xs">
									{faces[1]?.type_line || "Back"}
								</span>
							)}
						</div>
						<div className="h-[60%] flex flex-col overflow-hidden">
							{renderFaceContent(1)}
						</div>
					</div>
				</div>
				{flippable && (
					<button
						type="button"
						onClick={handleFlip}
						className={`absolute ${buttonPosition} p-2 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10`}
						aria-label="Transform card"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
			</div>
		);
	}

	// Default: single-faced card or no flip behavior
	return (
		<div className={`${baseClasses} flex flex-col`}>
			{/* Art area or placeholder */}
			<div className="h-[40%] bg-gray-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
				{showArt ? (
					<img
						src={getImageUri(card.id, "art_crop", "front")}
						alt=""
						className="w-full h-full object-cover"
						loading="lazy"
					/>
				) : (
					<span className="text-gray-400 dark:text-gray-500 text-xs">
						{faces[0].type_line || "Card"}
					</span>
				)}
			</div>
			{/* Card body */}
			<div className="h-[60%] flex flex-col overflow-hidden">
				{renderFaceContent(0)}
			</div>
		</div>
	);
}
