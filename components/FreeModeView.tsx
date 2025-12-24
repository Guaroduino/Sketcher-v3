import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { SendIcon, PaperClipIcon, SparklesIcon, SaveIcon, FolderIcon, TrashIcon, XIcon, DownloadIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_ID } from '../utils/constants';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from 'firebase/auth';

import type { LibraryItem } from '../types';
import { AttachmentImportModal } from './modals/AttachmentImportModal';
import { ImageViewerModal } from './modals/ImageViewerModal';
import { GuideChatSidebar } from './GuideChatSidebar';

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string; // For user: text prompt. For model: usually empty if image-only, or description.
    attachments?: string[]; // Data URLs
    timestamp: number;
    isImageOnly?: boolean; // Flag to indicate if the model's response is purely an image
}

interface SavedPrompt {
    id: string;
    title: string;
    messages: Message[];
    updatedAt: any;
}

interface FreeModeViewProps {
    user: User | null;
    onImportFromSketch: () => string | null;
    lastRenderedImage: string | null;
    onSaveToLibrary: (file: File) => void;
    deductCredit?: () => Promise<boolean>;
    onInspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>;
    libraryItems: LibraryItem[];
    selectedModel: string;
}

export interface FreeModeViewHandle {
    addAttachment: (dataUrl: string) => void;
}

