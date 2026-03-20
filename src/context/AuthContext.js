import React, { createContext, useState, useContext, useEffect } from "react";
import apiService from "../services/api";
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

  useEffect(() => {
    // Check for existing session on mount
    const storedUser = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing stored user:", error);
        sessionStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      // Use the real API for user login
      const userData = await apiService.auth.login(credentials);

      if (userData) {
        sessionStorage.setItem("user", JSON.stringify(userData));
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

        return { success: false, error: "Invalid credentials" };
      }
    } catch (error) {
      console.error("Login error:", error);

      // Extract error message from API response
      let errorMessage = "An error occurred during login. Please try again.";
      if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }

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
        title: "Registration Successful",
        text: "Your account has been created. Please log in.",
        confirmButtonText: "OK",
      });

      return { success: true, user: newUser };
    } catch (error) {
      console.error("Registration error:", error);

      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: "An error occurred during registration. Please try again.",
      });

      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    sessionStorage.clear();
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

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    sessionStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
