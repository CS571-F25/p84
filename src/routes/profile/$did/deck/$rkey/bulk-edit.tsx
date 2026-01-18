import type { Did } from "@atcute/lexicons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	BulkEditPreview,
	type PreviewLine,
} from "@/components/deck/BulkEditPreview";
import { asRkey } from "@/lib/atproto-client";
import { getCardDataProvider } from "@/lib/card-data-provider";
import {
	formatCardLine,
	type ImportError,
	parseCardList,
	resolveCards,
} from "@/lib/deck-import";
import { getDeckQueryOptions, useUpdateDeckMutation } from "@/lib/deck-queries";
import type { Deck, DeckCard, Section } from "@/lib/deck-types";
import { getCardsInSection } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";
import { useDebounce } from "@/lib/useDebounce";

export const Route = createFileRoute("/profile/$did/deck/$rkey/bulk-edit")({
	component: BulkEditPage,
	loader: async ({ context, params }) => {
		const { deck } = await context.queryClient.ensureQueryData(
			getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
		);
		await Promise.all(
			deck.cards.map((card) =>
				context.queryClient.ensureQueryData(
					getCardByIdQueryOptions(card.scryfallId),
				),
			),
		);
	},
});

const SECTIONS: { value: Section; label: string }[] = [
	{ value: "commander", label: "Commander" },
	{ value: "mainboard", label: "Mainboard" },
	{ value: "sideboard", label: "Sideboard" },
	{ value: "maybeboard", label: "Maybeboard" },
];

