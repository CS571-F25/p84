import { useState } from "react";

interface DeckHeaderProps {
	name: string;
	format?: string;
	onNameChange: (name: string) => void;
	onFormatChange: (format: string) => void;
}

export function DeckHeader({
	name,
	format,
	onNameChange,
	onFormatChange,
}: DeckHeaderProps) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState(name);

	const handleNameClick = () => {
		setEditedName(name);
		setIsEditingName(true);
	};

	const handleNameSubmit = () => {
		onNameChange(editedName || "Untitled Deck");
		setIsEditingName(false);
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleNameSubmit();
		} else if (e.key === "Escape") {
			setEditedName(name);
			setIsEditingName(false);
		}
	};

	return (
		<div className="mb-6 space-y-4">
			<div className="flex items-center gap-4">
				{isEditingName ? (
					<input
						type="text"
						value={editedName}
						onChange={(e) => setEditedName(e.target.value)}
						onBlur={handleNameSubmit}
						onKeyDown={handleNameKeyDown}
						className="text-4xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-cyan-500 focus:outline-none flex-1"
						autoFocus
					/>
				) : (
					<h1
						className="text-4xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
						onClick={handleNameClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								handleNameClick();
							}
						}}
						tabIndex={0}
					>
						{name}
					</h1>
				)}

				<select
					value={format || ""}
					onChange={(e) => onFormatChange(e.target.value)}
					className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
				>
					<option value="">No Format</option>
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

			{/* TODO: Search autocomplete will go here */}
			<div className="relative">
				<input
					type="text"
					placeholder="Search for cards to add..."
					className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
					disabled
				/>
				<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
					Card search coming soon
				</p>
			</div>
		</div>
	);
}
