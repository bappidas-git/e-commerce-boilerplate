import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/api";
import Swal from "sweetalert2";

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

// Shared SweetAlert toast config so every wishlist toast is positioned alike
// (and alike to the cart's toasts).
const wishlistToast = (options) =>
  Swal.fire({
    toast: true,
    position: "bottom-end",
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    ...options,
  });

// Ids for rows that only exist locally (guest rows, or rows whose API save is
// still in flight). They are never sent to the API as a row id.
const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isLocalId = (id) => String(id).startsWith("local-");

// Flat product snapshot stored per wishlist row. The same shape is rendered by
// the Wishlist page and POSTed to the API (minus the local row id).
const buildWishlistItem = (product) => ({
  productId: product.id,
  // Carry the slug so the wishlist card can deep-link to the canonical slug URL
  // (falls back to productId via productPath when absent).
  slug: product.slug || null,
  name: product.name,
  image: product.images?.[0] || product.image,
  brand: product.brand,
  category: product.category,
  price: product.price,
  comparePrice: product.comparePrice,
  rating: product.rating,
  totalReviews: product.totalReviews,
  shortDescription: product.shortDescription,
  variants: product.variants,
  stock: product.stock,
  trending: product.trending,
  hot: product.hot,
  addedAt: new Date().toISOString(),
});

