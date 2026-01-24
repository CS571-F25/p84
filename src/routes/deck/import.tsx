import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, Check, Loader2 } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCardHover } from "@/components/HoverCardPreview";
import { ManaCost } from "@/components/ManaCost";
import { getCardDataProvider } from "@/lib/card-data-provider";
import { getAllFaces, getPrimaryFace } from "@/lib/card-faces";
import {
	DECK_FORMATS,
	type DeckFormat,
	detectFormat,
	matchLinesToParsedCards,
	parseDeck,
} from "@/lib/deck-formats";
import { type ResolvedCard, resolveCards } from "@/lib/deck-import";
import { useCreateDeckMutation } from "@/lib/deck-queries";
import type { Section } from "@/lib/deck-types";
import { getPreset } from "@/lib/deck-validation/presets";
import { FORMAT_GROUPS, getFormatInfo } from "@/lib/format-utils";
import type { Card } from "@/lib/scryfall-types";
import { useDebounce } from "@/lib/useDebounce";

export const Route = createFileRoute("/deck/import")({
	component: ImportDeckPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			format: (search.format as string) || undefined,
		};
	},
	head: () => ({
		meta: [{ title: "Import Deck | DeckBelcher" }],
	}),
});

type ImportLineType =
	| { type: "empty" }
	| { type: "section-header"; label: string }
	| { type: "pending"; name: string }
	| {
			type: "resolved";
			card: Card;
			quantity: number;
			section: Section;
			tags: string[];
			isImperfect?: boolean;
	  }
	| { type: "error"; message: string };

interface ImportLine {
	key: string;
	line: ImportLineType;
}

const TAG_COLORS = [
	"bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
	"bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
	"bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
	"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
	"bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
	"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
	"bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
	"bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
];

function buildTagColorMap(lines: ImportLine[]): Map<string, string> {
	const map = new Map<string, string>();
	let colorIndex = 0;
	for (const line of lines) {
		if (line.line.type === "resolved") {
			for (const tag of line.line.tags) {
				if (!map.has(tag)) {
					map.set(tag, TAG_COLORS[colorIndex % TAG_COLORS.length]);
					colorIndex++;
				}
			}
		}
	}
	return map;
}

/**
 * Check if a parsed name matches the card (including individual face names).
 * Returns true if the name is a valid way to refer to the card.
 */
function nameMatchesCard(parsedName: string, card: Card): boolean {
	const lower = parsedName.toLowerCase();

	// Exact match on full name
	if (lower === card.name.toLowerCase()) return true;

	// Match any face name (for DFCs like "Delver of Secrets // Insectile Aberration")
	for (const face of getAllFaces(card)) {
		if (lower === face.name.toLowerCase()) return true;
	}

	return false;
}

const SECTION_CHIPS: Record<
	Section,
	{ label: string; className: string } | null
> = {
	mainboard: null,
	commander: {
		label: "Cmdr",
		className:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
	},
	sideboard: {
		label: "Side",
		className:
			"bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
	},
	maybeboard: {
		label: "Maybe",
		className: "bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300",
	},
};

