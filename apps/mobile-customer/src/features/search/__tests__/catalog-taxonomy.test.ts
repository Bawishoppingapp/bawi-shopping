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

  it("does not send baby and kids departments to unrelated adult categories", () => {
    const categories = [category("adult-dresses", "dresses"), category("kids", "kids")];
    expect(findBrowseCategory(categories, audience("girls"), choice("dresses", "girls"))).toBeUndefined();
    expect(findBrowseCategory(categories, audience("baby"), choice("shoes", "baby"))).toBeUndefined();
    expect(findBrowseCategory(categories, audience("kids"), choice("dresses", "kids"))).toBeUndefined();
    expect(findBrowseCategory(categories, audience("kids"), choice("all", "kids"))?.id).toBe("kids");
  });

  it("maps a curated Habesha kemis choice to the existing flat Habesha Wear category", () => {
    const categories = [category("women", "women"), category("habesha", "habesha-wear")];
    expect(findBrowseCategory(categories, audience("women"), choice("habeshaKemis", "women"))?.id).toBe("habesha");
  });
});
