import { useState, useEffect, useCallback } from 'react';
import { SavedInstruction } from '../types';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'sketcher_v3_simple_presets';

export const useInstructionPresets = (userId?: string) => {
    const [savedInstructions, setSavedInstructions] = useState<SavedInstruction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial state
    useEffect(() => {
        if (!userId) {
            // Local Storage Mode
            const loadPresets = () => {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    try {
                        setSavedInstructions(JSON.parse(saved));
                    } catch (e) {
                        console.error("Error loading presets", e);
                    }
                }
                setIsLoading(false);
            };

            loadPresets();

            const handleStorageChange = (e: StorageEvent) => {
                if (e.key === STORAGE_KEY) {
                    loadPresets();
                }
            };
            const handleCustomUpdate = () => {
                loadPresets();
            };

            window.addEventListener('storage', handleStorageChange);
            window.addEventListener('presets-updated', handleCustomUpdate);

            return () => {
                window.removeEventListener('storage', handleStorageChange);
                window.removeEventListener('presets-updated', handleCustomUpdate);
            };
        } else {
            // Firebase Mode
            setIsLoading(true);
            const userPresetsRef = doc(db, 'users', userId, 'settings', 'presets');

            const unsubscribe = onSnapshot(userPresetsRef, async (docSnap) => {
                if (docSnap.exists()) {
                    setSavedInstructions(docSnap.data().items || []);
                } else {
                    // Migration Logic: If no cloud presets, check local storage
                    const localSaved = localStorage.getItem(STORAGE_KEY);
                    if (localSaved) {
                        try {
                            const localPresets = JSON.parse(localSaved);
                            if (localPresets.length > 0) {
                                // Upload local presets to cloud
                                await setDoc(userPresetsRef, { items: localPresets });
                                console.log("Migrated local presets to cloud");
                            } else {
                                setSavedInstructions([]);
                            }
                        } catch (e) {
                            console.error("Migration error", e);
                        }
                    } else {
                        setSavedInstructions([]);
                    }
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Error fetching presets from Firebase:", error);
                setIsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [userId]);

    const addPreset = useCallback(async (name: string, content: string, source: 'simple' | 'advanced' = 'simple') => {
        const newPreset: SavedInstruction = {
            id: Date.now().toString(),
            name,
            content,
            source
        };

        if (!userId) {
            // Local Update
            setSavedInstructions(prev => {
                const updated = [...prev, newPreset];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                window.dispatchEvent(new Event('presets-updated'));
                return updated;
            });
        } else {
            // Cloud Update
            try {
                const userPresetsRef = doc(db, 'users', userId, 'settings', 'presets');
                // Use arrayUnion to add to the 'items' array
                // We need to ensure the document exists first, setDoc with merge handles that simply
                await setDoc(userPresetsRef, {
                    items: arrayUnion(newPreset)
                }, { merge: true });
            } catch (e) {
                console.error("Error saving preset to cloud", e);
                // Optimistic update handled by snapshot listener mostly, but for immediate UI feedback we could set state
                // But snapshot is fast.
            }
        }

        return newPreset;
    }, [userId]);

    const deletePreset = useCallback(async (id: string) => {
        if (!userId) {
            // Local Delete
            setSavedInstructions(prev => {
                const updated = prev.filter(p => p.id !== id);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                window.dispatchEvent(new Event('presets-updated'));
                return updated;
            });
        } else {
            // Cloud Delete
            try {
                const presetToDelete = savedInstructions.find(p => p.id === id);
                if (presetToDelete) {
                    const userPresetsRef = doc(db, 'users', userId, 'settings', 'presets');
                    await updateDoc(userPresetsRef, {
                        items: arrayRemove(presetToDelete)
                    });
                }
            } catch (e) {
                console.error("Error deleting preset from cloud", e);
            }
        }
    }, [userId, savedInstructions]);

    return {
        savedInstructions,
        addPreset,
        deletePreset,
        isLoading
    };
};
