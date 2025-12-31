const FORMAT_DISPLAY_NAMES: Record<string, string> = {
	commander: "Commander",
	cube: "Cube",
	pauper: "Pauper",
	paupercommander: "Pauper Commander",
	standard: "Standard",
	modern: "Modern",
	legacy: "Legacy",
	vintage: "Vintage",
};

export function formatDisplayName(format: string | undefined): string {
	if (!format) return "";
	return FORMAT_DISPLAY_NAMES[format] ?? format;
}
