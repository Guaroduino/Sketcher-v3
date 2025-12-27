
import { useState, useCallback, useRef } from 'react';
import { Region } from '../services/visualPromptingService';

export type VisualPromptingTool = 'pen' | 'eraser' | 'region' | 'polygon' | 'pan';

export function useVisualPrompting() {
    // --- State ---
    const [regions, setRegions] = useState<Region[]>([]);
    const [activeTool, setActiveTool] = useState<VisualPromptingTool>('pan');
    const [brushSize, setBrushSize] = useState(20);
    const [brushColor, setBrushColor] = useState('#FF0000');
    const [generalInstructions, setGeneralInstructions] = useState('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
    const [structuredPrompt, setStructuredPrompt] = useState('');

    // --- Actions ---
    const addRegion = useCallback((regionData: { type: 'rectangle' | 'polygon', x: number, y: number, width: number, height: number, points?: { x: number, y: number }[] }) => {
        const newRegion: Region = {
            id: Date.now().toString(),
            regionNumber: regions.length + 1,
            prompt: '',
            ...regionData
        };
        setRegions(prev => [...prev, newRegion]);
    }, [regions]);

    const updateRegionPrompt = useCallback((id: string, prompt: string) => {
        setRegions(prev => prev.map(r => r.id === id ? { ...r, prompt } : r));
    }, []);

    const updateRegionImage = useCallback((id: string, image: string | null) => {
        setRegions(prev => prev.map(r => r.id === id ? { ...r, referenceImage: image } : r));
    }, []);

    const deleteRegion = useCallback((id: string) => {
        setRegions(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, regionNumber: i + 1 })));
    }, []);

    const clearAll = useCallback(() => {
        setRegions([]);
        setGeneralInstructions('');
        setReferenceImage(null);
    }, []);

    return {
        regions, setRegions,
        activeTool, setActiveTool,
        brushSize, setBrushSize,
        brushColor, setBrushColor,
        generalInstructions, setGeneralInstructions,
        referenceImage, setReferenceImage,
        isPromptManuallyEdited, setIsPromptManuallyEdited,
        structuredPrompt, setStructuredPrompt,

        addRegion,
        updateRegionPrompt,
        updateRegionImage,
        deleteRegion,
        clearAll
    };
}
