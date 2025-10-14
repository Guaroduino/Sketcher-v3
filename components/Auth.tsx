import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut, User } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { GoogleIcon, LogOutIcon } from './icons';

interface AuthProps {
    user: User | null;
}

export const Auth: React.FC<AuthProps> = ({ user }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error during sign-in:", error);
            alert("Could not sign in. Please check the console for details.");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setIsMenuOpen(false);
        } catch (error) {
            console.error("Error during sign-out:", error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) {
        return (
            <button
                onClick={handleSignIn}
                className="p-2 flex items-center gap-2 rounded-md bg-[--bg-secondary] text-[--text-primary] hover:bg-[--bg-tertiary] border border-[--bg-tertiary] transition-colors text-sm"
                title="Login with Google"
            >
                <GoogleIcon className="w-5 h-5" />
                <span>Login</span>
            </button>
        );
    }

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(prev => !prev)} className="w-10 h-10 rounded-full border-2 border-[--accent-primary] overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[--accent-primary] focus:ring-offset-[--bg-primary]">
                <img src={user.photoURL || undefined} alt={user.displayName || 'User Avatar'} className="w-full h-full object-cover" />
            </button>
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[--bg-primary] border border-[--bg-tertiary] rounded-lg shadow-lg z-30 py-1">
                    <div className="px-3 py-2 border-b border-[--bg-tertiary]">
                        <p className="text-sm font-semibold truncate">{user.displayName}</p>
                        <p className="text-xs text-[--text-secondary] truncate">{user.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-[--text-primary] hover:bg-[--bg-hover]"
                    >
                        <LogOutIcon className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );
};
