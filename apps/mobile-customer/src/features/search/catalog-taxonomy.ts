import type { MessageKey } from "@bawi/i18n/translate";

import type { CategoryNode } from "@/features/discovery/services/discovery-client";

export interface BrowseChoice {
  key: string;
  labelKey: MessageKey;
  aliases: string[];
  query: string;
}

export interface BrowseAudience {
  key: string;
  labelKey: MessageKey;
  aliases: string[];
  choices: BrowseChoice[];
}

const choice = (key: string, aliases: string[], query = key): BrowseChoice => ({
  key,
  labelKey: `search.category.${key}` as MessageKey,
  aliases,
  query,
});

const shoes = choice("shoes", ["shoes", "footwear"]);
const bags = choice("bags", ["bags", "handbags"]);
const jewelry = choice("jewelry", ["jewelry", "jewellery"]);
const accessories = choice("accessories", ["accessories"]);
const tops = choice("tops", ["tops", "shirts", "t-shirts"]);
const sets = choice("sets", ["matching-sets", "sets"]);

export const BROWSE_AUDIENCES: BrowseAudience[] = [
  {
    key: "women",
    labelKey: "search.audience.women",
    aliases: ["women", "womenswear"],
    choices: [
      choice("all", ["women", "womenswear"], "women"),
      choice("newIn", ["new-in", "new-arrivals"], "new"),
      choice("dresses", ["dresses"]),
      choice("habeshaKemis", ["habesha-kemis", "habesha-wear"], "kemis"),
      tops,
      choice("bottoms", ["bottoms", "pants", "jeans"], "pants"),
      sets,
      shoes,
      bags,
      jewelry,
      accessories,
    ],
  },
  {
    key: "men",
    labelKey: "search.audience.men",
    aliases: ["men", "menswear"],
    choices: [
      choice("all", ["men", "menswear"], "men"),
      choice("newIn", ["new-in", "new-arrivals"], "new"),
      choice("shirts", ["shirts"]),
      tops,
      choice("bottoms", ["pants", "bottoms", "jeans"], "pants"),
      choice("jackets", ["jackets-sweaters", "jackets", "outerwear"], "jacket"),
      choice("habeshaWear", ["habesha-wear"], "habesha"),
      sets,
      shoes,
      bags,
      jewelry,
      accessories,
    ],
  },
  {
    key: "girls",
    labelKey: "search.audience.girls",
    aliases: ["girls", "girlswear"],
    choices: [
      choice("all", ["girls", "girlswear"], "girls"),
      choice("dresses", ["dresses"]),
      tops,
      choice("bottoms", ["bottoms", "pants", "jeans"], "pants"),
      sets,
      choice("jackets", ["jackets-sweaters", "jackets"], "jacket"),
      shoes,
      bags,
      jewelry,
      accessories,
    ],
  },
  {
    key: "boys",
    labelKey: "search.audience.boys",
    aliases: ["boys", "boyswear"],
    choices: [
      choice("all", ["boys", "boyswear"], "boys"),
      choice("shirts", ["shirts"]),
      tops,
      choice("bottoms", ["bottoms", "pants", "jeans"], "pants"),
      sets,
      choice("jackets", ["jackets-sweaters", "jackets"], "jacket"),
      shoes,
      bags,
      accessories,
    ],
  },
  {
    key: "baby",
    labelKey: "search.audience.baby",
    aliases: ["baby", "babies", "babywear"],
    choices: [
      choice("all", ["baby", "babies", "babywear"], "baby"),
      choice("onePieces", ["one-pieces", "onesies", "rompers", "jumpsuits"], "onesie"),
      sets,
      tops,
      choice("bottoms", ["bottoms", "pants"], "pants"),
      choice("sleepwear", ["sleepwear", "lingerie-sleep"], "sleepwear"),
      shoes,
      accessories,
    ],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Use a real audience subtree when present; avoid mapping children's wear to adult flat categories. */
export function findBrowseCategory(
  categories: CategoryNode[],
  audience: BrowseAudience,
  item: BrowseChoice
): CategoryNode | undefined {
  const all = flatten(categories);
  const audienceRoot = all.find((node) => audience.aliases.includes(normalize(node.handle)));
  if (item.key === "all") return audienceRoot;
  if (audienceRoot?.children.length) {
    return flatten(audienceRoot.children).find((node) => item.aliases.includes(normalize(node.handle)));
  }
  if (["girls", "boys", "baby"].includes(audience.key)) return undefined;
  return all.find((node) => item.aliases.includes(normalize(node.handle)));
}