// Normalize an API row to the flat shape the UI renders. The Laravel branch
// returns the product snapshot nested under `product`; JSON Server rows (and
// local rows) are already flat.
const normalizeWishlistItem = (item) => {
  if (item.product) {
    return {
      id: item.id,
      productId: item.productId || item.product.id,
      slug: item.product.slug || item.slug || null,
      name: item.product.name,
      image: item.product.images?.[0] || item.product.image,
      brand: item.product.brand,
      category: item.product.category,
      price: item.product.price,
      comparePrice: item.product.comparePrice,
      rating: item.product.rating,
      totalReviews: item.product.totalReviews,
      shortDescription: item.product.shortDescription,
      variants: item.product.variants,
      stock: item.product.stock,
      trending: item.product.trending,
      hot: item.product.hot,
      addedAt: item.createdAt || item.addedAt || new Date().toISOString(),
    };
  }
  return item;
};

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Skips the very first "save" so the initial empty state can't overwrite the
  // persisted wishlist before the "load" effect has hydrated it.
  const firstSaveRef = useRef(true);
  // Tracks the previous auth value so we only clear the list on a real logout
  // transition (user → null), not on the initial null render — which would
  // wipe a guest's wishlist on every reload.
  const prevUserRef = useRef(undefined);
  // Mirror of the latest committed list so stable callbacks can read current
  // rows without re-subscribing.
  const wishlistItemsRef = useRef(wishlistItems);
  useEffect(() => {
    wishlistItemsRef.current = wishlistItems;
  }, [wishlistItems]);

  // ── Persistence: load once on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wishlist");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setWishlistItems(parsed);
      }
    } catch (error) {
      console.error("Error loading wishlist:", error);
      localStorage.removeItem("wishlist");
    }
  }, []);

  // ── Persistence: save on every change (skipping the initial commit) ──────
  useEffect(() => {
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    localStorage.setItem("wishlist", JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  // ── Load + merge the user's wishlist on login; clear it on logout ────────
  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    if (!user) {
      // Only a genuine logout (had a user, now null) clears the list — not the
      // initial null render or a browsing guest.
      if (prevUser) {
        setWishlistItems([]);
        localStorage.removeItem("wishlist");
      }
      // The server wishlist is left intact so logging back in restores it.
      return;
    }

    // Login (or already-logged-in on reload): load the server wishlist, keep
    // server rows for products saved in both places, and upload guest-only
    // items so they follow the account.
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const serverRows = (await apiService.wishlist.get(user.id)) || [];
        const serverItems = serverRows.map(normalizeWishlistItem);
        if (cancelled) return;

        const onServer = new Set(serverItems.map((item) => item.productId));
        const guestOnly = wishlistItemsRef.current.filter(
          (item) => !onServer.has(item.productId)
        );
        const uploaded = await Promise.all(
          guestOnly.map(async (item) => {
            try {
              const { id, ...payload } = item;
              const apiItem = await apiService.wishlist.add({
                ...payload,
                userId: user.id,
              });
              return { ...item, id: apiItem?.id ?? id };
            } catch (error) {
              // Keep it locally with its local id; the upload is retried on
              // the next login/reload.
              console.error("Error syncing wishlist item:", error);
              return item;
            }
          })
        );
        if (cancelled) return;
        setWishlistItems([...serverItems, ...uploaded]);
      } catch (error) {
        // Leave whatever is stored locally rather than wiping the list.
        console.error("Error loading wishlist:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addToWishlist = useCallback(
    async (product) => {
      if (wishlistItemsRef.current.some((item) => item.productId === product.id)) {
        wishlistToast({
          icon: "info",
          title: "Already in Wishlist",
          text: `${product.name} is already in your wishlist`,
        });
        return;
      }

      const newItem = { id: localId(), ...buildWishlistItem(product) };
      setWishlistItems((prev) =>
        prev.some((item) => item.productId === product.id)
          ? prev
          : [...prev, newItem]
      );

      if (user) {
        try {
          const { id, ...payload } = newItem;
          const apiItem = await apiService.wishlist.add({
            ...payload,
            userId: user.id,
          });
          const stillSaved = wishlistItemsRef.current.some(
            (item) => item.productId === product.id
          );
          if (!stillSaved) {
            // Removed while the save was in flight — undo the server row so it
            // doesn't resurrect on the next reload.
            if (apiItem?.id != null) {
              apiService.wishlist.remove(apiItem.id).catch(() => undefined);
            }
            return;
          }
          if (apiItem?.id != null) {
            setWishlistItems((prev) =>
              prev.map((item) =>
                item.productId === product.id ? { ...item, id: apiItem.id } : item
              )
            );
          }
        } catch (error) {
          // Roll back the optimistic add — otherwise the heart reads as saved
          // but the item would vanish on the next reload.
          console.error("Error adding to wishlist:", error);
          setWishlistItems((prev) =>
            prev.filter((item) => item.productId !== product.id)
          );
          wishlistToast({
            icon: "error",
            title: "Couldn't Save",
            text: `Failed to add ${product.name} to your wishlist. Please try again.`,
            timer: 2500,
          });
          return;
        }
      }

      wishlistToast({
        icon: "success",
        title: "Added to Wishlist",
        text: `${product.name} has been added to your wishlist`,
      });
    },
    [user]
  );

  const removeFromWishlist = useCallback(
    // `silent` skips the "Removed" toast (errors still surface) — used by
    // Move-to-Cart so its "Added to Cart" toast isn't immediately replaced.
    async (productId, { silent = false } = {}) => {
      const item = wishlistItemsRef.current.find(
        (row) => row.productId === productId
      );
      if (!item) return;

      // Optimistic remove; restored below if the API delete fails.
      setWishlistItems((prev) =>
        prev.filter((row) => row.productId !== productId)
      );

      if (user && item.id != null && !isLocalId(item.id)) {
        try {
          await apiService.wishlist.remove(item.id);
        } catch (error) {
          console.error("Error removing from wishlist:", error);
          setWishlistItems((prev) =>
            prev.some((row) => row.productId === productId)
              ? prev
              : [...prev, item]
          );
          wishlistToast({
            icon: "error",
            title: "Couldn't Remove",
            text: `Failed to remove ${item.name} from your wishlist. Please try again.`,
            timer: 2500,
          });
          return;
        }
      }

      if (!silent) {
        wishlistToast({
          icon: "info",
          title: "Removed",
          text: "Item removed from wishlist",
          timer: 1500,
        });
      }
    },
    [user]
  );

  const toggleWishlist = useCallback(
    async (product) => {
      const exists = wishlistItemsRef.current.some(
        (item) => item.productId === product.id
      );
      if (exists) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product);
      }
    },
    [addToWishlist, removeFromWishlist]
  );

  const clearWishlist = useCallback(async () => {
    const items = wishlistItemsRef.current;
    if (items.length === 0) return;

    const result = await Swal.fire({
      title: "Clear wishlist?",
      text: `All ${items.length} saved item${items.length === 1 ? "" : "s"} will be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d32f2f",
      confirmButtonText: "Clear All",
      cancelButtonText: "Keep Items",
    });
    if (!result.isConfirmed) return;

    setWishlistItems([]);
    localStorage.removeItem("wishlist");

    if (user) {
      const serverIds = items
        .map((item) => item.id)
        .filter((id) => id != null && !isLocalId(id));
      const results = await Promise.allSettled(
        serverIds.map((id) => apiService.wishlist.remove(id))
      );
      if (results.some((r) => r.status === "rejected")) {
        // Reload what the server still has so the UI and the account agree.
        try {
          const rows = (await apiService.wishlist.get(user.id)) || [];
          setWishlistItems(rows.map(normalizeWishlistItem));
        } catch (reloadError) {
          console.error("Error reloading wishlist:", reloadError);
        }
        wishlistToast({
          icon: "error",
          title: "Couldn't Clear Wishlist",
          text: "Some items could not be removed. Please try again.",
          timer: 2500,
        });
        return;
      }
    }

    wishlistToast({
      icon: "info",
      title: "Wishlist Cleared",
      text: "Your wishlist has been emptied",
    });
  }, [user]);

  const isInWishlist = (productId) =>
    wishlistItems.some((item) => item.productId === productId);

  const getWishlistCount = () => wishlistItems.length;

  const value = {
    wishlistItems,
    isLoading,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
    getWishlistCount,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};
