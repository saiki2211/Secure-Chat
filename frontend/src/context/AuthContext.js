import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));

    useEffect(() => {
        if (token) {
            axios.get("http://localhost:5000/user", { headers: { Authorization: `Bearer ${token}` } })
                .then(res => setUser(res.data))
                .catch(() => logout());
        }
    }, [token]);

    const login = async (username, password) => {
        try {
            const res = await axios.post("http://localhost:5000/login", { username, password });
            localStorage.setItem("token", res.data.token);
            setToken(res.data.token);
            setUser(res.data.user);
        } catch (err) {
            console.error("Login failed:", err.response?.data || err.message);
            alert("Login failed. Please check your credentials.");
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
