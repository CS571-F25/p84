import { useId, useRef, useState } from "react";

interface TagAutocompleteProps {
	suggestions: string[];
	onAdd: (tag: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

export function TagAutocomplete({
	suggestions,
	onAdd,
	disabled = false,
	placeholder = "Add tag...",
}: TagAutocompleteProps) {
	const [value, setValue] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const listboxId = useId();

	const filtered = value.trim()
		? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
		: [];

	const showDropdown = isOpen && filtered.length > 0;

	const handleInputChange = (newValue: string) => {
		setValue(newValue);
		setSelectedIndex(0);
		setIsOpen(true);
	};

	const handleAdd = (tag: string) => {
		const trimmed = tag.trim();
		if (trimmed) {
			onAdd(trimmed);
			setValue("");
			setIsOpen(false);
		}
	};

	const handleBlur = (e: React.FocusEvent) => {
		// Only close if focus leaves the entire component
		if (!containerRef.current?.contains(e.relatedTarget)) {
			setIsOpen(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!showDropdown) {
			if (e.key === "Enter") {
				e.preventDefault();
				handleAdd(value);
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				handleAdd(filtered[selectedIndex]);
				break;
			case "Escape":
				e.preventDefault();
				setIsOpen(false);
				break;
		}
	};

	const activeDescendant = showDropdown
		? `${listboxId}-option-${selectedIndex}`
		: undefined;

	return (
		<div ref={containerRef} className="relative flex-1">
			<div className="flex gap-2">
				<input
					type="text"
					role="combobox"
					aria-expanded={showDropdown}
					aria-controls={listboxId}
					aria-activedescendant={activeDescendant}
					aria-autocomplete="list"
					value={value}
					onChange={(e) => handleInputChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsOpen(true)}
					onBlur={handleBlur}
					placeholder={placeholder}
					disabled={disabled}
					className="flex-1 px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
				/>
				<button
					type="button"
					onClick={() => handleAdd(value)}
					disabled={disabled}
					className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-gray-400 disabled:cursor-not-allowed text-gray-900 rounded-lg transition-colors"
				>
					Add
				</button>
			</div>

			{showDropdown && (
				<div
					id={listboxId}
					role="listbox"
					className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
				>
					{filtered.map((tag, i) => (
						<div
							key={tag}
							id={`${listboxId}-option-${i}`}
							role="option"
							aria-selected={i === selectedIndex}
							tabIndex={-1}
							onMouseDown={(e) => {
								e.preventDefault();
								handleAdd(tag);
							}}
							className={`px-3 py-2 text-sm cursor-pointer ${
								i === selectedIndex
									? "bg-cyan-100 dark:bg-cyan-900 text-cyan-900 dark:text-cyan-100"
									: "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700"
							}`}
						>
							{tag}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
