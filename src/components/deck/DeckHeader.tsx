import { useState } from "react";

interface DeckHeaderProps {
	name: string;
	format?: string;
	onNameChange: (name: string) => void;
	onFormatChange: (format: string) => void;
	readOnly?: boolean;
}

export function DeckHeader({
	name,
	format,
	onNameChange,
	onFormatChange,
	readOnly = false,
}: DeckHeaderProps) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState(name);

	const handleNameClick = () => {
		if (readOnly) return;
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
			<div className="flex flex-wrap items-center gap-4">
				{isEditingName ? (
					<input
						type="text"
						value={editedName}
						onChange={(e) => setEditedName(e.target.value)}
						onBlur={handleNameSubmit}
						onKeyDown={handleNameKeyDown}
						className="text-4xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-cyan-500 focus:outline-none flex-1"
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
					>
						{name}
					</h1>
				)}

				<select
					value={format || ""}
					onChange={(e) => onFormatChange(e.target.value)}
					disabled={readOnly}
					className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
		</div>
	);
}