function BulkEditPage() {
	const { did, rkey } = Route.useParams();
	const { session } = useAuth();
	const queryClient = Route.useRouteContext().queryClient;

	const {
		data: { deck },
	} = useSuspenseQuery(getDeckQueryOptions(did as Did, asRkey(rkey)));

	const mutation = useUpdateDeckMutation(did as Did, asRkey(rkey));

	const [activeSection, setActiveSection] = useState<Section>("mainboard");
	const [text, setText] = useState("");
	const [errors, setErrors] = useState<ImportError[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	const isOwner = session?.info.sub === did;

	const getCardData = useCallback(
		(id: ScryfallId): Card | undefined => {
			return queryClient.getQueryData(getCardByIdQueryOptions(id).queryKey);
		},
		[queryClient],
	);

	const sectionToText = useCallback(
		(section: Section): string => {
			const cards = getCardsInSection(deck, section);
			return cards
				.map((card) => {
					const cardData = getCardData(card.scryfallId);
					if (!cardData) return null;
					return formatCardLine(card, cardData);
				})
				.filter((line): line is string => line !== null)
				.join("\n");
		},
		[deck, getCardData],
	);

	const savedText = sectionToText(activeSection);
	const isDirty = text !== savedText;

	const textLines = useMemo(() => text.split("\n"), [text]);

	useEffect(() => {
		setText(sectionToText(activeSection));
		setErrors([]);
	}, [activeSection, sectionToText]);

	const handleSave = async () => {
		if (!isOwner) return;

		setIsSaving(true);
		setErrors([]);

		try {
			const parsedText = parseCardList(text);
			const provider = await getCardDataProvider();
			const result = await resolveCards(
				parsedText,
				async (name) =>
					provider.searchCards ? provider.searchCards(name, undefined, 10) : [],
				(oracleId) => provider.getPrintingsByOracleId(oracleId),
				(id) => provider.getCardById(id),
			);

			if (result.errors.length > 0) {
				const fatalErrors = result.errors.filter(
					(e) => !e.error.includes("using default printing"),
				);
				if (fatalErrors.length > 0) {
					setErrors(result.errors);
					toast.error(`${fatalErrors.length} card(s) could not be resolved`);
					setIsSaving(false);
					return;
				}
				setErrors(result.errors);
			}

			const newCards: DeckCard[] = result.resolved.map((r) => ({
				scryfallId: r.scryfallId,
				oracleId: r.oracleId,
				quantity: r.quantity,
				section: activeSection,
				tags: r.tags,
			}));

			const otherCards = deck.cards.filter(
				(card) => card.section !== activeSection,
			);

			const updatedDeck: Deck = {
				...deck,
				cards: [...otherCards, ...newCards],
				updatedAt: new Date().toISOString(),
			};

			// Prefetch card data for new cards so sectionToText can render them
			await Promise.all(
				newCards.map((card) =>
					queryClient.prefetchQuery(getCardByIdQueryOptions(card.scryfallId)),
				),
			);

			await mutation.mutateAsync(updatedDeck);
			toast.success(`${activeSection} updated`);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save changes",
			);
		} finally {
			setIsSaving(false);
		}
	};

	const handleReset = () => {
		setText(sectionToText(activeSection));
		setErrors([]);
	};

	const parsed = useMemo(() => parseCardList(text), [text]);
	const parsedByRaw = useMemo(
		() => new Map(parsed.map((p) => [p.raw, p])),
		[parsed],
	);
	const cardCount = useMemo(
		() => parsed.reduce((sum, p) => sum + p.quantity, 0),
		[parsed],
	);
	const lineCount = parsed.length;

	const { value: debouncedParsed } = useDebounce(parsed, 300);

	const [resolvedMap, setResolvedMap] = useState<
		Map<string, { scryfallId: ScryfallId; cardData: Card }>
	>(new Map());
	const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

	const savedCardIds = useMemo(
		() =>
			new Set(getCardsInSection(deck, activeSection).map((c) => c.scryfallId)),
		[deck, activeSection],
	);

	useEffect(() => {
		if (!debouncedParsed || debouncedParsed.length === 0) {
			setResolvedMap(new Map());
			setErrorMap(new Map());
			return;
		}

		let cancelled = false;

		(async () => {
			const provider = await getCardDataProvider();
			const result = await resolveCards(
				debouncedParsed,
				async (name) =>
					provider.searchCards ? provider.searchCards(name, undefined, 10) : [],
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

			const newResolved = new Map<
				string,
				{ scryfallId: ScryfallId; cardData: Card }
			>();
			for (let i = 0; i < result.resolved.length; i++) {
				const resolved = result.resolved[i];
				const cardData = cardDataList[i];
				if (!cardData) continue;
				newResolved.set(resolved.raw, {
					scryfallId: resolved.scryfallId,
					cardData,
				});
			}

			setResolvedMap(newResolved);
			setErrorMap(newErrors);
		})();

		return () => {
			cancelled = true;
		};
	}, [debouncedParsed]);

	const previewLines = useMemo(() => {
		const counts = new Map<string, number>();
		return textLines.map((line): PreviewLine => {
			const trimmed = line.trim();
			const occurrence = counts.get(trimmed) ?? 0;
			counts.set(trimmed, occurrence + 1);
			const lineKey = `${trimmed}:${occurrence}`;

			if (!trimmed) {
				return { type: "empty", lineKey };
			}

			const error = errorMap.get(trimmed);
			if (error) {
				return { type: "error", lineKey, message: error };
			}

			const parsedLine = parsedByRaw.get(trimmed);
			const resolved = resolvedMap.get(trimmed);
			if (resolved) {
				const isImperfect =
					parsedLine &&
					parsedLine.name.toLowerCase() !==
						resolved.cardData.name.toLowerCase();
				const isNew = !savedCardIds.has(resolved.scryfallId);
				return {
					type: "resolved",
					lineKey,
					scryfallId: resolved.scryfallId,
					quantity: parsedLine?.quantity ?? 1,
					cardData: resolved.cardData,
					isImperfect,
					isNew,
				};
			}

			return { type: "pending", lineKey, name: parsedLine?.name ?? trimmed };
		});
	}, [textLines, resolvedMap, errorMap, parsedByRaw, savedCardIds]);

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-6xl mx-auto px-6 py-8">
				<div className="mb-6">
					<Link
						to="/profile/$did/deck/$rkey"
						params={{ did, rkey }}
						className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
					>
						← Back to deck
					</Link>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
						Bulk Edit: {deck.name}
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						Edit cards in text format. One card per line.
					</p>
				</div>

				{/* Section tabs */}
				<div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
					{SECTIONS.map((section) => {
						const isActive = activeSection === section.value;
						const isDisabled = isDirty && !isActive;
						return (
							<button
								type="button"
								key={section.value}
								onClick={() => setActiveSection(section.value)}
								disabled={isDisabled}
								className={`px-4 py-2 text-sm font-medium transition-colors ${
									isActive
										? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
										: isDisabled
											? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
											: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
								}`}
							>
								{section.label}
								<span className="ml-1 text-xs text-gray-400">
									(
									{getCardsInSection(deck, section.value).reduce(
										(s, c) => s + c.quantity,
										0,
									)}
									)
								</span>
							</button>
						);
					})}
				</div>

				{/* Format hint */}
				<div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
					<strong>Format:</strong>{" "}
					<code className="bg-gray-200 dark:bg-slate-700 px-1 rounded">
						&lt;quantity&gt; &lt;card name&gt; (SET) &lt;collector#&gt; #tag1
						#tag2
					</code>
					<br />
					<span className="text-xs">
						Set code and collector number are optional. Tags start with #
					</span>
				</div>

				{/* Editor container */}
				<div className="overflow-auto max-h-96 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
					<div className="flex">
						<textarea
							value={text}
							onChange={(e) => {
								setText(e.target.value);
								setErrors([]);
							}}
							disabled={!isOwner || isSaving}
							wrap="off"
							className="flex-1 p-4 font-mono text-sm leading-[1.5] resize-none overflow-x-auto overflow-y-hidden bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-50 [font-variant-ligatures:none]"
							style={{
								height: `calc(${Math.max(textLines.length, 10)} * 1.5em + 2rem)`,
							}}
							placeholder="1 Lightning Bolt (2XM) 141 #removal&#10;4 Llanowar Elves #dorks&#10;1 Sol Ring"
						/>
						<BulkEditPreview lines={previewLines} />
					</div>
				</div>

				{/* Stats */}
				<div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
					{lineCount} {lineCount === 1 ? "card" : "cards"}, {cardCount} total
				</div>

				{/* Errors */}
				{errors.length > 0 && (
					<div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
						<h3 className="font-medium text-red-800 dark:text-red-300 mb-2">
							{errors.filter((e) => !e.error.includes("using default")).length >
							0
								? "Errors"
								: "Warnings"}
						</h3>
						<ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
							{errors.map((err) => (
								<li key={`${err.line}-${err.raw}`}>
									<span className="font-mono">Line {err.line}:</span>{" "}
									{err.error}
									<br />
									<span className="text-red-500 font-mono text-xs">
										{err.raw}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Actions */}
				{isOwner && (
					<div className="mt-6 flex gap-3">
						<button
							type="button"
							onClick={handleSave}
							disabled={isSaving || !isDirty}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
						>
							{isSaving ? "Saving..." : "Save Changes"}
						</button>
						<button
							type="button"
							onClick={handleReset}
							disabled={isSaving || !isDirty}
							className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
						>
							Reset
						</button>
					</div>
				)}

				{!isOwner && (
					<div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
						You can view this deck's contents but cannot edit it.
					</div>
				)}
			</div>
		</div>
	);
}
