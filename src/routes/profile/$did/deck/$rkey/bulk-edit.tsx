import type { Did } from "@atcute/lexicons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/profile/$did/deck/$rkey/bulk-edit")({
	component: BulkEditPage,
	loader: async ({ context, params }) => {
		const deck = await context.queryClient.ensureQueryData(
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

	const { data: deck } = useSuspenseQuery(
		getDeckQueryOptions(did as Did, asRkey(rkey)),
	);

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

	useEffect(() => {
		setText(sectionToText(activeSection));
		setErrors([]);
	}, [activeSection, sectionToText]);

	const handleSave = async () => {
		if (!isOwner) return;

		setIsSaving(true);
		setErrors([]);

		try {
			const parsed = parseCardList(text);
			const provider = await getCardDataProvider();

			const lookupByName = async (name: string): Promise<Card[]> => {
				if (!provider.searchCards) return [];
				return provider.searchCards(name, undefined, 10);
			};

			const getPrintings = async (
				oracleId: OracleId,
			): Promise<ScryfallId[]> => {
				return provider.getPrintingsByOracleId(oracleId);
			};

			const getCardById = async (id: ScryfallId): Promise<Card | undefined> => {
				return provider.getCardById(id);
			};

			const result = await resolveCards(
				parsed,
				lookupByName,
				getPrintings,
				getCardById,
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
	const cardCount = useMemo(
		() => parsed.reduce((sum, p) => sum + p.quantity, 0),
		[parsed],
	);
	const lineCount = parsed.length;

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
						Bulk Edit: {deck.name}
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						Edit cards in text format. One card per line.
					</p>
				</div>

				{/* Section tabs */}
				<div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-slate-700">
					{SECTIONS.map((section) => (
						<button
							type="button"
							key={section.value}
							onClick={() => setActiveSection(section.value)}
							className={`px-4 py-2 text-sm font-medium transition-colors ${
								activeSection === section.value
									? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
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
					))}
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

				{/* Textarea */}
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					disabled={!isOwner || isSaving}
					className="w-full h-96 p-4 font-mono text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
					placeholder="1 Lightning Bolt (2XM) 141 #removal&#10;4 Llanowar Elves #dorks&#10;1 Sol Ring"
				/>

				{/* Stats */}
				<div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
					{lineCount} unique cards, {cardCount} total
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
									<span className="text-red-500 dark:text-red-500 font-mono text-xs">
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
							disabled={isSaving}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
						>
							{isSaving ? "Saving..." : "Save Changes"}
						</button>
						<button
							type="button"
							onClick={handleReset}
							disabled={isSaving}
							className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
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
