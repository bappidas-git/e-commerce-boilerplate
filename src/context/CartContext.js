import React, { createContext, useState, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/api";
import Swal from "sweetalert2";

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to normalize cart items
  const normalizeCartItem = (item) => ({
    ...item,
    id: item.id || `${item.productId}-${item.variantId || "default"}`,
    productId: item.productId,
    variantId: item.variantId || null,
    variantName: item.variantName || null,
    name: item.name || "Item",
    image: item.image || item.product?.images?.[0] || item.product?.image || "",
    price: item.price || 0,
    comparePrice: item.comparePrice || 0,
    currency: item.currency || "INR",
    quantity: item.quantity || 1,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        // Normalize cart items to ensure all required fields exist
        const normalizedCart = parsedCart.map(normalizeCartItem);
        setCartItems(normalizedCart);
      } catch (error) {
        console.error("Error loading cart:", error);
        localStorage.removeItem("cart");
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Load user's cart from API if logged in, or clear cart on logout
  useEffect(() => {
    if (user) {
      loadUserCart();
    } else {
      // Clear cart and close drawer when user logs out
      setCartItems([]);
      setIsCartOpen(false);
      localStorage.removeItem("cart");
    }
  }, [user]);

  const loadUserCart = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const cart = await apiService.cart.getCart(user.id);
      if (cart && cart.length > 0) {
        // Normalize cart items to ensure all required fields exist
        const normalizedCart = cart.map(normalizeCartItem);
        setCartItems(normalizedCart);
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async (product, quantity = 1) => {
    try {
      const existingItem = cartItems.find((item) => item.id === product.id);

      if (existingItem) {
        // Update quantity if item exists
        const updatedItems = cartItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
        setCartItems(updatedItems);

        // Update in API if user is logged in
        if (user) {
          await apiService.cart.updateCartItem(existingItem.id, {
            quantity: existingItem.quantity + quantity,
          });
        }

        Swal.fire({
          icon: "success",
          title: "Cart Updated",
          text: `${product.name} quantity updated`,
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
      } else {
        // Add new item
        const newItem = {
          ...product,
          quantity,
          cartItemId: Date.now(), // Temporary ID
        };

        setCartItems([...cartItems, newItem]);

        // Add to API if user is logged in
        if (user) {
          const apiItem = await apiService.cart.addToCart({
            ...newItem,
            userId: user.id,
          });

          // Update with API ID
          setCartItems((prev) =>
            prev.map((item) =>
              item.cartItemId === newItem.cartItemId
                ? { ...item, cartItemId: apiItem.id }
                : item
            )
          );
        }

        Swal.fire({
          icon: "success",
          title: "Added to Cart",
          text: `${product.name} has been added to your cart`,
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
      }

      // Open cart drawer
      setIsCartOpen(true);
    } catch (error) {
      console.error("Error adding to cart:", error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to add item to cart",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      setCartItems(cartItems.filter((item) => item.id !== itemId));

      // Remove from API if user is logged in
      if (user) {
        const item = cartItems.find((item) => item.id === itemId);
        if (item && item.cartItemId) {
          await apiService.cart.removeFromCart(item.cartItemId);
        }
      }

      Swal.fire({
        icon: "info",
        title: "Removed",
        text: "Item removed from cart",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Error removing from cart:", error);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }

    try {
      const updatedItems = cartItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );
      setCartItems(updatedItems);

      // Update in API if user is logged in
      if (user) {
        const item = cartItems.find((item) => item.id === itemId);
        if (item && item.cartItemId) {
          await apiService.cart.updateCartItem(item.cartItemId, {
            quantity: newQuantity,
          });
        }
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("cart");

    Swal.fire({
      icon: "info",
      title: "Cart Cleared",
      text: "Your cart has been emptied",
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
  };

  const getCartTotal = () => {
    return cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen);
  };

  const value = {
    cartItems,
    isCartOpen,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
    toggleCart,
    setIsCartOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
