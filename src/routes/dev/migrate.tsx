import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { getCardDataProvider } from "@/lib/card-data-provider";
import type { ScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/dev/migrate")({
	component: MigratePage,
	head: () => ({
		meta: [{ title: "Migrate Records | DeckBelcher" }],
	}),
});

interface OldDeckCard {
	scryfallId: string;
	quantity: number;
	section: string;
	tags?: string[];
}

interface NewDeckCard {
	ref: CardRef;
	quantity: number;
	section: string;
	tags?: string[];
}

type DeckCard = OldDeckCard | NewDeckCard;

interface OldCollectionCardItem {
	$type: "com.deckbelcher.collection.list#cardItem";
	scryfallId: string;
	addedAt: string;
}

interface NewCollectionCardItem {
	$type: "com.deckbelcher.collection.list#cardItem";
	ref: CardRef;
	addedAt: string;
}

interface OldCollectionDeckItem {
	$type: "com.deckbelcher.collection.list#deckItem";
	deckUri: string;
	addedAt: string;
}

interface NewCollectionDeckItem {
	$type: "com.deckbelcher.collection.list#deckItem";
	ref: { uri: string; cid: string };
	addedAt: string;
}

type CollectionItem =
	| OldCollectionCardItem
	| NewCollectionCardItem
	| OldCollectionDeckItem
	| NewCollectionDeckItem;

interface OldDeckList {
	$type: "com.deckbelcher.deck.list";
	name: string;
	format?: string;
	primer?: unknown;
	cards: DeckCard[];
	createdAt: string;
	updatedAt?: string;
}

interface OldCollectionList {
	$type: "com.deckbelcher.collection.list";
	name: string;
	description?: unknown;
	items: CollectionItem[];
	createdAt: string;
	updatedAt?: string;
}

type OldRecord = OldDeckList | OldCollectionList;

interface CardRef {
	scryfallUri: string;
	oracleUri: string;
}

interface OldCardRefFeature {
	$type: "com.deckbelcher.richtext.facet#cardRef";
	scryfallId: string;
}

interface OldFacet {
	index: { byteStart: number; byteEnd: number };
	features: Array<OldCardRefFeature | { $type: string }>;
}

interface OldBlock {
	$type: string;
	text?: string;
	facets?: OldFacet[];
}

interface OldDocument {
	$type?: string;
	content: OldBlock[];
}

interface PrimerUri {
	$type: "com.deckbelcher.deck.list#primerUri";
	uri: string;
}

interface PrimerRef {
	$type: "com.deckbelcher.deck.list#primerRef";
	ref: { uri: string; cid: string };
}

type Primer = OldDocument | PrimerUri | PrimerRef;

interface MigrationResult {
	success: boolean;
	output?: unknown;
	errors: string[];
}

