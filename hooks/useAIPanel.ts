import { useState, useEffect, useRef } from 'react';
import type { Tool } from '../types';

export type SavedPrompts = {
    description: string[];
    style: string[];
    negative: string[];
}
export type PromptType = keyof SavedPrompts;

export function useAIPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeAiTab, setActiveAiTab] = useState<'object' | 'composition' | 'free'>('object');

    // Object Tab State
    const [enhancementPrompt, setEnhancementPrompt] = useState('');
    const [enhancementStylePrompt, setEnhancementStylePrompt] = useState('');
    const [enhancementNegativePrompt, setEnhancementNegativePrompt] = useState('');
    const [enhancementCreativity, setEnhancementCreativity] = useState(100);
    const [enhancementChromaKey, setEnhancementChromaKey] = useState<'none' | 'green' | 'blue'>('none');
    const [isChromaKeyEnabled, setIsChromaKeyEnabled] = useState(false);
    const [enhancementInputMode, setEnhancementInputMode] = useState<'full' | 'bbox'>('full');
    const [enhancementPreviewBgColor, setEnhancementPreviewBgColor] = useState('#FFFFFF');

    // Composition Tab State
    const [compositionPrompt, setCompositionPrompt] = useState('');
    const [styleRef, setStyleRef] = useState<{ url: string; name: string } | null>(null);

    // Free Tab State
    const [freeFormPrompt, setFreeFormPrompt] = useState('');
    const [addEnhancedImageToLibrary, setAddEnhancedImageToLibrary] = useState(true);
    const [freeFormSlots, setFreeFormSlots] = useState<{
        main: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        a: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        b: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null,
        c: { id: string, type: 'outliner' | 'library' | 'file', url: string, name: string } | null
    }>({ main: null, a: null, b: null, c: null });

    // Saved Prompts Logic
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompts>({ description: [], style: [], negative: [] });

    useEffect(() => {
        try {
            const storedPrompts = localStorage.getItem('sketcher-ai-prompts');
            if (storedPrompts) {
                setSavedPrompts(JSON.parse(storedPrompts));
            }
        } catch (error) {
            console.error("Failed to load prompts from localStorage", error);
        }
    }, []);

    const savePrompt = (type: PromptType, value: string) => {
        if (!value.trim() || savedPrompts[type].includes(value.trim())) return;
        const newPrompts = { ...savedPrompts, [type]: [...savedPrompts[type], value.trim()] };
        setSavedPrompts(newPrompts);
        localStorage.setItem('sketcher-ai-prompts', JSON.stringify(newPrompts));
    };

    const deletePrompt = (type: PromptType, valueToDelete: string) => {
        const newPrompts = { ...savedPrompts, [type]: savedPrompts[type].filter(p => p !== valueToDelete) };
        setSavedPrompts(newPrompts);
        localStorage.setItem('sketcher-ai-prompts', JSON.stringify(newPrompts));
    };

    // Chroma Key Sync
    useEffect(() => {
        if (isChromaKeyEnabled) {
            if (enhancementChromaKey === 'none') {
                setEnhancementChromaKey('green');
            }
        } else {
            setEnhancementChromaKey('none');
        }
    }, [isChromaKeyEnabled, setEnhancementChromaKey]);

    return {
        isOpen, setIsOpen,
        activeAiTab, setActiveAiTab,
        enhancementPrompt, setEnhancementPrompt,
        enhancementStylePrompt, setEnhancementStylePrompt,
        enhancementNegativePrompt, setEnhancementNegativePrompt,
        enhancementCreativity, setEnhancementCreativity,
        enhancementChromaKey, setEnhancementChromaKey,
        isChromaKeyEnabled, setIsChromaKeyEnabled,
        enhancementInputMode, setEnhancementInputMode,
        enhancementPreviewBgColor, setEnhancementPreviewBgColor,
        compositionPrompt, setCompositionPrompt,
        styleRef, setStyleRef,
        freeFormPrompt, setFreeFormPrompt,
        addEnhancedImageToLibrary, setAddEnhancedImageToLibrary,
        freeFormSlots, setFreeFormSlots,
        savedPrompts, savePrompt, deletePrompt
    };
}
