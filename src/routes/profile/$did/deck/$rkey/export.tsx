import type { Did } from "@atcute/lexicons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { asRkey } from "@/lib/atproto-client";
import { prefetchCards } from "@/lib/card-prefetch";
import {
	DECK_FORMATS,
	type DeckFormat,
	formatDeck,
	type ParsedCardLine,
	type ParsedDeck,
} from "@/lib/deck-formats";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import type { Deck, DeckCard, Section } from "@/lib/deck-types";
import { getCardsInSection } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/profile/$did/deck/$rkey/export")({
	component: ExportPage,
	loader: async ({ context, params }) => {
		const { deck } = await context.queryClient.ensureQueryData(
			getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
		);
		const cardIds = deck.cards.map((card) => card.scryfallId);
		await prefetchCards(context.queryClient, cardIds);
		return deck;
	},
	head: ({ loaderData: deck }) => ({
		meta: [
			{
				title: deck
					? `Export: ${deck.name} | DeckBelcher`
					: "Export | DeckBelcher",
			},
		],
	}),
});

const EXPORTABLE_FORMATS = (Object.keys(DECK_FORMATS) as DeckFormat[]).filter(
	(f) => f !== "generic",
);

function ExportPage() {
	const { did, rkey } = Route.useParams();
	const queryClient = Route.useRouteContext().queryClient;

	const {
		data: { deck },
	} = useSuspenseQuery(getDeckQueryOptions(did as Did, asRkey(rkey)));

	const [format, setFormat] = useState<DeckFormat>("arena");
	const [includeMaybeboard, setIncludeMaybeboard] = useState(false);
	const [includeTags, setIncludeTags] = useState(true);
	const [includeSetCodes, setIncludeSetCodes] = useState(true);
	const [copied, setCopied] = useState(false);

	const formatOptions = DECK_FORMATS[format].options;

	const getCardData = useCallback(
		(id: ScryfallId): Card | undefined => {
			return queryClient.getQueryData(getCardByIdQueryOptions(id).queryKey);
		},
		[queryClient],
	);

	const convertToParsedDeck = useCallback(
		(
			deck: Deck,
			opts: {
				includeMaybe: boolean;
				includeTags: boolean;
				includeSetCodes: boolean;
			},
		): ParsedDeck => {
			const convertSection = (section: Section): ParsedCardLine[] => {
				return getCardsInSection(deck, section)
					.map((card: DeckCard): ParsedCardLine | null => {
						const cardData = getCardData(card.scryfallId);
						if (!cardData) return null;
						return {
							quantity: card.quantity,
							name: cardData.name,
							setCode: opts.includeSetCodes
								? cardData.set?.toUpperCase()
								: undefined,
							collectorNumber: opts.includeSetCodes
								? cardData.collector_number
								: undefined,
							tags: opts.includeTags ? (card.tags ?? []) : [],
							raw: "",
						};
					})
					.filter((c): c is ParsedCardLine => c !== null);
			};

			return {
				name: deck.name,
				commander: convertSection("commander"),
				mainboard: convertSection("mainboard"),
				sideboard: convertSection("sideboard"),
				maybeboard: opts.includeMaybe ? convertSection("maybeboard") : [],
			};
		},
		[getCardData],
	);

	const exportText = useMemo(() => {
		const parsedDeck = convertToParsedDeck(deck, {
			includeMaybe: includeMaybeboard,
			includeTags: formatOptions.tags && includeTags,
			includeSetCodes: formatOptions.setcodes && includeSetCodes,
		});
		return formatDeck(parsedDeck, format);
	}, [
		deck,
		format,
		includeMaybeboard,
		includeTags,
		includeSetCodes,
		formatOptions,
		convertToParsedDeck,
	]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(exportText);
			setCopied(true);
			toast.success("Copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy to clipboard");
		}
	};

	const handleDownload = () => {
		const blob = new Blob([exportText], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		const ext = DECK_FORMATS[format].extension;
		const safeName = deck.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "deck";
		a.download = `${safeName}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Downloaded");
	};

	const lineCount = exportText.split("\n").filter((l) => l.trim()).length;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="mb-6">
					<Link
						to="/profile/$did/deck/$rkey"
						params={{ did, rkey }}
						className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
					>
						← Back to deck
					</Link>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
						Export: {deck.name}
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						Export your deck to various formats for use in other tools.
					</p>
				</div>

				{/* Format selector */}
				<div className="mb-6">
					<span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Format
					</span>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						{EXPORTABLE_FORMATS.map((f) => {
							const meta = DECK_FORMATS[f];
							return (
								<button
									type="button"
									key={f}
									onClick={() => setFormat(f)}
									aria-pressed={format === f}
									className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
										format === f
											? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
											: "border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 text-gray-700 dark:text-gray-300"
									}`}
								>
									<div className="font-medium">{meta.label}</div>
									<div className="text-xs opacity-70">{meta.description}</div>
								</button>
							);
						})}
					</div>
				</div>

				{/* Options */}
				<div className="mb-6 space-y-2">
					{getCardsInSection(deck, "maybeboard").length > 0 && (
						<label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
							<input
								type="checkbox"
								checked={includeMaybeboard}
								onChange={(e) => setIncludeMaybeboard(e.target.checked)}
								className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
							/>
							Include maybeboard (
							{getCardsInSection(deck, "maybeboard").reduce(
								(s, c) => s + c.quantity,
								0,
							)}{" "}
							cards)
						</label>
					)}
					<label
						className={`flex items-center gap-2 text-sm ${
							formatOptions.tags
								? "text-gray-700 dark:text-gray-300 cursor-pointer"
								: "text-gray-400 dark:text-gray-600 cursor-not-allowed"
						}`}
					>
						<input
							type="checkbox"
							checked={formatOptions.tags && includeTags}
							onChange={(e) => setIncludeTags(e.target.checked)}
							disabled={!formatOptions.tags}
							className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
						/>
						Include tags
					</label>
					<label
						className={`flex items-center gap-2 text-sm ${
							formatOptions.setcodes
								? "text-gray-700 dark:text-gray-300 cursor-pointer"
								: "text-gray-400 dark:text-gray-600 cursor-not-allowed"
						}`}
					>
						<input
							type="checkbox"
							checked={formatOptions.setcodes && includeSetCodes}
							onChange={(e) => setIncludeSetCodes(e.target.checked)}
							disabled={!formatOptions.setcodes}
							className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
						/>
						Include set codes
					</label>
				</div>

				{/* Preview */}
				<div className="mb-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
							Preview ({lineCount} lines)
						</span>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleCopy}
								className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
							>
								{copied ? <Check size={14} /> : <Copy size={14} />}
								{copied ? "Copied" : "Copy"}
							</button>
							<button
								type="button"
								onClick={handleDownload}
								className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors"
							>
								<Download size={14} />
								Download
							</button>
						</div>
					</div>
					<pre className="p-4 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg overflow-x-auto text-sm font-mono text-gray-900 dark:text-gray-100 max-h-[60vh] overflow-y-auto whitespace-pre">
						{exportText}
					</pre>
				</div>
			</div>
		</div>
	);
}
