import { useState, useEffect, useCallback } from 'react';
import type { WorkspaceTemplate } from '../types';

const STORAGE_KEY = 'sketcher-workspace-templates';

export function useWorkspaceTemplates() {
    const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setTemplates(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load workspace templates from localStorage", e);
        }
    }, []);

    const saveTemplatesToStorage = (updatedTemplates: WorkspaceTemplate[]) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTemplates));
    };

    const saveTemplate = useCallback((name: string, data: Omit<WorkspaceTemplate, 'id' | 'name'>): string => {
        const newTemplate: WorkspaceTemplate = {
            id: `template-${Date.now()}`,
            name,
            ...data,
        };
        setTemplates(prev => {
            const updated = [...prev, newTemplate];
            saveTemplatesToStorage(updated);
            return updated;
        });
        return newTemplate.id;
    }, []);

    const deleteTemplate = useCallback((id: string) => {
        setTemplates(prev => {
            const updated = prev.filter(t => t.id !== id);
            saveTemplatesToStorage(updated);
            return updated;
        });
    }, []);
    
    return {
        templates,
        saveTemplate,
        deleteTemplate,
    };
}