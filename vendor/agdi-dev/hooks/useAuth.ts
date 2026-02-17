/**
 * useAuth — React hook for Supabase authentication
 *
 * Provides:
 *  - signInWithGithub()  → for developers
 *  - signInWithGoogle()  → for business owners
 *  - signInWithEmail()   → for business owners
 *  - signUp()            → email registration
 *  - signOut()
 *  - user, session, isLoading, userType, isAuthenticated
 */

import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export type UserType = 'developer' | 'business_owner';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    userType: UserType | null;
    isAuthenticated: boolean;
    error: string | null;
}

interface UseAuthReturn extends AuthState {
    signInWithGithub: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, userType: UserType) => Promise<void>;
    signOut: () => Promise<void>;
    setUserType: (type: UserType) => void;
    isConfigured: boolean;
}

const USER_TYPE_KEY = 'agdi_user_type';

export function useAuth(): UseAuthReturn {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        isLoading: true,
        userType: (localStorage.getItem(USER_TYPE_KEY) as UserType) || null,
        isAuthenticated: false,
        error: null,
    });

    const supabase = getSupabase();
    const isConfigured = isSupabaseConfigured();

    // Listen to auth state changes
    useEffect(() => {
        if (!supabase) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const userType = session?.user?.user_metadata?.user_type as UserType | undefined;
            setState(prev => ({
                ...prev,
                user: session?.user ?? null,
                session,
                isAuthenticated: !!session,
                userType: userType || prev.userType,
                isLoading: false,
            }));
        });

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const userType = session?.user?.user_metadata?.user_type as UserType | undefined;
            setState(prev => ({
                ...prev,
                user: session?.user ?? null,
                session,
                isAuthenticated: !!session,
                userType: userType || prev.userType,
                isLoading: false,
            }));
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const signInWithGithub = useCallback(async () => {
        if (!supabase) return;
        setState(prev => ({ ...prev, error: null }));

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setState(prev => ({ ...prev, error: error.message }));
        } else {
            localStorage.setItem(USER_TYPE_KEY, 'developer');
        }
    }, [supabase]);

    const signInWithGoogle = useCallback(async () => {
        if (!supabase) return;
        setState(prev => ({ ...prev, error: null }));

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) {
            setState(prev => ({ ...prev, error: error.message }));
        } else {
            localStorage.setItem(USER_TYPE_KEY, 'business_owner');
        }
    }, [supabase]);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
        if (!supabase) return;
        setState(prev => ({ ...prev, error: null, isLoading: true }));

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setState(prev => ({ ...prev, error: error.message, isLoading: false }));
        }
    }, [supabase]);

    const signUp = useCallback(async (email: string, password: string, userType: UserType) => {
        if (!supabase) return;
        setState(prev => ({ ...prev, error: null, isLoading: true }));

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { user_type: userType },
            },
        });

        if (error) {
            setState(prev => ({ ...prev, error: error.message, isLoading: false }));
        } else {
            localStorage.setItem(USER_TYPE_KEY, userType);
        }
    }, [supabase]);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        localStorage.removeItem(USER_TYPE_KEY);
        setState(prev => ({
            ...prev,
            user: null,
            session: null,
            isAuthenticated: false,
            userType: null,
        }));
    }, [supabase]);

    const setUserType = useCallback((type: UserType) => {
        localStorage.setItem(USER_TYPE_KEY, type);
        setState(prev => ({ ...prev, userType: type }));
    }, []);

    return {
        ...state,
        signInWithGithub,
        signInWithGoogle,
        signInWithEmail,
        signUp,
        signOut,
        setUserType,
        isConfigured,
    };
}
