import { useState, useEffect, useCallback } from 'react';
import { SavedInstruction } from '../types';

const STORAGE_KEY = 'sketcher_v3_simple_presets';

export const useInstructionPresets = () => {
    const [savedInstructions, setSavedInstructions] = useState<SavedInstruction[]>([]);

    // Load initial state
    useEffect(() => {
        // Function to load presets to keep state synced across components ideally needs event listener
        // But for now, simple mount load + manual re-check if needed.
        // We can add a window event listener for 'storage' to sync across tabs, 
        // or a custom event dispatch for within app sync if components are simultaneous.

        const loadPresets = () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    setSavedInstructions(JSON.parse(saved));
                } catch (e) {
                    console.error("Error loading presets", e);
                }
            }
        };

        loadPresets();

        // Listen for local storage changes (cross-tab)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                loadPresets();
            }
        };

        // Listen for custom event for within-app sync
        const handleCustomUpdate = () => {
            loadPresets();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('presets-updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('presets-updated', handleCustomUpdate);
        };
    }, []);

    const savePresetsToStorage = (presets: SavedInstruction[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
        setSavedInstructions(presets);
        // Dispatch custom event for other components
        window.dispatchEvent(new Event('presets-updated'));
    };

    const addPreset = useCallback((name: string, content: string, source: 'simple' | 'advanced' = 'simple') => {
        // Need to use functional update or read latest state to avoid closure staleness if not in dep array
        // But simply reading from localStorage before saving is safer for concurrency? 
        // For simplicity, we use current state + optimistic update.
        // Better: Read current list from state (which is kept fresh by effects).

        const newPreset: SavedInstruction = {
            id: Date.now().toString(),
            name,
            content,
            source
        };

        setSavedInstructions(prev => {
            const updated = [...prev, newPreset];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new Event('presets-updated'));
            return updated;
        });

        return newPreset;
    }, []);

    const deletePreset = useCallback((id: string) => {
        setSavedInstructions(prev => {
            const updated = prev.filter(p => p.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new Event('presets-updated'));
            return updated;
        });
    }, []);

    return {
        savedInstructions,
        addPreset,
        deletePreset
    };
};
