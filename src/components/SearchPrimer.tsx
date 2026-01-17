import { Link } from "@tanstack/react-router";
import { CardSymbol } from "./CardSymbol";

function Code({ children }: { children: React.ReactNode }) {
	return (
		<code className="font-mono text-sm bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200">
			{children}
		</code>
	);
}

function Q({ q }: { q: string }) {
	return (
		<Link
			to="/cards"
			search={{ q, sort: undefined, sort2: undefined }}
			className="font-mono text-sm bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
		>
			{q}
		</Link>
	);
}

function MainCard({
	title,
	children,
	className = "",
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 ${className}`}
		>
			<h3 className="font-semibold text-gray-900 dark:text-white mb-2">
				{title}
			</h3>
			{children}
		</div>
	);
}

function SecondaryCard({
	title,
	children,
	className = "",
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`bg-gray-50/50 dark:bg-slate-800/30 border border-gray-200/50 dark:border-slate-700/50 rounded-lg p-3 ${className}`}
		>
			<h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
				{title}
			</h4>
			{children}
		</div>
	);
}

function Mana({ s }: { s: string }) {
	return (
		<CardSymbol symbol={s} size="text" className="inline align-[-0.125em]" />
	);
}

export function SearchPrimer() {
	return (
		<div className="space-y-4">
			{/* Intro blurb */}
			<div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
				<p>
					Type anything to search by name—we'll find close matches even with
					typos.
				</p>
				<p>
					Use <Code>field:value</Code> syntax for precise filtering. Multiple
					filters are combined with AND.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{/* Fields with examples */}
				<MainCard title="Filter by...">
					<ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						<li>
							<Q q="t:vampire" /> type
						</li>
						<li>
							<Q q='o:"draw a card"' /> rules text
						</li>
						<li>
							<Q q="mv<=3" /> mana value
						</li>
						<li>
							<Q q="power>=4" /> power
						</li>
						<li>
							<Q q="r:mythic" /> rarity
						</li>
						<li>
							<Q q="s:mh3" /> set code
						</li>
						<li>
							<Q q="f:modern" /> format legal
						</li>
						<li>
							<Q q="loyalty>=5" /> loyalty
						</li>
						<li>
							<Q q="name:dragon" /> name contains
						</li>
					</ul>
				</MainCard>

				{/* Operators */}
				<MainCard title="Comparisons">
					<ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						<li>
							<Q q="manavalue<3" /> less than
						</li>
						<li>
							<Q q="manavalue>=5" /> at least
						</li>
						<li>
							<Q q="power>5" /> greater than
						</li>
						<li>
							<Q q="toughness<=2" /> at most
						</li>
						<li>
							<Q q="o:/\{(.)\}\{\1\}/" /> regex w/ backrefs
						</li>
					</ul>
				</MainCard>

				{/* Colors - clearer framing */}
				<MainCard title="Colors" className="sm:row-span-2 lg:row-span-1">
					<div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
						{/* Color codes */}
						<div className="flex flex-wrap gap-x-3 gap-y-1">
							<span>
								<Mana s="W" /> <span className="font-black">w</span>hite
							</span>
							<span>
								<Mana s="U" /> bl<span className="font-black">u</span>e
							</span>
							<span>
								<Mana s="B" /> <span className="font-black">b</span>lack
							</span>
							<span>
								<Mana s="R" /> <span className="font-black">r</span>ed
							</span>
							<span>
								<Mana s="G" /> <span className="font-black">g</span>reen
							</span>
							<span>
								<Mana s="C" /> <span className="font-black">c</span>olorless
							</span>
						</div>

						{/* Card's colors */}
						<div>
							<p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-1">
								Card's colors
							</p>
							<p>
								<Q q="c:ug" /> is both <Mana s="U" /> and <Mana s="G" />
							</p>
							<p>
								<Q q="c=r" /> is exactly <Mana s="R" /> (mono-red)
							</p>
						</div>

						{/* Color identity for commander */}
						<div>
							<p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide mb-1">
								For commander decks
							</p>
							<p>
								<Q q="id<=wu" /> goes in <Mana s="W" />
								<Mana s="U" /> decks
							</p>
							<p>
								<Q q="id>=2 is:commander" /> 2+ color commanders
							</p>
							<p>
								<Q q="id>=rw is:paupercommander" /> PEDH in <Mana s="R" />
								<Mana s="W" />
							</p>
						</div>
					</div>
				</MainCard>

				{/* Combining */}
				<MainCard title="Combining Filters">
					<ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						<li>
							<Q q="t:goblin r:rare" /> both (AND)
						</li>
						<li>
							<Q q="t:elf OR t:druid" /> either
						</li>
						<li>
							<Q q="t:creature -c:g" /> exclude (NOT)
						</li>
						<li>
							<Q q="c:u (t:instant OR t:sorcery)" /> grouping
						</li>
					</ul>
				</MainCard>

				{/* Secondary cards - dimmer, just clickable queries */}
				<SecondaryCard title="Land Types">
					<div className="flex flex-wrap gap-1.5 text-sm">
						<Q q="is:fetchland" />
						<Q q="is:shockland" />
						<Q q="is:dual" />
						<Q q="is:triome" />
						<Q q="is:checkland" />
						<Q q="is:fastland" />
						<Q q="is:painland" />
						<Q q="is:manland" />
					</div>
				</SecondaryCard>

				<SecondaryCard title="Card Traits" className="sm:row-span-2">
					<div className="flex flex-wrap gap-1.5 text-sm">
						<Q q="is:commander" />
						<Q q="is:legendary" />
						<Q q="is:historic" />
						<Q q="is:permanent" />
						<Q q="is:spell" />
						<Q q="is:modal" />
						<Q q="is:spree" />
						<Q q="is:vanilla" />
						<Q q="is:frenchvanilla" />
						<Q q="is:bear" />
						<Q q="is:mdfc" />
						<Q q="is:dfc" />
						<Q q="is:transform" />
						<Q q="is:meld" />
						<Q q="is:saga" />
						<Q q="is:adventure" />
						<Q q="is:split" />
						<Q q="is:flip" />
						<Q q="is:battle" />
						<Q q="is:prototype" />
						<Q q="is:leveler" />
						<Q q="is:party" />
						<Q q="is:outlaw" />
						<Q q="is:snow" />
						<Q q="is:reserved" />
					</div>
				</SecondaryCard>

				<SecondaryCard title="Printings">
					<div className="flex flex-wrap gap-1.5 text-sm">
						<Q q="is:showcase" />
						<Q q="is:borderless" />
						<Q q="is:retro" />
						<Q q="is:foil" />
						<Q q="is:extended" />
						<Q q="is:promo" />
					</div>
				</SecondaryCard>

				<SecondaryCard title="Advanced">
					<div className="flex flex-wrap gap-1.5 text-sm">
						<Q q='!"Abzan Battle Priest"' />
						<Q q='"Aether M"' />
						<Q q="year>=2024" />
						<Q q="frame:2015" />
					</div>
				</SecondaryCard>
			</div>
		</div>
	);
}