function ImportDeckPage() {
	const { format: initialFormat } = Route.useSearch();
	const [text, setText] = useState("");
	const [deckName, setDeckName] = useState("");
	const [gameFormat, setGameFormat] = useState(initialFormat || "commander");
	const [formatOverride, setFormatOverride] = useState<DeckFormat | null>(null);
	const nameId = useId();
	const formatId = useId();
	const prevDetectedFormat = useRef<DeckFormat>("generic");

	const mutation = useCreateDeckMutation();

	const detectedFormat = useMemo(() => detectFormat(text), [text]);
	const effectiveFormat = formatOverride ?? detectedFormat;

	// Reset override when detected format changes
	useEffect(() => {
		if (detectedFormat !== prevDetectedFormat.current) {
			setFormatOverride(null);
			prevDetectedFormat.current = detectedFormat;
		}
	}, [detectedFormat]);

	const parsedDeck = useMemo(
		() => parseDeck(text, { format: effectiveFormat }),
		[text, effectiveFormat],
	);

	// Pre-fill deck name from parsed metadata
	useEffect(() => {
		if (parsedDeck.name && !deckName) {
			setDeckName(parsedDeck.name);
		}
	}, [parsedDeck.name, deckName]);

	const { value: debouncedParsed } = useDebounce(parsedDeck, 300);

	// Resolution state
	const [resolvedMap, setResolvedMap] = useState<
		Map<string, ResolvedCard & { cardData: Card }>
	>(new Map());
	const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
	const [isResolving, setIsResolving] = useState(false);

	// Resolve cards when parsed deck changes
	useEffect(() => {
		const allParsed = [
			...debouncedParsed.commander,
			...debouncedParsed.mainboard,
			...debouncedParsed.sideboard,
			...debouncedParsed.maybeboard,
		];

		if (allParsed.length === 0) {
			setResolvedMap(new Map());
			setErrorMap(new Map());
			return;
		}

		let cancelled = false;
		setIsResolving(true);

		(async () => {
			const provider = await getCardDataProvider();
			// Use the legality field (e.g., oathbreaker uses legacy legality)
			const legalityField = gameFormat
				? getPreset(gameFormat)?.config.legalityField
				: undefined;
			const restrictions = legalityField
				? { format: legalityField }
				: undefined;
			const result = await resolveCards(
				allParsed,
				async (name) =>
					provider.searchCards
						? provider.searchCards(name, restrictions, 10)
						: [],
				(oracleId) => provider.getPrintingsByOracleId(oracleId),
				(id) => provider.getCardById(id),
			);

			if (cancelled) return;

			const newErrors = new Map<string, string>();
			for (const error of result.errors) {
				newErrors.set(error.raw, error.error);
			}

			const cardDataList = await Promise.all(
				result.resolved.map((r) => provider.getCardById(r.scryfallId)),
			);

			if (cancelled) return;

			const newResolved = new Map<string, ResolvedCard & { cardData: Card }>();
			for (let i = 0; i < result.resolved.length; i++) {
				const resolved = result.resolved[i];
				const cardData = cardDataList[i];
				if (!cardData) continue;
				newResolved.set(resolved.raw, { ...resolved, cardData });
			}

			setResolvedMap(newResolved);
			setErrorMap(newErrors);
			setIsResolving(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [debouncedParsed, gameFormat]);

	// Build preview lines with row sync
	const previewLines = useMemo(() => {
		const lines = text.split("\n");
		const matched = matchLinesToParsedCards(lines, parsedDeck);

		return matched.map(({ key, trimmed, parsed, section }): ImportLine => {
			if (!trimmed) {
				return { key, line: { type: "empty" } };
			}

			// If no parsed card, it's a section/metadata header
			if (!parsed) {
				return { key, line: { type: "section-header", label: trimmed } };
			}

			const error = errorMap.get(trimmed);
			if (error) {
				return { key, line: { type: "error", message: error } };
			}

			const resolved = resolvedMap.get(trimmed);
			if (resolved) {
				const isImperfect = !nameMatchesCard(parsed.name, resolved.cardData);
				return {
					key,
					line: {
						type: "resolved",
						card: resolved.cardData,
						quantity: parsed.quantity,
						section: section ?? "mainboard",
						tags: parsed.tags,
						isImperfect,
					},
				};
			}

			return { key, line: { type: "pending", name: parsed.name } };
		});
	}, [text, parsedDeck, resolvedMap, errorMap]);

	// Stats
	const { totalCards, warningCount } = useMemo(() => {
		let total = 0;
		let warnings = 0;
		for (const line of previewLines) {
			if (line.line.type === "resolved") {
				total += line.line.quantity;
				if (line.line.isImperfect) warnings++;
			}
		}
		return { totalCards: total, warningCount: warnings };
	}, [previewLines]);

	const errorCount = errorMap.size;
	const hasErrors = errorCount > 0;
	const hasWarnings = warningCount > 0;

	// Format suggestion hint
	const formatHint = useMemo(() => {
		const formatInfo = getFormatInfo(gameFormat);
		const hasCommander = parsedDeck.commander.length > 0;
		const isCommanderFormat = formatInfo.commanderType !== null;

		// Deck size from parsed deck (mainboard + commander)
		const deckSize =
			parsedDeck.mainboard.reduce((sum, c) => sum + c.quantity, 0) +
			parsedDeck.commander.reduce((sum, c) => sum + c.quantity, 0);

		// Has commander section but not a commander format
		if (hasCommander && !isCommanderFormat) {
			return "Deck has a commander — try a Commander format?";
		}

		// Size mismatch heuristics
		const expectedSize =
			formatInfo.deckSize === "variable" ? null : formatInfo.deckSize;
		if (expectedSize && deckSize > 0) {
			// ~100 cards but format expects 60
			if (deckSize >= 90 && expectedSize === 60) {
				if (hasCommander) {
					return "Deck has ~100 cards — try Commander or Brawl?";
				}
				return "Deck has ~100 cards — try Commander, Brawl, or Gladiator?";
			}
			// ~60 cards but format expects 100
			if (deckSize >= 50 && deckSize <= 70 && expectedSize === 100) {
				if (hasCommander) {
					return "Deck has ~60 cards — try Oathbreaker or Standard Brawl?";
				}
				return "Deck has ~60 cards — try a 60-card format?";
			}
		}

		// Cards not resolving
		if (hasErrors) {
			return "Some cards not found — try changing the format?";
		}

		return null;
	}, [gameFormat, parsedDeck, hasErrors]);

	const handleCreate = useCallback(() => {
		if (!deckName.trim()) return;

		const cards = [];
		const sections: Section[] = [
			"commander",
			"mainboard",
			"sideboard",
			"maybeboard",
		];
		for (const section of sections) {
			for (const parsed of parsedDeck[section]) {
				const resolved = resolvedMap.get(parsed.raw);
				if (!resolved) continue;

				cards.push({
					scryfallId: resolved.scryfallId,
					oracleId: resolved.oracleId,
					quantity: parsed.quantity,
					section,
					tags: parsed.tags,
				});
			}
		}

		mutation.mutate({
			name: deckName.trim(),
			format: gameFormat || undefined,
			cards,
		});
	}, [deckName, gameFormat, resolvedMap, parsedDeck, mutation]);

	const textareaLines = text.split("\n").length;

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-6">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
						Import Deck
					</h1>
					<p className="text-gray-600 dark:text-zinc-300 mt-1">
						Paste a deck list from any major site. List syntax is auto-detected.
					</p>
				</div>

				{/* Deck metadata row */}
				<div className="flex gap-4 mb-4">
					<div className="flex-1">
						<label
							htmlFor={nameId}
							className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
						>
							Deck Name
						</label>
						<input
							id={nameId}
							type="text"
							value={deckName}
							onChange={(e) => setDeckName(e.target.value)}
							placeholder="Untitled Deck"
							autoComplete="off"
							className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
						/>
					</div>
					<div className="w-48">
						<label
							htmlFor={formatId}
							className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
						>
							Format
						</label>
						<select
							id={formatId}
							value={gameFormat}
							onChange={(e) => setGameFormat(e.target.value)}
							className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
						>
							{FORMAT_GROUPS.map((group) => (
								<optgroup key={group.label} label={group.label}>
									{group.formats.map((fmt) => (
										<option key={fmt.value} value={fmt.value}>
											{fmt.label}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</div>
				</div>

				{/* Syntax detection badge */}
				<div className="flex items-center gap-2 mb-4">
					<span className="text-sm text-gray-600 dark:text-zinc-300">
						Syntax:
					</span>
					<FormatBadge
						detected={detectedFormat}
						override={formatOverride}
						onOverride={setFormatOverride}
					/>
					{isResolving && (
						<span className="flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400">
							<Loader2 className="w-4 h-4 animate-spin" />
							Resolving...
						</span>
					)}
					{formatHint && !isResolving && (
						<span className="ml-auto text-sm text-amber-600 dark:text-amber-400">
							{formatHint}
						</span>
					)}
				</div>

				{/* Editor container */}
				<div className="overflow-auto max-h-[28rem] border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800">
					<div className="flex">
						<textarea
							value={text}
							onChange={(e) => setText(e.target.value)}
							wrap="off"
							className="flex-1 p-4 font-mono text-sm leading-[1.5] resize-none overflow-x-auto overflow-y-hidden bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none [font-variant-ligatures:none]"
							style={{
								height: `calc(${Math.max(textareaLines, 15)} * 1.5em + 2rem)`,
							}}
							placeholder={`Paste your deck list here...

Examples:
4 Lightning Bolt (2XM) 141
1 Sol Ring
Sideboard
2 Grafdigger's Cage`}
						/>
						<ImportPreview lines={previewLines} />
					</div>
				</div>

				{/* Stats */}
				<div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-300">
					<span>{totalCards} cards</span>
					{hasWarnings && (
						<span className="text-amber-600 dark:text-amber-400">
							{warningCount} {warningCount === 1 ? "warning" : "warnings"}
						</span>
					)}
					{hasErrors && (
						<span className="text-red-600 dark:text-red-400">
							{errorCount} {errorCount === 1 ? "error" : "errors"}
						</span>
					)}
				</div>

				{/* Actions */}
				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={handleCreate}
						disabled={
							mutation.isPending ||
							!deckName.trim() ||
							resolvedMap.size === 0 ||
							hasErrors
						}
						className="px-6 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-gray-400 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
					>
						{mutation.isPending ? "Creating..." : "Create Deck"}
					</button>
					<button
						type="button"
						onClick={() => {
							setText("");
							setDeckName("");
							setFormatOverride(null);
						}}
						disabled={!text}
						className="px-6 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
					>
						Clear
					</button>
				</div>
			</div>
		</div>
	);
}

interface FormatBadgeProps {
	detected: DeckFormat;
	override: DeckFormat | null;
	onOverride: (format: DeckFormat | null) => void;
}

function FormatBadge({ detected, override, onOverride }: FormatBadgeProps) {
	const value = override ?? "";

	return (
		<select
			value={value}
			onChange={(e) => {
				const val = e.target.value;
				onOverride(val === "" ? null : (val as DeckFormat));
			}}
			className="px-2 py-1 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-900 dark:text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
		>
			<option value="">Auto ({DECK_FORMATS[detected].label})</option>
			{(Object.keys(DECK_FORMATS) as DeckFormat[]).map((fmt) => (
				<option key={fmt} value={fmt}>
					{DECK_FORMATS[fmt].label}
				</option>
			))}
		</select>
	);
}

interface ImportPreviewProps {
	lines: ImportLine[];
}

function ImportPreview({ lines }: ImportPreviewProps) {
	const tagColors = useMemo(() => buildTagColorMap(lines), [lines]);

	return (
		<div className="flex-1 p-4 border-l border-gray-200 dark:border-zinc-600 overflow-hidden">
			{lines.map((line) => (
				<PreviewRow key={line.key} line={line.line} tagColors={tagColors} />
			))}
		</div>
	);
}

const ROW_CLASS =
	"font-mono text-sm leading-[1.5] whitespace-nowrap [font-variant-ligatures:none] flex items-center gap-2";

function PreviewRow({
	line,
	tagColors,
}: {
	line: ImportLineType;
	tagColors: Map<string, string>;
}) {
	switch (line.type) {
		case "empty":
			return <div className={ROW_CLASS}>&nbsp;</div>;

		case "section-header":
			return (
				<div className={`${ROW_CLASS} text-gray-400 dark:text-zinc-500`}>
					─── {line.label} ───
				</div>
			);

		case "pending":
			return (
				<div className={ROW_CLASS}>
					<Loader2 className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-400 animate-spin flex-shrink-0" />
					<span className="text-gray-400 dark:text-zinc-400 italic truncate">
						{line.name}
					</span>
				</div>
			);

		case "error":
			return (
				<div className={ROW_CLASS}>
					<AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />
					<span className="text-red-600 dark:text-red-400 truncate">
						{line.message}
					</span>
				</div>
			);

		case "resolved":
			return <ResolvedRow line={line} tagColors={tagColors} />;
	}
}

function ResolvedRow({
	line,
	tagColors,
}: {
	line: Extract<ImportLineType, { type: "resolved" }>;
	tagColors: Map<string, string>;
}) {
	const hoverProps = useCardHover(line.card.id);
	const primaryFace = getPrimaryFace(line.card);
	const sectionChip = SECTION_CHIPS[line.section];

	const bgClass = line.isImperfect
		? "bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/40"
		: "hover:bg-gray-100 dark:hover:bg-zinc-700";

	return (
		<div
			className={`${ROW_CLASS} ${bgClass} rounded px-1 -mx-1 cursor-default`}
			{...hoverProps}
		>
			{line.isImperfect ? (
				<AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
			) : (
				<Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
			)}
			<span className="text-gray-600 dark:text-zinc-300 text-xs w-4 text-right flex-shrink-0">
				{line.quantity}
			</span>
			<span className="text-gray-900 dark:text-white truncate min-w-0">
				{primaryFace?.name ?? "Unknown"}
			</span>
			{sectionChip && (
				<span
					className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${sectionChip.className}`}
				>
					{sectionChip.label}
				</span>
			)}
			{line.tags.map((tag) => (
				<span
					key={tag}
					className={`flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${tagColors.get(tag) ?? TAG_COLORS[0]}`}
				>
					#{tag}
				</span>
			))}
			<div className="flex-shrink-0 flex items-center ml-auto">
				{primaryFace?.mana_cost && (
					<ManaCost cost={primaryFace.mana_cost} size="small" />
				)}
			</div>
		</div>
	);
}
