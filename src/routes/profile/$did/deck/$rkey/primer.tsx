import type { Did } from "@atcute/lexicons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { CommentsPanel } from "@/components/comments/CommentsPanel";
import { Drawer } from "@/components/Drawer";
import { HandleLink } from "@/components/HandleLink";
import { RichtextRenderer } from "@/components/richtext/RichtextRenderer";
import { SocialStats } from "@/components/social/SocialStats";
import { asRkey } from "@/lib/atproto-client";
import { DECK_LIST_NSID } from "@/lib/constellation-client";
import { prefetchSocialStats } from "@/lib/constellation-queries";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import { getEmbeddedPrimer } from "@/lib/deck-types";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import { documentToPlainText } from "@/lib/richtext-convert";
import type { DeckItemUri } from "@/lib/social-item-types";

export const Route = createFileRoute("/profile/$did/deck/$rkey/primer")({
	component: PrimerPage,
	loader: async ({ context, params }) => {
		const [{ deck, cid }, didDoc] = await Promise.all([
			context.queryClient.ensureQueryData(
				getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
			),
			context.queryClient.ensureQueryData(
				didDocumentQueryOptions(params.did as Did),
			),
		]);

		const deckUri =
			`at://${params.did}/${DECK_LIST_NSID}/${params.rkey}` as DeckItemUri;

		await prefetchSocialStats(context.queryClient, {
			type: "deck",
			uri: deckUri,
			cid,
		});

		const handle = extractHandle(didDoc);

		return { deck, cid, handle };
	},
	head: ({ loaderData }) => {
		if (!loaderData) {
			return { meta: [{ title: "Primer Not Found | DeckBelcher" }] };
		}

		const { deck, handle } = loaderData;
		const format = formatDisplayName(deck.format);
		const byline = handle ? ` by @${handle}` : "";
		const title = format
			? `${deck.name} Primer (${format})${byline} | DeckBelcher`
			: `${deck.name} Primer${byline} | DeckBelcher`;

		const ogTitle = format
			? `${deck.name} Primer (${format})${byline}`
			: `${deck.name} Primer${byline}`;

		const embeddedPrimer = getEmbeddedPrimer(deck.primer);
		const primerText = embeddedPrimer
			? documentToPlainText(embeddedPrimer)
			: undefined;
		const description = primerText
			? `${primerText.slice(0, 150)}${primerText.length > 150 ? "..." : ""}`
			: `Deck primer for ${deck.name}`;

		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: ogTitle },
				{ property: "og:description", content: description },
				{ property: "og:image", content: "/logo512-maskable.png" },
				{ property: "og:image:width", content: "512" },
				{ property: "og:image:height", content: "512" },
				{ property: "og:type", content: "article" },
				{ name: "twitter:card", content: "summary" },
				{ name: "twitter:title", content: ogTitle },
				{ name: "twitter:description", content: description },
				{ name: "twitter:image", content: "/logo512-maskable.png" },
			],
		};
	},
});

function PrimerPage() {
	const { did, rkey } = Route.useParams();
	const { data: deckRecord } = useSuspenseQuery(
		getDeckQueryOptions(did as Did, asRkey(rkey)),
	);
	const deck = deckRecord.deck;
	const primer = getEmbeddedPrimer(deck.primer);

	const [isCommentsDrawerOpen, setIsCommentsDrawerOpen] = useState(false);

	const deckUri = `at://${did}/${DECK_LIST_NSID}/${rkey}` as DeckItemUri;

	const format = formatDisplayName(deck.format);

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<div className="max-w-3xl mx-auto px-6 py-8">
				{/* Back link */}
				<Link
					to="/profile/$did/deck/$rkey"
					params={{ did, rkey }}
					className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 mb-6"
				>
					<ArrowLeft className="w-4 h-4" />
					Back to deck
				</Link>

				{/* Header */}
				<header className="mb-4">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white font-display">
						{deck.name}
					</h1>
					<p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
						<HandleLink did={did as Did} prefix="by" />
						{format && <span> · {format}</span>}
					</p>
				</header>

				{/* Social stats */}
				<div className="mb-8 pb-6 border-b border-gray-200 dark:border-zinc-700">
					<SocialStats
						item={{
							type: "deck",
							uri: deckUri,
							cid: deckRecord.cid,
						}}
						itemName={deck.name}
						onCommentClick={() => setIsCommentsDrawerOpen(true)}
					/>
				</div>

				{/* Primer content */}
				{primer ? (
					<article className="prose prose-gray dark:prose-invert max-w-none">
						<RichtextRenderer
							doc={primer}
							className="text-gray-700 dark:text-zinc-300"
						/>
					</article>
				) : (
					<p className="text-gray-500 dark:text-zinc-400 italic">
						No primer has been written for this deck yet.
					</p>
				)}
			</div>

			{/* Comments drawer */}
			<Drawer
				isOpen={isCommentsDrawerOpen}
				onClose={() => setIsCommentsDrawerOpen(false)}
				size="lg"
				aria-label={`Comments on ${deck.name}`}
			>
				<CommentsPanel
					subject={{
						$type: "com.deckbelcher.social.comment#recordSubject",
						ref: { uri: deckUri, cid: deckRecord.cid },
					}}
					item={{ type: "deck", uri: deckUri, cid: deckRecord.cid }}
					title={`Comments on ${deck.name}`}
					onClose={() => setIsCommentsDrawerOpen(false)}
					maxHeight="max-h-screen"
				/>
			</Drawer>
		</div>
	);
}
