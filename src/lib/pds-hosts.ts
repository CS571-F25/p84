export interface PdsHost {
	url: string;
	name: string;
	description: string;
	handles: string[];
	learnMoreUrl?: string;
	privacyUrl?: string;
	tosUrl?: string;
}

export const PDS_HOSTS: PdsHost[] = [
	{
		url: "https://selfhosted.social",
		name: "selfhosted.social",
		description: "Community-run server",
		handles: ["selfhosted.social"],
		privacyUrl: "https://selfhosted.social/legal#privacy-policy",
		tosUrl: "https://selfhosted.social/legal#terms-of-service",
	},
	{
		url: "https://bsky.social",
		name: "Bluesky",
		description: "Bluesky's default host",
		handles: ["bsky.social"],
		privacyUrl: "https://bsky.social/about/support/privacy-policy",
		tosUrl: "https://bsky.social/about/support/tos",
	},
	{
		url: "https://blacksky.app",
		name: "Blacksky",
		description: "Blacksky-run servers",
		handles: ["blacksky.app", "myatproto.social", "cryptoanarchy.network"],
		learnMoreUrl:
			"https://docs.blacksky.community/migrating-to-blacksky-pds-complete-guide#who-can-use-blacksky-services",
		privacyUrl: "https://blackskyweb.xyz/about/support/privacy-policy/",
		tosUrl: "https://blackskyweb.xyz/about/support/tos",
	},
	{
		url: "https://pds.tophhie.cloud",
		name: "tophhie.cloud",
		description: "Open registration",
		handles: ["tophhie.cloud"],
		privacyUrl: "https://blog.tophhie.cloud/atproto-privacy-policy/",
		tosUrl: "https://blog.tophhie.cloud/atproto-tos/",
	},
];

export const DEFAULT_PDS_HOST = PDS_HOSTS[0];
