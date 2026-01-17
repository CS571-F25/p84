import { useEffect, useState } from "react";

interface ClientDateProps {
	dateString: string;
	className?: string;
	format?: "date" | "relative";
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.round(diffMs / 1000);
	const diffMins = Math.round(diffMs / 60000);
	const diffHours = Math.round(diffMs / 3600000);
	const diffDays = Math.round(diffMs / 86400000);

	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

	if (Math.abs(diffSecs) < 60) return rtf.format(-diffSecs, "second");
	if (Math.abs(diffMins) < 60) return rtf.format(-diffMins, "minute");
	if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");
	if (Math.abs(diffDays) < 30) return rtf.format(-diffDays, "day");
	return date.toLocaleDateString();
}

export function ClientDate({
	dateString,
	className,
	format = "date",
}: ClientDateProps) {
	const [formatted, setFormatted] = useState<string | null>(null);

	useEffect(() => {
		const date = new Date(dateString);
		setFormatted(
			format === "relative"
				? formatRelativeTime(date)
				: date.toLocaleDateString(),
		);
	}, [dateString, format]);

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
