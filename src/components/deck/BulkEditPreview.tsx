import { AlertCircle } from "lucide-react";
import { useCardHover } from "@/components/HoverCardPreview";
import { ManaCost } from "@/components/ManaCost";
import { getPrimaryFace } from "@/lib/card-faces";
import type { Card, ScryfallId } from "@/lib/scryfall-types";

export type PreviewLine =
	| { type: "empty"; lineKey: string }
	| { type: "pending"; lineKey: string; name: string }
	| {
			type: "resolved";
			lineKey: string;
			scryfallId: ScryfallId;
			quantity: number;
			cardData: Card;
			isNew?: boolean;
			isImperfect?: boolean;
	  }
	| { type: "error"; lineKey: string; message: string };

interface BulkEditPreviewProps {
	lines: PreviewLine[];
}

export function BulkEditPreview({ lines }: BulkEditPreviewProps) {
	return (
		<div className="flex-1 p-4 border-l border-gray-200 dark:border-slate-700">
			{lines.map((line) => (
				<PreviewRow key={line.lineKey} line={line} />
			))}
		</div>
	);
}

const ROW_CLASS =
	"font-mono text-sm leading-[1.5] whitespace-nowrap [font-variant-ligatures:none]";

function PreviewRow({ line }: { line: PreviewLine }) {
	switch (line.type) {
		case "empty":
			return <div className={ROW_CLASS}>&nbsp;</div>;

		case "pending":
			return (
				<div className={ROW_CLASS}>
					<span className="text-gray-400 dark:text-gray-500 italic truncate">
						{line.name}...
					</span>
				</div>
			);

		case "error":
			return (
				<div className={`${ROW_CLASS} flex items-center gap-2`}>
					<AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
					<span className="text-red-600 dark:text-red-400 truncate">
						{line.message}
					</span>
				</div>
			);

		case "resolved":
			return <ResolvedCardRow line={line} />;
	}
}

function ResolvedCardRow({
	line,
}: {
	line: Extract<PreviewLine, { type: "resolved" }>;
}) {
	const hoverProps = useCardHover(line.scryfallId);
	const primaryFace = getPrimaryFace(line.cardData);

	const bgClass = line.isImperfect
		? "bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
		: line.isNew
			? "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
			: "hover:bg-gray-100 dark:hover:bg-slate-800";

	return (
		<div
			className={`${ROW_CLASS} flex items-center gap-2 cursor-default rounded px-1 -mx-1 ${bgClass}`}
			{...hoverProps}
		>
			<span className="text-gray-600 dark:text-gray-400 text-xs w-4 text-right flex-shrink-0">
				{line.quantity}
			</span>
			<span className="text-gray-900 dark:text-white truncate flex-1 min-w-0">
				{primaryFace?.name ?? "Unknown"}
			</span>
			<div className="flex-shrink-0 flex items-center ml-auto">
				{primaryFace?.mana_cost && (
					<ManaCost cost={primaryFace.mana_cost} size="small" />
				)}
			</div>
		</div>
	);
}
