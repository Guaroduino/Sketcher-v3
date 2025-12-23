import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { GoogleIcon, LogOutIcon, PlusIcon } from './icons'; // Assuming PlusIcon exists or I can use another icon or just text
import { PurchaseCreditsModal } from './modals/PurchaseCreditsModal';

interface AuthProps {
    user: User | null;
    credits: number | null;
    role?: string;
}

export const Auth: React.FC<AuthProps> = ({ user, credits, role }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
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
                className="p-2 flex items-center gap-2 rounded-md bg-theme-bg-secondary text-theme-text-primary hover:bg-theme-bg-tertiary border border-theme-bg-tertiary transition-colors text-sm"
                title="Login with Google"
            >
                <GoogleIcon className="w-5 h-5" />
                <span>Login</span>
            </button>
        );
    }

    return (
        <div className="relative flex items-center gap-3" ref={menuRef}>
            {/* Admin Badge */}
            {role === 'admin' && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase" title="Modo Administrador">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Admin</span>
                </div>
            )}

            {/* Purchase Credits Button */}
            <button
                onClick={() => setIsPurchaseModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-accent-primary/10 border border-theme-accent-primary/20 text-theme-accent-primary text-xs font-medium hover:bg-theme-accent-primary/20 transition-colors"
                title="Comprar Créditos"
            >
                <span>Comprar</span>
            </button>

            {/* Credit Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{credits !== null ? credits : '-'} Créditos</span>
            </div>

            <button onClick={() => setIsMenuOpen(prev => !prev)} className="relative w-10 h-10 rounded-full border-2 border-theme-accent-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent-primary focus:ring-offset-theme-bg-primary">
                <img src={user.photoURL || undefined} alt={user.displayName || 'User Avatar'} className="w-full h-full object-cover" />
                {role === 'admin' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-theme-bg-primary rounded-full z-10"></div>
                )}
            </button>
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-lg z-30 py-1">
                    <div className="px-3 py-2 border-b border-theme-bg-tertiary">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold truncate">{user.displayName}</p>
                            {role === 'admin' && <span className="text-[10px] font-bold bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded">ADMIN</span>}
                        </div>
                        <p className="text-xs text-theme-text-secondary truncate">{user.email}</p>
                    </div>
                    <button
                        onClick={() => {
                            setIsPurchaseModalOpen(true);
                            setIsMenuOpen(false);
                        }}
                        className="w-full flex sm:hidden items-center gap-3 px-3 py-2 text-sm text-left text-theme-text-primary hover:bg-theme-bg-hover"
                    >
                        <span>Comprar Créditos</span>
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-theme-text-primary hover:bg-theme-bg-hover"
                    >
                        <LogOutIcon className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            )}

            <PurchaseCreditsModal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} />
        </div>
    );
};
