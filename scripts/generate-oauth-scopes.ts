import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LEXICONS_DIR = "lexicons/com/deckbelcher";
const CLIENT_METADATA_PATH = "public/client-metadata.json";

function findRecordTypes(dir: string, nsidPrefix: string): string[] {
	const records: string[] = [];

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			records.push(...findRecordTypes(fullPath, `${nsidPrefix}.${entry}`));
		} else if (entry.endsWith(".json")) {
			const content = JSON.parse(readFileSync(fullPath, "utf-8"));
			if (content.defs?.main?.type === "record") {
				const nsid = `${nsidPrefix}.${entry.replace(".json", "")}`;
				records.push(nsid);
			}
		}
	}

	return records;
}

const recordTypes = findRecordTypes(LEXICONS_DIR, "com.deckbelcher");
const repoScopes = recordTypes.map((nsid) => `repo:${nsid}`).join(" ");
const scope = `atproto ${repoScopes}`;

console.log("Found record types:", recordTypes);
console.log("Generated scope:", scope);

const metadata = JSON.parse(readFileSync(CLIENT_METADATA_PATH, "utf-8"));
metadata.scope = scope;
writeFileSync(
	CLIENT_METADATA_PATH,
	`${JSON.stringify(metadata, null, "\t")}\n`,
);

console.log("Updated", CLIENT_METADATA_PATH);
