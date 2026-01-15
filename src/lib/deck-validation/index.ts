// Main API

export type { CopyException } from "./exceptions";
// Exception detection
export {
	detectCopyException,
	getCopyLimit,
	isBasicLand,
} from "./exceptions";
export type { FormatId } from "./presets";

// Presets
export { getFormatConfig, getPreset, PRESETS } from "./presets";
export type { RuleId } from "./rules";

// Rules
export { RULES } from "./rules";
// Types
export type {
	FormatConfig,
	Preset,
	Rule,
	RuleCategory,
	RuleNumber,
	Severity,
	ValidationContext,
	ValidationOptions,
	ValidationResult,
	Violation,
} from "./types";
export { asRuleNumber, violation } from "./types";
export type { ValidateDeckParams } from "./validate";
export { validateDeck, validateDeckWithRules } from "./validate";
