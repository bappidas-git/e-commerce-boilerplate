import React, { createContext, useState, useContext, useEffect } from "react";
import Swal from "sweetalert2";
import apiService from "../services/api";

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within an AdminProvider");
  return context;
};

export const AdminProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAdmin = sessionStorage.getItem("admin");
    const adminToken = sessionStorage.getItem("adminToken");
    if (storedAdmin && adminToken) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        sessionStorage.removeItem("admin");
        sessionStorage.removeItem("adminToken");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      const adminData = await apiService.admin.login(credentials);
      if (adminData) {
        sessionStorage.setItem("admin", JSON.stringify(adminData));
        // For mock API, store a placeholder token so protected routes work
        if (!sessionStorage.getItem("adminToken")) {
          sessionStorage.setItem("adminToken", "mock-admin-token");
        }
        setAdmin(adminData);
        Swal.fire({
          icon: "success",
          title: `Welcome ${adminData.firstName || "Admin"}`,
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
        return { success: true, admin: adminData };
      }
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: "Invalid admin credentials",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
      });
      return { success: false, error: "Invalid credentials" };
    } catch (error) {
      const msg = error.response?.data?.message || "An error occurred. Please try again.";
      Swal.fire({
        icon: "error",
        title: "Login Error",
        text: msg,
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
      });
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    apiService.admin.logout();
    setAdmin(null);
    Swal.fire({
      icon: "info",
      title: "Logged Out",
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
  };

  const value = {
    admin,
    isLoading,
    isAuthenticated: !!admin,
    login,
    logout,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
