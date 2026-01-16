import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RuleId } from "@/lib/deck-validation";
import {
	RULES,
	type ValidationResult,
	type Violation,
} from "@/lib/deck-validation";

interface ValidationBadgeProps {
	result: ValidationResult | null;
}

export function ValidationBadge({ result }: ValidationBadgeProps) {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	if (!result || result.violations.length === 0) return null;

	const errors = result.violations.filter((v) => v.severity === "error");
	const warnings = result.violations.filter((v) => v.severity === "warning");
	const hasErrors = errors.length > 0;

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${
					hasErrors
						? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
						: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
				}`}
			>
				{hasErrors ? (
					<XCircle className="w-4 h-4" />
				) : (
					<AlertTriangle className="w-4 h-4" />
				)}
				{result.violations.length} issue
				{result.violations.length !== 1 && "s"}
				<ChevronDown
					className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 mt-1 w-[28rem] max-h-[32rem] overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50">
					<div className="p-3 space-y-3">
						{errors.length > 0 && (
							<ViolationGroup
								title="Errors"
								violations={errors}
								icon={<XCircle className="w-4 h-4 text-red-500" />}
							/>
						)}
						{warnings.length > 0 && (
							<ViolationGroup
								title="Warnings"
								violations={warnings}
								icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function ViolationGroup({
	title,
	violations,
	icon,
}: {
	title: string;
	violations: Violation[];
	icon: React.ReactNode;
}) {
	return (
		<div>
			<div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white mb-1.5">
				{icon}
				{title} ({violations.length})
			</div>
			<ul className="space-y-1">
				{violations.map((v, i) => (
					<ViolationItem
						key={`${v.rule}-${v.oracleId ?? ""}-${i}`}
						violation={v}
					/>
				))}
			</ul>
		</div>
	);
}

function ViolationItem({ violation }: { violation: Violation }) {
	const [isExpanded, setIsExpanded] = useState(false);

	const rule = RULES[violation.ruleId as RuleId];
	const ruleText = rule?.ruleText;

	return (
		<li className="text-sm text-gray-600 dark:text-gray-400">
			<button
				type="button"
				onClick={() => ruleText && setIsExpanded(!isExpanded)}
				className={`flex items-start gap-1 text-left w-full ${ruleText ? "cursor-pointer hover:text-gray-900 dark:hover:text-gray-200" : "cursor-default"}`}
			>
				{ruleText ? (
					<ChevronRight
						className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
					/>
				) : (
					<span className="w-4" />
				)}
				<span>
					<span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-1.5">
						[{violation.rule}]
					</span>
					{violation.message}
				</span>
			</button>
			{isExpanded && ruleText && (
				<div className="ml-5 mt-1.5 pl-3 border-l-2 border-gray-200 dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400 italic">
					{ruleText}
				</div>
			)}
		</li>
	);
}
