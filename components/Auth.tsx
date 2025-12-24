import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { GoogleIcon, LogOutIcon, PlusIcon, SunIcon, MoonIcon, ZoomInIcon, ZoomOutIcon, SaveIcon, BookmarkIcon, DownloadIcon, BookOpenIcon } from './icons'; // Updated icons import
import { PurchaseCreditsModal } from './modals/PurchaseCreditsModal';
import { HelpModal } from './modals/HelpModal';

interface AuthProps {
    user: User | null;
    credits: number | null;
    role?: string;
    onThemeToggle: () => void;
    isDarkTheme: boolean;
    uiScale: number;
    setUiScale: (scale: number) => void;
    onSaveUiScale: () => void;
    onOpenTemplates: () => void;
    onInstallApp?: () => void; // New prop
    isInstallable?: boolean;   // New prop
}

export const Auth: React.FC<AuthProps> = ({ user, credits, role, onThemeToggle, isDarkTheme, uiScale, setUiScale, onSaveUiScale, onOpenTemplates, onInstallApp, isInstallable }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
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
            <div className="flex items-center gap-2">
                {/* Theme Toggle for non-logged in users too? Maybe not requested, but good UX. Keep it minimal for now. */}
                <button
                    onClick={onThemeToggle}
                    className="p-2 rounded-md hover:bg-theme-bg-tertiary text-theme-text-secondary transition-colors"
                >
                    {isDarkTheme ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
                <button
                    onClick={handleSignIn}
                    className="p-2 flex items-center gap-2 rounded-md bg-theme-bg-secondary text-theme-text-primary hover:bg-theme-bg-tertiary border border-theme-bg-tertiary transition-colors text-sm"
                    title="Login with Google"
                >
                    <GoogleIcon className="w-5 h-5" />
                    <span>Login</span>
                </button>
            </div>
        );
    }

    return (
        <div className="relative flex items-center gap-3" ref={menuRef}>
            {/* Credit Badge (Clickable) */}
            <button
                onClick={() => setIsPurchaseModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-bg-secondary border border-theme-bg-tertiary hover:bg-theme-bg-tertiary hover:border-theme-accent-primary/50 transition-all cursor-pointer group"
                title="Comprar Créditos"
            >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse group-hover:bg-theme-accent-primary" />
                <span className="text-xs font-bold text-theme-text-primary group-hover:text-theme-accent-primary">{credits !== null ? credits : '-'} Créditos</span>
            </button>

            <button onClick={() => setIsMenuOpen(prev => !prev)} className="relative w-10 h-10 rounded-full border-2 border-theme-accent-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent-primary focus:ring-offset-theme-bg-primary">
                <img src={user.photoURL || undefined} alt={user.displayName || 'User Avatar'} className="w-full h-full object-cover" />
                {role === 'admin' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-theme-bg-primary rounded-full z-10"></div>
                )}
            </button>
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-theme-bg-primary border border-theme-bg-tertiary rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-theme-bg-tertiary bg-theme-bg-secondary/30">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-theme-text-primary truncate max-w-[150px]">{user.displayName}</p>
                            {role === 'admin' && <span className="text-[9px] font-bold bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">ADMIN</span>}
                        </div>
                        <p className="text-xs text-theme-text-secondary truncate mt-0.5">{user.email}</p>
                    </div>

                    <div className="p-2 space-y-1 border-b border-theme-bg-tertiary">
                        {/* Mobile Credits View */}
                        <div className="flex sm:hidden items-center justify-between px-2 py-1.5 rounded-md bg-amber-500/10 text-amber-500 text-xs font-bold mb-2">
                            <span>{credits !== null ? credits : '-'} Créditos</span>
                            <button onClick={() => setIsPurchaseModalOpen(true)} className="underline">Comprar</button>
                        </div>

                        <button
                            onClick={() => { onOpenTemplates(); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left text-theme-text-primary hover:bg-theme-bg-hover rounded-md transition-colors"
                        >
                            <BookmarkIcon className="w-4 h-4 text-theme-text-secondary" />
                            <span>Plantillas</span>
                        </button>

                        <button
                            onClick={() => { setIsHelpModalOpen(true); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left text-theme-text-primary hover:bg-theme-bg-hover rounded-md transition-colors"
                        >
                            <BookOpenIcon className="w-4 h-4 text-theme-text-secondary" />
                            <span>Ayuda</span>
                        </button>

                        <button
                            onClick={onThemeToggle}
                            className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left text-theme-text-primary hover:bg-theme-bg-hover rounded-md transition-colors"
                        >
                            {isDarkTheme ? <SunIcon className="w-4 h-4 text-theme-text-secondary" /> : <MoonIcon className="w-4 h-4 text-theme-text-secondary" />}
                            <span>Tema {isDarkTheme ? 'Claro' : 'Oscuro'}</span>
                        </button>
                    </div>

                    {/* UI Scale Control */}
                    <div className="p-3 border-b border-theme-bg-tertiary">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-theme-text-tertiary uppercase">Escala UI</span>
                            <span className="text-xs text-theme-text-primary font-mono">{Math.round(uiScale * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setUiScale(Math.max(0.5, uiScale - 0.1))} className="p-1 hover:bg-theme-bg-hover rounded text-theme-text-secondary"><ZoomOutIcon className="w-4 h-4" /></button>
                            <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.05"
                                value={uiScale}
                                onChange={(e) => setUiScale(parseFloat(e.target.value))}
                                className="flex-grow h-1.5 bg-theme-bg-tertiary rounded-lg appearance-none cursor-pointer accent-theme-accent-primary"
                            />
                            <button onClick={() => setUiScale(Math.min(1.5, uiScale + 0.1))} className="p-1 hover:bg-theme-bg-hover rounded text-theme-text-secondary"><ZoomInIcon className="w-4 h-4" /></button>
                        </div>
                        <button onClick={onSaveUiScale} className="w-full mt-2 py-1 text-[10px] bg-theme-bg-tertiary hover:bg-theme-bg-hover text-theme-text-secondary rounded transition-colors flex items-center justify-center gap-1">
                            <SaveIcon className="w-3 h-3" /> Guardar Preferencia
                        </button>
                    </div>

                    <div className="p-2">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                            <LogOutIcon className="w-4 h-4" />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>

                    {isInstallable && onInstallApp && (
                        <div className="p-2 border-t border-theme-bg-tertiary">
                            <button
                                onClick={() => { onInstallApp(); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-2 py-2 text-sm text-left text-theme-accent-primary bg-theme-accent-primary/10 hover:bg-theme-accent-primary/20 rounded-md transition-colors font-bold"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span>Instalar App</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            <PurchaseCreditsModal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} />
            <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
        </div>
    );
};
