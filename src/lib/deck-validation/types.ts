import type { Deck, Section } from "@/lib/deck-types";
import type {
	Card,
	ManaColor,
	OracleId,
	ScryfallId,
} from "@/lib/scryfall-types";

/**
 * MTG Comprehensive Rules citation (e.g., "100.2a", "903.5c")
 * Branded type for type safety
 */
export type RuleNumber = string & { readonly __brand: "RuleNumber" };

export function asRuleNumber(rule: string): RuleNumber {
	return rule as RuleNumber;
}

/**
 * Categories for grouping related rules
 */
export type RuleCategory = "legality" | "quantity" | "identity" | "structure";

/**
 * Severity level for violations
 */
export type Severity = "error" | "warning";

/**
 * A single rule violation with context
 */
export interface Violation {
	ruleId: string;
	rule: RuleNumber;
	category: RuleCategory;
	cardName?: string;
	oracleId?: OracleId;
	section?: Section;
	quantity?: number;
	message: string;
	severity: Severity;
}

/**
 * Result of validating a deck
 */
export interface ValidationResult {
	valid: boolean;
	violations: Violation[];
	byCard: Map<OracleId, Violation[]>;
	byRule: Map<RuleNumber, Violation[]>;
}

/**
 * Context passed to rule validators
 */
export interface ValidationContext {
	deck: Deck;
	cardLookup: (id: ScryfallId) => Card | undefined;
	oracleLookup: (id: OracleId) => Card | undefined;
	getPrintings: (id: OracleId) => Card[];
	format: string | undefined;
	commanderColors: ManaColor[] | undefined;
	config: FormatConfig;
}

/**
 * Per-format configuration parameters
 */
export interface FormatConfig {
	legalityField: string;
	minDeckSize?: number;
	deckSize?: number;
	sideboardSize?: number;
}

/**
 * Rule definition
 */
export interface Rule<Id extends string = string> {
	id: Id;
	rule: RuleNumber;
	category: RuleCategory;
	description: string;
	validate: (ctx: ValidationContext) => Violation[];
}

/**
 * Options for validation
 */
export interface ValidationOptions {
	disabledRules?: Set<string>;
	disabledCategories?: Set<RuleCategory>;
	configOverrides?: Partial<FormatConfig>;
	includeMaybeboard?: boolean;
}

/**
 * Format preset combining rules and config
 */
export interface Preset<RuleId extends string = string> {
	rules: readonly RuleId[];
	config: FormatConfig;
}

/**
 * Helper to create a violation
 */
export function violation(
	rule: Rule,
	message: string,
	severity: Severity,
	context?: {
		cardName?: string;
		oracleId?: OracleId;
		section?: Section;
		quantity?: number;
	},
): Violation {
	return {
		ruleId: rule.id,
		rule: rule.rule,
		category: rule.category,
		message,
		severity,
		...context,
	};
}
