import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { GoogleUser } from '../types';
import { initGoogleClient, signIn as googleSignIn, signOut as googleSignOut } from '../services/googleService';

declare const gapi: any;

interface AuthContextType {
    isLoggedIn: boolean;
    user: GoogleUser | null;
    isLoading: boolean;
    signIn: () => void;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<GoogleUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleAuthChange = useCallback(async (tokenResponse: any) => {
        console.log("📱 handleAuthChange called with:", tokenResponse);
        setIsLoading(true);
        
        if (tokenResponse && tokenResponse.access_token) {
            gapi.client.setToken(tokenResponse);
            try {
                const response = await gapi.client.request({
                    path: 'https://www.googleapis.com/oauth2/v2/userinfo'
                });
                const profile = response.result;
                console.log("✅ User profile loaded:", profile);
                
                setUser({
                    email: profile.email || '',
                    name: profile.name || profile.email || 'Usuário',
                    picture: profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.email)}&background=6366f1&color=fff`
                });
                setIsLoggedIn(true);
            } catch (error) {
                console.error("❌ Error fetching user info:", error);
                setIsLoggedIn(false);
                setUser(null);
            }
        } else {
            console.log("⚠️ No valid token response");
            setIsLoggedIn(false);
            setUser(null);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        console.log("🚀 AuthProvider: Starting Google API initialization");
        let attempts = 0;
        const maxAttempts = 100;
        
        const checkGoogleReady = setInterval(() => {
            attempts++;
            
            if (window.gapi && window.google && window.google.accounts && window.google.accounts.oauth2) {
                console.log("✅ Google APIs found! Initializing...");
                clearInterval(checkGoogleReady);
                initGoogleClient(handleAuthChange);
                setIsLoading(false);
            } else if (attempts >= maxAttempts) {
                console.error("❌ Failed to load Google APIs after 10 seconds");
                clearInterval(checkGoogleReady);
                setIsLoading(false);
                alert("Erro ao carregar Google APIs. Recarregue a página.");
            }
        }, 100);

        return () => clearInterval(checkGoogleReady);
    }, [handleAuthChange]);

    const handleSignIn = () => {
        console.log("🔐 handleSignIn called");
        setIsLoading(true);
        googleSignIn();
    };

    const handleSignOut = () => {
        console.log("👋 handleSignOut called");
        googleSignOut();
        setIsLoggedIn(false);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, isLoading, signIn: handleSignIn, signOut: handleSignOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};