import { useEffect, useState } from "react";

interface ClientDateProps {
	dateString: string;
	className?: string;
}

export function ClientDate({ dateString, className }: ClientDateProps) {
	const [formatted, setFormatted] = useState<string | null>(null);

	useEffect(() => {
		setFormatted(new Date(dateString).toLocaleDateString());
	}, [dateString]);

	if (formatted === null) {
		return (
			<span className={className}>
				<span
					className="inline-block align-middle bg-gray-200 dark:bg-slate-700 rounded animate-pulse"
					style={{ width: "5.5em", height: "0.75em" }}
				/>
			</span>
		);
	}

	return <span className={className}>{formatted}</span>;
}
