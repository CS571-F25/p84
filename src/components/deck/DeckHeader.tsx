import type { Did } from "@atcute/lexicons";
import { useState } from "react";
import { HandleLink } from "@/components/HandleLink";
import { FORMAT_GROUPS } from "@/lib/format-utils";

interface DeckHeaderProps {
	name: string;
	format?: string;
	onNameChange: (name: string) => void;
	onFormatChange: (format: string) => void;
	readOnly?: boolean;
	/** Owner DID - when provided, shows "by @handle" under the title */
	did?: Did;
}

export function DeckHeader({
	name,
	format,
	onNameChange,
	onFormatChange,
	readOnly = false,
	did,
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
		<div className="mb-4">
			<div className="flex flex-wrap items-center gap-4">
				{isEditingName ? (
					<input
						type="text"
						value={editedName}
						onChange={(e) => setEditedName(e.target.value)}
						onBlur={handleNameSubmit}
						onKeyDown={handleNameKeyDown}
						className="text-4xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-cyan-500 focus:outline-none flex-1 font-display"
					/>
				) : (
					<h1
						className={`text-4xl font-bold text-gray-900 dark:text-white font-display ${!readOnly ? "cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors" : ""}`}
						onClick={handleNameClick}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								handleNameClick();
							}
						}}
						tabIndex={!readOnly ? 0 : undefined}
						role={!readOnly ? "button" : undefined}
					>
						{name}
					</h1>
				)}

				<select
					aria-label="Deck format"
					value={format || ""}
					onChange={(e) => onFormatChange(e.target.value)}
					disabled={readOnly}
					className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<option value="">No Format</option>
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
			{did && (
				<p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
					<HandleLink did={did} prefix="by" />
				</p>
			)}
		</div>
	);
}
