import type { CategoryNode } from "@/features/discovery/services/discovery-client";
import { BROWSE_AUDIENCES, findBrowseCategory } from "@/features/search/catalog-taxonomy";

const category = (id: string, handle: string, children: CategoryNode[] = []): CategoryNode => ({
  id,
  name: handle,
  handle,
  parent_category_id: null,
  children,
});

const audience = (key: string) => BROWSE_AUDIENCES.find((entry) => entry.key === key)!;
const choice = (key: string, group: string) => audience(group).choices.find((entry) => entry.key === key)!;

describe("Search department category matching", () => {
  it("uses a matching category inside the selected audience tree", () => {
    const categories = [
      category("women", "women", [category("women-shoes", "shoes")]),
      category("men", "men", [category("men-shoes", "shoes")]),
      category("global-shoes", "shoes"),
    ];
    expect(findBrowseCategory(categories, audience("women"), choice("shoes", "women"))?.id).toBe("women-shoes");
    expect(findBrowseCategory(categories, audience("men"), choice("shoes", "men"))?.id).toBe("men-shoes");
  });

  it("keeps girls, boys, and baby browsing separate from adult categories", () => {
    const categories = [category("adult-dresses", "dresses"), category("kids", "kids")];
    expect(BROWSE_AUDIENCES.map((entry) => entry.key)).toEqual(["women", "men", "girls", "boys", "baby"]);
    expect(findBrowseCategory(categories, audience("girls"), choice("dresses", "girls"))).toBeUndefined();
    expect(findBrowseCategory(categories, audience("boys"), choice("shoes", "boys"))).toBeUndefined();
    expect(findBrowseCategory(categories, audience("baby"), choice("shoes", "baby"))).toBeUndefined();
  });

  it("maps a curated Habesha kemis choice to the existing flat Habesha Wear category", () => {
    const categories = [category("women", "women"), category("habesha", "habesha-wear")];
    expect(findBrowseCategory(categories, audience("women"), choice("habeshaKemis", "women"))?.id).toBe("habesha");
  });
});
