import type { Deck } from "@/lib/deck-types";
import { getCommanderColorIdentity } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { getPreset } from "./presets";
import { RULES, type RuleId } from "./rules";
import type {
	FormatConfig,
	RuleNumber,
	ValidationContext,
	ValidationOptions,
	ValidationResult,
	Violation,
} from "./types";

export interface ValidateDeckParams {
	deck: Deck;
	cardLookup: (id: ScryfallId) => Card | undefined;
	oracleLookup: (id: OracleId) => Card | undefined;
	getPrintings: (id: OracleId) => Card[];
	options?: ValidationOptions;
}

/**
 * Validate a deck against format rules.
 *
 * Uses the deck's format field to determine which rules to apply.
 * Returns violations grouped by card and rule for easy display.
 */
export function validateDeck(params: ValidateDeckParams): ValidationResult {
	const { deck, options = {} } = params;

	const format = deck.format;
	const preset = format ? getPreset(format) : undefined;

	if (!preset) {
		return {
			valid: true,
			violations: [],
			byCard: new Map(),
			byRule: new Map(),
		};
	}

	return validateDeckWithRules({
		...params,
		rules: preset.rules,
		config: preset.config,
		options,
	});
}

/**
 * Validate a deck with custom rules instead of format preset.
 *
 * Use this when you need to apply specific rules regardless of format,
 * or when the deck doesn't have a format set.
 */
export function validateDeckWithRules(
	params: ValidateDeckParams & {
		rules: readonly RuleId[];
		config: FormatConfig;
	},
): ValidationResult {
	const {
		deck,
		cardLookup,
		oracleLookup,
		getPrintings,
		rules,
		config,
		options = {},
	} = params;

	const commanderColors = getCommanderColorIdentity(deck, cardLookup);

	const ctx: ValidationContext = {
		deck,
		cardLookup,
		oracleLookup,
		getPrintings,
		format: deck.format,
		commanderColors,
		config: { ...config, ...options.configOverrides },
	};

	const violations: Violation[] = [];

	for (const ruleId of rules) {
		if (options.disabledRules?.has(ruleId)) continue;

		const rule = RULES[ruleId];
		if (options.disabledCategories?.has(rule.category)) continue;

		const ruleViolations = rule.validate(ctx);
		violations.push(...ruleViolations);
	}

	const validityViolations = options.includeMaybeboard
		? violations
		: violations.filter((v) => v.section !== "maybeboard");

	const hasErrors = validityViolations.some((v) => v.severity === "error");

	return {
		valid: !hasErrors,
		violations,
		byCard: groupByCard(violations),
		byRule: groupByRule(violations),
	};
}

function groupByCard(violations: Violation[]): Map<OracleId, Violation[]> {
	const map = new Map<OracleId, Violation[]>();
	for (const v of violations) {
		if (!v.oracleId) continue;
		const existing = map.get(v.oracleId) ?? [];
		existing.push(v);
		map.set(v.oracleId, existing);
	}
	return map;
}

function groupByRule(violations: Violation[]): Map<RuleNumber, Violation[]> {
	const map = new Map<RuleNumber, Violation[]>();
	for (const v of violations) {
		const existing = map.get(v.rule) ?? [];
		existing.push(v);
		map.set(v.rule, existing);
	}
	return map;
}
