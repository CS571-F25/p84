import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Box, Layers, ScrollText, Sparkles, Sword, User } from "lucide-react";
import { useId, useState } from "react";
import { useCreateDeckMutation } from "@/lib/deck-queries";
import {
	type CommanderType,
	FORMAT_GROUPS,
	formatDisplayName,
	getFormatInfo,
} from "@/lib/format-utils";

export const Route = createFileRoute("/deck/new")({
	component: NewDeckPage,
	head: () => ({
		meta: [
			{ title: "new deck | deck belcher" },
			{ property: "og:title", content: "new deck | deck belcher" },
			{ property: "og:image", content: "/logo512-maskable.png" },
			{ property: "og:image:width", content: "512" },
			{ property: "og:image:height", content: "512" },
			{ name: "twitter:card", content: "summary" },
			{ name: "twitter:title", content: "new deck | deck belcher" },
			{ name: "twitter:image", content: "/logo512-maskable.png" },
		],
	}),
});

function getCommanderLabel(type: CommanderType): string {
	switch (type) {
		case "oathbreaker":
			return "Oathbreaker";
		case "brawl":
			return "Brawl Commander";
		case "pauper":
			return "PDH Commander";
		case "commander":
			return "Commander";
		default:
			return "Commander";
	}
}

function getCommanderHint(type: CommanderType): string {
	switch (type) {
		case "oathbreaker":
			return "You'll add your planeswalker and signature spell in the deck editor.";
		case "brawl":
			return "You'll add your commander in the deck editor.";
		case "pauper":
			return "You'll add your uncommon commander in the deck editor.";
		case "commander":
			return "You'll add your commander(s) in the deck editor.";
		default:
			return "";
	}
}

function FormatInfoCard({ format }: { format: string }) {
	const info = getFormatInfo(format);
	const displayName = formatDisplayName(format);

	// Cube gets special treatment
	if (info.isCube) {
		return (
			<div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl p-6">
				<div className="flex items-baseline justify-between gap-4 mb-4">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
						{displayName}
					</h3>
					{info.tagline && (
						<span className="text-sm text-gray-500 dark:text-zinc-300 whitespace-nowrap">
							{info.tagline}
						</span>
					)}
				</div>

				<div className="flex flex-wrap gap-3 mb-4">
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full">
						<Box className="w-4 h-4" />
						Custom size
					</span>
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full">
						<User className="w-4 h-4" />
						Singleton
					</span>
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-full">
						<Sparkles className="w-4 h-4" />
						Custom rules
					</span>
				</div>

				<p className="text-sm text-gray-600 dark:text-zinc-300">
					Set your own rules for deck size, card pool, and restrictions.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-xl p-6">
			<div className="flex items-baseline justify-between gap-4 mb-4">
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
					{displayName}
				</h3>
				{info.tagline && (
					<span className="text-sm text-gray-500 dark:text-zinc-300 whitespace-nowrap">
						{info.tagline}
					</span>
				)}
			</div>

			<div className="flex flex-wrap gap-3 mb-4">
				<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-sm font-medium rounded-full">
					<Layers className="w-4 h-4" />
					{info.deckSize} cards
				</span>

				<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-full">
					<User className="w-4 h-4" />
					{info.singleton ? "Singleton" : "Up to 4 copies"}
				</span>

				{info.commanderType && (
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-full">
						<Sword className="w-4 h-4" />
						{getCommanderLabel(info.commanderType)}
					</span>
				)}

				{info.hasSignatureSpell && (
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-medium rounded-full">
						<ScrollText className="w-4 h-4" />
						Signature Spell
					</span>
				)}

				{info.hasSideboard && (
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-700/50 text-slate-600 dark:text-zinc-300 text-sm font-medium rounded-full">
						15-card sideboard
					</span>
				)}
			</div>

			{info.commanderType && (
				<p className="text-sm text-gray-600 dark:text-zinc-300">
					{getCommanderHint(info.commanderType)}
				</p>
			)}
		</div>
	);
}

function NewDeckPage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [format, setFormat] = useState<string>("commander");
	const nameId = useId();
	const formatId = useId();

	const mutation = useCreateDeckMutation();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!name.trim()) return;

		mutation.mutate({
			name: name.trim(),
			format: format || undefined,
			cards: [],
		});
	};

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<div className="max-w-xl mx-auto px-6 py-16">
				<div className="text-center mb-10">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
						New Deck
					</h1>
					<p className="text-gray-600 dark:text-zinc-300">
						Choose a format and give your deck a name
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor={nameId}
							className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2"
						>
							Deck Name
						</label>
						<input
							id={nameId}
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Untitled Deck"
							autoComplete="off"
							className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
						/>
					</div>

					<div>
						<label
							htmlFor={formatId}
							className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2"
						>
							Format
						</label>
						<select
							id={formatId}
							value={format}
							onChange={(e) => setFormat(e.target.value)}
							className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
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

					<FormatInfoCard format={format} />

					<div className="flex gap-4 pt-2">
						<button
							type="submit"
							disabled={mutation.isPending || !name.trim()}
							className="flex-1 px-6 py-3 bg-cyan-400 hover:bg-cyan-300 disabled:bg-gray-400 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed text-gray-900 font-medium rounded-lg transition-colors"
						>
							{mutation.isPending ? "Creating..." : "Create Deck"}
						</button>
						<button
							type="button"
							onClick={() => navigate({ to: "/" })}
							className="px-6 py-3 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
						>
							Cancel
						</button>
					</div>

					<div className="text-center pt-4 border-t border-gray-200 dark:border-zinc-700 mt-4">
						<span className="text-gray-500 dark:text-zinc-400 text-sm">
							Have a deck list?{" "}
							<Link
								to="/deck/import"
								search={{ format }}
								className="text-cyan-600 dark:text-cyan-400 hover:underline"
							>
								Import it
							</Link>
						</span>
					</div>
				</form>
			</div>
		</div>
	);
}