export const FreeModeView = forwardRef<FreeModeViewHandle, FreeModeViewProps>(({
    user,
    onImportFromSketch,
    lastRenderedImage,
    onSaveToLibrary,
    deductCredit,
    libraryItems = [],
    onInspectRequest,
    selectedModel
}, ref) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', content: 'Hola! Soy tu asistente creativo visual. Escribe un prompt (y opcionalmente adjunta imágenes) y generaré una nueva imagen para ti.', timestamp: Date.now() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [attachments, setAttachments] = useState<string[]>([]);

    // Expose addAttachment via ref
    useImperativeHandle(ref, () => ({
        addAttachment: (dataUrl: string) => {
            setAttachments(prev => [...prev, dataUrl]);
        }
    }));

    // Persistence State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGuideSidebarOpen, setIsGuideSidebarOpen] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
    const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);

    // Modals
    const [isAttachmentModalOpen, setAttachmentModalOpen] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Auto-scroll to bottom
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // DataURL to Blob helper
    const dataURLtoBlob = (dataurl: string) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    };

    const handleSaveImageToLibrary = (dataUrl: string) => {
        if (!dataUrl) return;
        const blob = dataURLtoBlob(dataUrl);
        const file = new File([blob], `AI_FreeMode_${Date.now()}.png`, { type: 'image/png' });
        onSaveToLibrary(file);
        alert("Imagen guardada en la librería.");
    };

    // Persistence Fetching
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `users/${user.uid}/prompts`), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prompts: SavedPrompt[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SavedPrompt));
            setSavedPrompts(prompts);
        });
        return () => unsubscribe();
    }, [user]);

    const handleSavePrompt = async () => {
        if (!user) {
            alert("Debes iniciar sesión para guardar prompts.");
            return;
        }
        const title = prompt("Nombre para este chat:", "Mi Conversación");
        if (!title) return;

        try {
            const data = {
                title,
                messages,
                updatedAt: Timestamp.now()
            };
            await addDoc(collection(db, `users/${user.uid}/prompts`), data);
            alert("Guardado exitosamente.");
        } catch (error) {
            console.error("Error saving prompt:", error);
            alert("Error al guardar.");
        }
    };

    const handleLoadPrompt = (prompt: SavedPrompt) => {
        setMessages(prompt.messages);
        setCurrentPromptId(prompt.id);
        setIsSidebarOpen(false);
    };

    const handleDeletePrompt = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!user || !window.confirm("¿Eliminar este chat guardado?")) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/prompts`, id));
        } catch (error) {
            console.error("Error deleting prompt:", error);
        }
    };

    const handleSendMessage = async () => {
        if ((!inputValue.trim() && attachments.length === 0) || isGenerating) return;

        const newUserMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            attachments: [...attachments],
            timestamp: Date.now()
        };

        const newMessages = [...messages, newUserMessage];
        setMessages(newMessages);
        setInputValue('');
        setAttachments([]);
        setIsGenerating(true);

        try {
            // @ts-ignore
            const client = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

            const parts: any[] = [];
            // Add attachments first (common practice for multimodal)
            for (const att of newUserMessage.attachments || []) {
                const base64Data = att.split(',')[1];
                const mimeType = att.substring(att.indexOf(':') + 1, att.indexOf(';'));
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                });
            }

            // Add text prompt
            if (newUserMessage.content) {
                parts.push({ text: newUserMessage.content });
            }

            const model = selectedModel || GEMINI_MODEL_ID;
            // Config specific for Image Generation models
            const config = { responseModalities: ["IMAGE"] };
            const contents = { parts };

            // Inspector Check
            if (onInspectRequest) {
                // Prepend system note about image labels if referencing is needed
                const systemNote = newUserMessage.attachments && newUserMessage.attachments.length > 0
                    ? `[System Note: The user has attached ${newUserMessage.attachments.length} images. Use the label 'Img {n}' (e.g., Img 1, Img 2) to refer to specific images in your response. The index corresponds to the order of attachments.]\n\n`
                    : '';

                // Inject note into text part if exists, or create new text part
                const textPartIndex = parts.findIndex(p => p.text);
                if (textPartIndex !== -1) {
                    parts[textPartIndex].text = systemNote + parts[textPartIndex].text;
                } else if (systemNote) {
                    parts.push({ text: systemNote });
                }

                const confirmed = await onInspectRequest({ model, parts: contents.parts, config });
                if (!confirmed) {
                    setIsGenerating(false);
                    return; // Context cancelled
                }
            }

            const response = await client.models.generateContent({
                model,
                contents,
                config
            });

            // Extract Image
            let newImageBase64: string | null = null;
            // Check candidates
            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
                for (const part of candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        newImageBase64 = part.inlineData.data;
                        break;
                    }
                }
            }

            if (newImageBase64) {
                // Deduct Credit
                if (deductCredit) await deductCredit();

                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: 'Imagen generada:', // Placeholder text
                    attachments: [`data:image/png;base64,${newImageBase64}`],
                    timestamp: Date.now(),
                    isImageOnly: true
                };
                setMessages([...newMessages, aiMessage]);
            } else {
                throw new Error("No image generated. The model might have returned text instead.");
            }

        } catch (error) {
            console.error("Error generating content:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImportSketch = () => {
        const sketchDataUrl = onImportFromSketch();
        if (sketchDataUrl) {
            setAttachments(prev => [...prev, sketchDataUrl]);
        } else {
            alert("No hay nada en el Sketch para importar o ocurrió un error.");
        }
    };

    const handleImportRender = () => {
        if (lastRenderedImage) {
            setAttachments(prev => [...prev, lastRenderedImage]);
        } else {
            alert("No hay ningún render disponible.");
        }
    };

    return (
        <div className="flex h-full w-full bg-theme-bg-secondary text-theme-text-primary relative overflow-hidden">
            <AttachmentImportModal
                isOpen={isAttachmentModalOpen}
                onClose={() => setAttachmentModalOpen(false)}
                onFileSelected={(dataUrl) => {
                    setAttachments(prev => [...prev, dataUrl]);
                    setAttachmentModalOpen(false);
                }}
                libraryItems={libraryItems}
            />

            <ImageViewerModal
                imageUrl={viewingImage}
                onClose={() => setViewingImage(null)}
            />

            {/* Main Chat Area */}
            <div className="flex flex-col flex-grow h-full w-full relative min-w-0">
                {/* Header Controls */}
                <div className="absolute top-4 right-4 z-0 flex gap-2">
                    <button
                        onClick={() => {
                            setIsGuideSidebarOpen(!isGuideSidebarOpen);
                            setIsSidebarOpen(false);
                        }}
                        className={`p-2 rounded-full shadow-sm transition-colors ${isGuideSidebarOpen ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-primary'}`}
                        title="Asistente AI"
                    >
                        <SparklesIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            setIsSidebarOpen(!isSidebarOpen);
                            setIsGuideSidebarOpen(false);
                        }}
                        className={`p-2 rounded-full shadow-sm transition-colors ${isSidebarOpen ? 'bg-theme-accent-primary text-white' : 'bg-theme-bg-tertiary hover:bg-theme-bg-primary'}`}
                        title="Abrir guardados"
                    >
                        <FolderIcon className="w-5 h-5" />
                    </button>
                    <button onClick={handleSavePrompt} className="p-2 bg-theme-bg-tertiary rounded-full hover:bg-theme-bg-primary shadow-sm" title="Guardar conversación actual">
                        <SaveIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Chat Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}>
                            <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-theme-accent-primary text-white rounded-tr-none' : 'bg-theme-bg-tertiary text-theme-text-primary rounded-tl-none'} shadow-sm`}>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {msg.attachments.map((att, idx) => (
                                            <div key={idx} className="relative group">
                                                <img
                                                    src={att}
                                                    alt="attachment"
                                                    className="w-64 h-auto object-cover rounded-md border border-white/20 cursor-zoom-in"
                                                    onDoubleClick={() => setViewingImage(att)}
                                                    title="Doble click para ampliar"
                                                />
                                                <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md pointer-events-none">
                                                    Img {idx + 1}
                                                </span>
                                                {msg.role === 'model' && (
                                                    <button
                                                        onClick={() => handleSaveImageToLibrary(att)}
                                                        className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Guardar en librería"
                                                    >
                                                        <DownloadIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                            </div>
                            <span className="text-[10px] text-theme-text-secondary mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}

                    {isGenerating && (
                        <div className="self-start flex items-center gap-2 p-3 bg-theme-bg-tertiary rounded-2xl rounded-tl-none animate-pulse">
                            <SparklesIcon className="w-4 h-4 text-theme-accent-primary animate-spin" />
                            <span className="text-sm text-theme-text-secondary">Generando imagen (Gemini Vision)...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 p-4 bg-theme-bg-primary border-t border-theme-bg-tertiary">
                    {/* Visual Prompting / Attachment Strip */}
                    {attachments.length > 0 && (
                        <div className="flex gap-2 mb-2 overflow-x-auto py-2">
                            {attachments.map((att, idx) => (
                                <div key={idx} className="relative group flex-shrink-0">
                                    <img
                                        src={att}
                                        alt={`att-${idx}`}
                                        className="h-16 w-16 object-cover rounded-md border border-theme-bg-tertiary cursor-pointer"
                                        onClick={() => setViewingImage(att)}
                                    />
                                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded pointer-events-none">
                                        Img {idx + 1}
                                    </span>
                                    <button
                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <div className="flex gap-1 mr-2">
                            <button onClick={handleImportSketch} className="p-2 text-theme-text-secondary hover:text-theme-accent-primary hover:bg-theme-bg-secondary rounded-full transition-colors" title="Importar desde Sketch">
                                <span className="font-bold text-xs">SK</span>
                            </button>
                            <button onClick={handleImportRender} className="p-2 text-theme-text-secondary hover:text-theme-accent-primary hover:bg-theme-bg-secondary rounded-full transition-colors" title="Importar último Render">
                                <span className="font-bold text-xs">RE</span>
                            </button>
                        </div>

                        <div className="relative flex-grow">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Describe la imagen que quieres generar..."
                                className="w-full bg-theme-bg-secondary text-theme-text-primary rounded-xl border border-theme-bg-tertiary pl-4 pr-12 py-3 max-h-32 min-h-[50px] focus:outline-none focus:ring-2 focus:ring-theme-accent-primary resize-none"
                                rows={1}
                            />
                            <button
                                onClick={() => setAttachmentModalOpen(true)}
                                className="absolute right-2 bottom-2 p-2 text-theme-text-secondary hover:text-theme-accent-primary rounded-full transition-colors"
                                title="Subir imagen"
                            >
                                <PaperClipIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <button
                            onClick={handleSendMessage}
                            disabled={(!inputValue.trim() && attachments.length === 0) || isGenerating}
                            className={`p-3 rounded-full shadow-lg transition-all ${(!inputValue.trim() && attachments.length === 0) || isGenerating
                                ? 'bg-theme-bg-tertiary text-theme-text-secondary cursor-not-allowed'
                                : 'bg-theme-accent-primary text-white hover:scale-105 active:scale-95'
                                }`}
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Saved Prompts Sidebar (Docked) */}
            <div className={`h-full bg-theme-bg-primary border-l border-theme-bg-tertiary transition-[width] duration-300 flex-shrink-0 z-10 flex flex-col overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
                <div className="flex items-center justify-between p-4 border-b border-theme-bg-tertiary w-64">
                    <h3 className="font-bold">Guardados</h3>
                    <button onClick={() => setIsSidebarOpen(false)}><XIcon className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto h-[calc(100%-4rem)] p-2 space-y-2 w-64">
                    {savedPrompts.map(p => (
                        <div key={p.id} onClick={() => handleLoadPrompt(p)} className="p-3 rounded-md bg-theme-bg-secondary hover:bg-theme-bg-tertiary cursor-pointer group relative">
                            <p className="font-medium text-sm truncate pr-6">{p.title}</p>
                            <span className="text-[10px] text-theme-text-secondary">{p.updatedAt?.toDate().toLocaleDateString()}</span>
                            <button onClick={(e) => handleDeletePrompt(e, p.id)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-600">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {savedPrompts.length === 0 && <p className="text-center text-theme-text-secondary text-sm p-4">No hay chats guardados.</p>}
                </div>
            </div>

            <GuideChatSidebar
                isOpen={isGuideSidebarOpen}
                onClose={() => setIsGuideSidebarOpen(false)}
                apiKey={import.meta.env.VITE_GEMINI_API_KEY}
            />
        </div>
    );
});
