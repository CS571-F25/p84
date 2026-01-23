import { Search } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface InputHighlight {
	start: number;
	end: number;
	className?: string;
}

export interface InputError {
	message: string;
	start: number;
	end: number;
}

interface HighlightedSearchInputProps {
	defaultValue?: string;
	highlights?: InputHighlight[];
	errors?: InputError[];
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}

export interface HighlightedSearchInputHandle {
	focus: () => void;
	value: string;
	setValue: (value: string) => void;
}

export const HighlightedSearchInput = forwardRef<
	HighlightedSearchInputHandle,
	HighlightedSearchInputProps
>(function HighlightedSearchInput(
	{
		defaultValue = "",
		highlights = [],
		errors = [],
		onChange,
		placeholder,
		className = "",
	},
	ref,
) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [text, setText] = useState(defaultValue);

	useImperativeHandle(ref, () => ({
		focus: () => inputRef.current?.focus(),
		get value() {
			return inputRef.current?.value ?? "";
		},
		setValue: (value: string) => {
			if (inputRef.current) {
				inputRef.current.value = value;
				setText(value);
			}
		},
	}));

	const hasError = errors.length > 0;

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setText(e.target.value);
		onChange(e.target.value);
	};

	// Combine all highlights - passed-in and errors
	const allHighlights = [
		...highlights,
		...errors.map((err) => ({
			start: err.start,
			end: err.end,
			className: "bg-red-200 dark:bg-red-900/60",
		})),
	];

	return (
		<div
			className={`relative flex items-center rounded-lg border transition-colors bg-gray-100 dark:bg-zinc-800 ${
				hasError
					? "border-red-500"
					: "border-gray-300 dark:border-zinc-600 focus-within:border-cyan-500"
			} ${className}`}
		>
			{/* Search icon - fixed, doesn't scroll */}
			<div className="flex-shrink-0 pl-4">
				<Search className="w-5 h-5 text-gray-400" />
			</div>

			{/* Scrollable area - hidden scrollbar */}
			<div className="flex-1 overflow-x-auto scrollbar-none">
				<div
					className="relative font-mono"
					style={{ minWidth: `calc(${Math.max(text.length, 20)}ch + 1.5rem)` }}
				>
					{/* Highlight underlay - background colors at ch positions */}
					{allHighlights.length > 0 &&
						allHighlights.map((hl) => (
							<span
								key={`${hl.start}-${hl.end}`}
								className={`absolute top-1/2 -translate-y-1/2 h-[1.2em] rounded-sm pointer-events-none ${hl.className ?? ""}`}
								style={{
									left: `calc(${hl.start}ch + 0.75rem)`,
									width: `${hl.end - hl.start}ch`,
								}}
								aria-hidden="true"
							/>
						))}

					{/* Input - visible text, transparent background */}
					<input
						ref={inputRef}
						type="text"
						placeholder={placeholder}
						defaultValue={defaultValue}
						onChange={handleChange}
						className="relative w-full font-mono px-3 py-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
					/>
				</div>
			</div>
		</div>
	);
});