async function migrateRecord(record: OldRecord): Promise<MigrationResult> {
	const errors: string[] = [];
	const provider = await getCardDataProvider();

	async function buildCardRef(scryfallId: string): Promise<CardRef | null> {
		const card = await provider.getCardById(scryfallId as ScryfallId);
		if (!card) {
			errors.push(`Card not found: ${scryfallId}`);
			return null;
		}
		return {
			scryfallUri: `scry:${scryfallId}`,
			oracleUri: `oracle:${card.oracle_id}`,
		};
	}

	async function migrateDocument(
		doc: OldDocument | undefined,
	): Promise<OldDocument | undefined> {
		if (!doc?.content) return doc;

		const newContent = await Promise.all(
			doc.content.map(async (block) => {
				if (!block.facets) return block;

				const newFacets = await Promise.all(
					block.facets.map(async (facet) => {
						const newFeatures = await Promise.all(
							facet.features.map(async (feature) => {
								if (
									feature.$type === "com.deckbelcher.richtext.facet#cardRef" &&
									"scryfallId" in feature
								) {
									const ref = await buildCardRef(
										(feature as OldCardRefFeature).scryfallId,
									);
									if (!ref) return feature;
									return { $type: feature.$type, ref };
								}
								return feature;
							}),
						);
						return { ...facet, features: newFeatures };
					}),
				);
				return { ...block, facets: newFacets };
			}),
		);

		return { $type: "com.deckbelcher.richtext#document", content: newContent };
	}

	async function migratePrimer(
		primer: Primer | undefined,
	): Promise<Primer | undefined> {
		if (!primer) return undefined;

		// uri and ref primers pass through unchanged
		if (
			"uri" in primer &&
			primer.$type === "com.deckbelcher.deck.list#primerUri"
		) {
			return primer;
		}
		if (
			"ref" in primer &&
			primer.$type === "com.deckbelcher.deck.list#primerRef"
		) {
			return primer;
		}

		// embedded document - migrate and add $type
		if ("content" in primer) {
			return migrateDocument(primer);
		}

		return undefined;
	}

	if (record.$type === "com.deckbelcher.deck.list") {
		const newCards = await Promise.all(
			record.cards.map(async (card) => {
				// Already migrated - pass through
				if ("ref" in card) {
					return card;
				}
				// Old format - migrate
				const ref = await buildCardRef(card.scryfallId);
				if (!ref) return null;
				return {
					ref,
					quantity: card.quantity,
					section: card.section,
					...(card.tags ? { tags: card.tags } : {}),
				};
			}),
		);

		if (newCards.some((c) => c === null)) {
			return { success: false, errors };
		}

		const newPrimer = await migratePrimer(record.primer as Primer);

		return {
			success: true,
			output: {
				$type: record.$type,
				name: record.name,
				...(record.format ? { format: record.format } : {}),
				...(newPrimer ? { primer: newPrimer } : {}),
				cards: newCards,
				createdAt: record.createdAt,
				...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
			},
			errors,
		};
	}

	if (record.$type === "com.deckbelcher.collection.list") {
		const newItems = await Promise.all(
			record.items.map(async (item) => {
				// Deck items pass through (already have ref or old deckUri)
				if (item.$type === "com.deckbelcher.collection.list#deckItem") {
					return item;
				}
				// Already migrated card item - pass through
				if ("ref" in item) {
					return item;
				}
				// Old format card item - migrate
				const ref = await buildCardRef(item.scryfallId);
				if (!ref) return null;
				return {
					$type: item.$type,
					ref,
					addedAt: item.addedAt,
				};
			}),
		);

		if (newItems.some((i) => i === null)) {
			return { success: false, errors };
		}

		const newDescription = await migrateDocument(
			record.description as OldDocument,
		);

		return {
			success: true,
			output: {
				$type: record.$type,
				name: record.name,
				...(newDescription ? { description: newDescription } : {}),
				items: newItems,
				createdAt: record.createdAt,
				...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
			},
			errors,
		};
	}

	return { success: false, errors: ["Unknown record type"] };
}

function MigratePage() {
	const inputId = useId();
	const outputId = useId();
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errors, setErrors] = useState<string[]>([]);

	const handleMigrate = async () => {
		setStatus("loading");
		setErrors([]);
		setOutput("");

		try {
			const record = JSON.parse(input) as OldRecord;
			const result = await migrateRecord(record);

			if (result.success) {
				setOutput(JSON.stringify(result.output, null, 2));
				setStatus("success");
			} else {
				setErrors(result.errors);
				setStatus("error");
			}
		} catch (e) {
			setErrors([e instanceof Error ? e.message : "Unknown error"]);
			setStatus("error");
		}
	};

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900 p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
						Record Migration
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						Migrate old format records (scryfallId) to new format (cardRef with
						scryfallUri + oracleUri).
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<label
							htmlFor={inputId}
							className="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Old Format (paste JSON)
						</label>
						<textarea
							id={inputId}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							className="w-full h-96 p-3 font-mono text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100"
							placeholder='{"$type": "com.deckbelcher.deck.list", ...}'
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor={outputId}
							className="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							New Format (output)
						</label>
						<textarea
							id={outputId}
							value={output}
							readOnly
							className="w-full h-96 p-3 font-mono text-xs bg-gray-100 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100"
							placeholder="Migrated output will appear here..."
						/>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={handleMigrate}
						disabled={status === "loading" || !input.trim()}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
					>
						{status === "loading" ? "Migrating..." : "Migrate"}
					</button>

					{status === "success" && (
						<span className="text-green-600 dark:text-green-400 text-sm">
							Migration successful
						</span>
					)}
				</div>

				{errors.length > 0 && (
					<div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
						<h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
							Errors
						</h3>
						<ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
							{errors.map((err) => (
								<li key={err}>{err}</li>
							))}
						</ul>
					</div>
				)}

				<details className="text-sm">
					<summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">
						Migration Details
					</summary>
					<div className="mt-2 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg text-gray-700 dark:text-gray-300 space-y-2">
						<p>
							<strong>Old format:</strong>{" "}
							<code className="text-xs bg-gray-200 dark:bg-slate-700 px-1 rounded">
								scryfallId: "uuid"
							</code>
						</p>
						<p>
							<strong>New format:</strong>{" "}
							<code className="text-xs bg-gray-200 dark:bg-slate-700 px-1 rounded">
								{`ref: { scryfallUri: "scry:uuid", oracleUri: "oracle:uuid" }`}
							</code>
						</p>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							Supports both com.deckbelcher.deck.list and
							com.deckbelcher.collection.list records.
						</p>
					</div>
				</details>
			</div>
		</div>
	);
}
