import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useCreateDeckMutation } from "@/lib/deck-queries";

export const Route = createFileRoute("/deck/new")({
	component: NewDeckPage,
});

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
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-2xl mx-auto px-6 py-16">
				<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
					Create New Deck
				</h1>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor={nameId}
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Deck Name
						</label>
						<input
							id={nameId}
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Enter deck name..."
							className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
						/>
					</div>

					<div>
						<label
							htmlFor={formatId}
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Format
						</label>
						<select
							id={formatId}
							value={format}
							onChange={(e) => setFormat(e.target.value)}
							className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
						>
							<option value="commander">Commander</option>
							<option value="cube">Cube</option>
							<option value="pauper">Pauper</option>
							<option value="paupercommander">Pauper Commander (PDH)</option>
							<option value="standard">Standard</option>
							<option value="modern">Modern</option>
							<option value="legacy">Legacy</option>
							<option value="vintage">Vintage</option>
						</select>
					</div>

					{/* TODO: Add commander selection if format is commander/paupercommander */}

					<div className="flex gap-4 pt-4">
						<button
							type="submit"
							disabled={mutation.isPending || !name.trim()}
							className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
						>
							{mutation.isPending ? "Creating..." : "Create Deck"}
						</button>
						<button
							type="button"
							onClick={() => navigate({ to: "/" })}
							className="px-6 py-3 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
