import React, { createContext, useState, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/api";
import Swal from "sweetalert2";

const OrderContext = createContext();

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrder must be used within an OrderProvider");
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load user's orders when authenticated
  useEffect(() => {
    if (user) {
      loadUserOrders();
    } else {
      setOrders([]);
    }
  }, [user]);

  const loadUserOrders = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const userOrders = await apiService.orders.getByUserId(user.id);
      // Sort by date, newest first
      const sortedOrders = userOrders.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setOrders(sortedOrders);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createOrder = async (orderData) => {
    try {
      setIsLoading(true);

      const order = {
        ...orderData,
        userId: user?.id || null,
        orderNumber: generateOrderNumber(),
        status: "completed", // For demo, orders are instantly completed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to API
      const savedOrder = await apiService.orders.create(order);

      // Update local state
      setOrders((prev) => [savedOrder, ...prev]);
      setCurrentOrder(savedOrder);

      return { success: true, order: savedOrder };
    } catch (error) {
      console.error("Error creating order:", error);

      Swal.fire({
        icon: "error",
        title: "Order Failed",
        text: "There was an error processing your order. Please try again.",
      });

      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const getOrderById = (orderId) => {
    return orders.find((order) => order.id === orderId || order.orderNumber === orderId);
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const value = {
    orders,
    currentOrder,
    isLoading,
    createOrder,
    loadUserOrders,
    getOrderById,
    setCurrentOrder,
  };

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
};
