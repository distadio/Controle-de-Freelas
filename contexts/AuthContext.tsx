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
        setIsLoading(true);
        if (tokenResponse && tokenResponse.access_token) {
            gapi.client.setToken(tokenResponse);
            try {
                const response = await gapi.client.request({
                    path: 'https://www.googleapis.com/oauth2/v3/userinfo'
                });
                const profile = response.result;
                setUser({
                    email: profile.email,
                    name: profile.name,
                    picture: profile.picture
                });
                setIsLoggedIn(true);
            } catch (error) {
                console.error("Error fetching user info:", error);
                setIsLoggedIn(false);
                setUser(null);
            }
        } else {
            setIsLoggedIn(false);
            setUser(null);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const checkGapiReady = setInterval(() => {
            if (window.gapi && window.google) {
                clearInterval(checkGapiReady);
                initGoogleClient(handleAuthChange);
                // No automatic sign-in, let user click the button.
                setIsLoading(false);
            }
        }, 100);

        return () => clearInterval(checkGapiReady);
    }, [handleAuthChange]);


    const handleSignIn = () => {
        setIsLoading(true);
        googleSignIn();
    };

    const handleSignOut = () => {
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
