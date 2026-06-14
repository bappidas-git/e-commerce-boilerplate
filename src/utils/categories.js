// =============================================================================
// Category helpers — single source of truth for the storefront category system
// =============================================================================
//
// Every storefront entry point that links to the product listing (the header
// top menu, the "All Categories" dropdown, the mobile sidebar, the homepage
// "Shop by Category" cards, the hero category bar and the product breadcrumb)
// builds its `?category=` link through `categoryParam()` here, and the listing
// page resolves the param back to a category through `resolveCategory()`. That
// keeps ONE canonical URL scheme across the whole app so a category expressed in
// one place can always be understood in another.
//
// CANONICAL URL SCHEME = SLUG  (e.g. /products?category=home-garden)
// ------------------------------------------------------------------
// Slugs make for readable, shareable URLs and never change when ids are
// reseeded. The numeric id is only ever used as a defensive fallback for a
// category that is somehow missing a slug, and the listing page still resolves
// a legacy numeric-id deep link (?category=3) for backward compatibility,
// rewriting it to the slug form in place.
// =============================================================================

/**
 * Build the canonical `?category=` token for a category. Returns the slug
 * (preferred) and falls back to the numeric id only when no slug exists.
 */
export const categoryParam = (cat) => {
  if (!cat) return "";
  return String(cat.slug || cat.id || "");
};

/**
 * Resolve a `?category=` token — a slug OR a legacy numeric id — to its category
 * object from a loaded list. Returns null when nothing matches.
 */
export const resolveCategory = (token, categories = []) => {
  if (token == null || token === "") return null;
  return (
    categories.find(
      (c) => c.slug === token || String(c.id) === String(token)
    ) || null
  );
};

/**
 * Collect the ids of every descendant of a category (children, grandchildren…)
 * by walking the `parentId` links. Used to apply the parent-includes-children
 * filtering rule.
 */
export const getDescendantIds = (rootId, categories = []) => {
  const ids = new Set();
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop();
    categories.forEach((c) => {
      if (String(c.parentId) === String(current) && !ids.has(c.id)) {
        ids.add(c.id);
        stack.push(c.id);
      }
    });
  }
  return ids;
};

/**
 * The set of category ids whose products belong to a selected category: the
 * category itself plus all of its descendants. This is the heart of the
 * PARENT-INCLUDES-CHILDREN rule — selecting "Electronics" returns Electronics,
 * Laptops, Audio and Smartphones products; selecting "Women's Ethnic Wear"
 * (which has no products of its own) returns its Sarees and Kurtas products.
 * Ids are returned as strings so they compare cleanly against `product.categoryId`.
 */
export const getCategoryScopeIds = (categoryId, categories = []) => {
  const ids = getDescendantIds(categoryId, categories);
  ids.add(categoryId);
  return new Set([...ids].map((id) => String(id)));
};

/**
 * Order a flat category list hierarchically for display: each top-level category
 * (by sortOrder, then name) immediately followed by its children, depth-first.
 * Returns the ordered array plus a `depthOf(id)` lookup so callers can indent
 * sub-categories. Makes the parent/child structure legible in the filter list
 * and dropdowns instead of the interleaved order a flat sortOrder sort produces.
 */
export const orderCategoriesHierarchically = (categories = []) => {
  const byParent = new Map();
  categories.forEach((c) => {
    const key = c.parentId == null ? "root" : String(c.parentId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  });
  byParent.forEach((list) =>
    list.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        String(a.name).localeCompare(String(b.name))
    )
  );

  const ordered = [];
  const depth = new Map();
  const walk = (parentKey, level) => {
    (byParent.get(parentKey) || []).forEach((c) => {
      depth.set(String(c.id), level);
      ordered.push(c);
      walk(String(c.id), level + 1);
    });
  };
  walk("root", 0);

  // Safety net: append any categories whose parent isn't in the list (orphans)
  // so nothing silently disappears from a filter list.
  if (ordered.length < categories.length) {
    const seen = new Set(ordered.map((c) => String(c.id)));
    categories.forEach((c) => {
      if (!seen.has(String(c.id))) {
        depth.set(String(c.id), 0);
        ordered.push(c);
      }
    });
  }

  return { ordered, depthOf: (id) => depth.get(String(id)) || 0 };
};

/**
 * The admin-curated main-menu category list: active categories flagged
 * `showInMainMenu`, ordered by `menuOrder` (then sortOrder, then name). This is
 * the single rule the storefront top menu renders from — no hardcoded list.
 */
export const getMainMenuCategories = (categories = []) =>
  categories
    .filter((c) => c.showInMainMenu === true && c.isActive !== false)
    .sort(
      (a, b) =>
        (a.menuOrder ?? 0) - (b.menuOrder ?? 0) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        String(a.name).localeCompare(String(b.name))
    );
