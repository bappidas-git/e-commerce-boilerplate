import React, { createContext, useState, useContext, useEffect } from "react";
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

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    const savedWishlist = localStorage.getItem("wishlist");
    if (savedWishlist) {
      try {
        setWishlistItems(JSON.parse(savedWishlist));
      } catch (error) {
        console.error("Error loading wishlist:", error);
        localStorage.removeItem("wishlist");
      }
    }
  }, []);

  // Save wishlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("wishlist", JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  // Load user's wishlist from API if logged in, or clear wishlist on logout
  useEffect(() => {
    if (user) {
      loadUserWishlist();
    } else {
      // Clear wishlist when user logs out
      setWishlistItems([]);
      localStorage.removeItem("wishlist");
    }
  }, [user]);

  const loadUserWishlist = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const wishlist = await apiService.wishlist.get(user.id);
      if (wishlist && wishlist.length > 0) {
        // Transform nested product structure to flat structure expected by UI
        const transformedWishlist = wishlist.map((item) => {
          // If the item has a nested product object, flatten it
          if (item.product) {
            return {
              id: item.id,
              productId: item.productId || item.product.id,
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
              trending: item.product.trending,
              hot: item.product.hot,
              addedAt: item.createdAt || item.addedAt || new Date().toISOString(),
            };
          }
          // If already flat structure, return as-is
          return item;
        });
        setWishlistItems(transformedWishlist);
      }
    } catch (error) {
      console.error("Error loading wishlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWishlist = async (product) => {
    try {
      // Check if item already exists
      const existingItem = wishlistItems.find((item) => item.productId === product.id);

      if (existingItem) {
        Swal.fire({
          icon: "info",
          title: "Already in Wishlist",
          text: `${product.name} is already in your wishlist`,
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
        return;
      }

      // Create wishlist item
      const newItem = {
        id: Date.now(), // Temporary ID
        productId: product.id,
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
        trending: product.trending,
        hot: product.hot,
        addedAt: new Date().toISOString(),
      };

      setWishlistItems([...wishlistItems, newItem]);

      // Add to API if user is logged in
      if (user) {
        const apiItem = await apiService.wishlist.add({
          userId: user.id,
          productId: product.id,
          ...newItem,
        });

        // Update with API ID
        setWishlistItems((prev) =>
          prev.map((item) =>
            item.productId === product.id
              ? { ...item, id: apiItem.id || item.id }
              : item
          )
        );
      }

      Swal.fire({
        icon: "success",
        title: "Added to Wishlist",
        text: `${product.name} has been added to your wishlist`,
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Error adding to wishlist:", error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to add item to wishlist",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      const item = wishlistItems.find((item) => item.productId === productId);

      setWishlistItems(wishlistItems.filter((item) => item.productId !== productId));

      // Remove from API if user is logged in
      if (user && item) {
        await apiService.wishlist.remove(item.id);
      }

      Swal.fire({
        icon: "info",
        title: "Removed",
        text: "Item removed from wishlist",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Error removing from wishlist:", error);
    }
  };

  const toggleWishlist = async (product) => {
    const isInWishlist = wishlistItems.some((item) => item.productId === product.id);

    if (isInWishlist) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  };

  const isInWishlist = (productId) => {
    return wishlistItems.some((item) => item.productId === productId);
  };

  const clearWishlist = () => {
    setWishlistItems([]);
    localStorage.removeItem("wishlist");

    Swal.fire({
      icon: "info",
      title: "Wishlist Cleared",
      text: "Your wishlist has been emptied",
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
  };

  const getWishlistCount = () => {
    return wishlistItems.length;
  };

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
