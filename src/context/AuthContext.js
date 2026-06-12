import React, { createContext, useState, useContext, useEffect } from "react";
import apiService, { getErrorMessage } from "../services/api";
import authStorage from "../utils/authStorage";
import Swal from "sweetalert2";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Global auth-modal state so any page (wishlist, orders, …) can open the
  // login/signup modal. The modal itself is rendered once, in the Header.
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");

  const openAuthModal = (tab = "login") => {
    setAuthModalTab(tab === "signup" ? "signup" : "login");
    setAuthModalOpen(true);
  };
  const closeAuthModal = () => setAuthModalOpen(false);

  useEffect(() => {
    // Restore an existing session on mount. authStorage checks sessionStorage
    // (default, per-tab) then localStorage ("Remember me" logins) — both the
    // mock and Laravel login paths store a token, so requiring user + token
    // works in either mode.
    const storedUser = authStorage.get("user");
    const token = authStorage.get("token");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing stored user:", error);
        authStorage.remove("user");
        authStorage.remove("token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      // Use the real API for user login
      const userData = await apiService.auth.login(credentials);

      if (userData) {
        authStorage.set("user", JSON.stringify(userData), !!credentials.remember);
        setUser(userData);

        Swal.fire({
          icon: "success",
          title: `Welcome ${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Welcome",
          text: "You have successfully logged in",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });

        return { success: true, user: userData };
      } else {
        Swal.fire({
          icon: "error",
          title: "Login Failed",
          text: "Invalid email or password",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
        });

        return { success: false, error: "Invalid email or password" };
      }
    } catch (error) {
      console.error("Login error:", error);

      const errorMessage = getErrorMessage(error) || "An error occurred during login. Please try again.";

      Swal.fire({
        icon: "error",
        title: "Login Error",
        text: errorMessage,
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
      });

      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      const newUser = await apiService.auth.register(userData);

      Swal.fire({
        icon: "success",
        title: "Account created",
        text: "Please log in with your new credentials",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });

      return { success: true, user: newUser };
    } catch (error) {
      if (error.code !== "EMAIL_TAKEN") console.error("Registration error:", error);

      const errorMessage = getErrorMessage(error) || "An error occurred during registration. Please try again.";

      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: errorMessage,
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
      });

      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    // Removes user/token from both storages and, on the Laravel branch,
    // revokes the token server-side. Never sessionStorage.clear() — that
    // would also wipe an admin session open in the same tab.
    apiService.auth.logout().catch(() => {});
    setUser(null);

    Swal.fire({
      icon: "info",
      title: "Logged Out",
      text: "You have been successfully logged out",
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
  };

  const updateUser = async (updates) => {
    // Persist to the backend first so a failure surfaces to the caller (which
    // shows an error toast) instead of leaving the UI claiming a save that
    // never happened. Mock branch PATCHes /users/:id (db.json); Laravel branch
    // hits PUT /auth/user. Throws on failure.
    await apiService.auth.updateUser(updates);

    // Merge the *updates* (never the API response — on JSON Server that still
    // carries the password) into the current safe user, then mirror to storage.
    // setUser makes the Header name/initials/avatar reflect the change with no
    // reload; the storage write means a reload keeps it too (session persistence).
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    authStorage.update("user", JSON.stringify(updatedUser));
    return updatedUser;
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
