import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { SendIcon, PaperClipIcon, SparklesIcon, SaveIcon, FolderIcon, TrashIcon, XIcon, DownloadIcon, EditIcon, ImageIcon, PlusIcon } from './icons';
// import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_ID } from '../utils/constants';
import { generateContentWithRetry } from '../utils/aiUtils';
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
    onSaveToLibrary: (file: File) => void;
    deductCredit?: () => Promise<boolean>;
    onInspectRequest?: (payload: { model: string; parts: any[]; config?: any }) => Promise<boolean>;
    libraryItems: LibraryItem[];
    selectedModel: string;
    onSendToSketch?: (url: string) => void;
    lastRenderedImage?: string | null;
}

export interface FreeModeViewHandle {
    addAttachment: (dataUrl: string) => void;
    getFullState: () => any;
    setFullState: (state: any) => void;
}

export const FreeModeView = forwardRef<FreeModeViewHandle, FreeModeViewProps>(({
    user,
    onImportFromSketch,
    lastRenderedImage,
    onSaveToLibrary,
    deductCredit,
    libraryItems = [],
    onInspectRequest,
    selectedModel,
    onSendToSketch
}, ref) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', role: 'model', content: 'Hola! Soy tu asistente creativo visual. Escribe un prompt (y opcionalmente adjunta imágenes) y generaré una nueva imagen para ti.', timestamp: Date.now() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [attachments, setAttachments] = useState<string[]>([]);
    const [generationMode, setGenerationMode] = useState<'image' | 'text'>('image');

    // Expose addAttachment via ref
    useImperativeHandle(ref, () => ({
        addAttachment: (dataUrl: string) => {
            setAttachments(prev => [...prev, dataUrl]);
        },
        getFullState: () => {
            return {
                messages,
                attachments
            };
        },
        setFullState: (state: any) => {
            if (!state) return;
            if (state.messages) setMessages(state.messages);
            if (state.attachments) setAttachments(state.attachments);
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

    // Helper to fetch any image (dataURL or remote URL) and return { mimeType, data } for Gemini
    const fetchAsBase64 = async (url: string): Promise<{ mimeType: string, data: string }> => {
        if (url.startsWith('data:')) {
            const mimeType = url.substring(url.indexOf(':') + 1, url.indexOf(';'));
            const data = url.split(',')[1];
            return { mimeType, data };
        }

        // It's a remote URL, fetch it
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const blob = await response.blob();
            const mimeType = blob.type;

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve({ mimeType, data: base64 });
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error in fetchAsBase64:", error);
            // Fallback: try to guess mime from extension if fetch fails, though data will be empty
            return { mimeType: 'image/jpeg', data: '' };
        }
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
            // const client = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

            const parts: any[] = [];
            // Add attachments first (common practice for multimodal)
            for (const att of newUserMessage.attachments || []) {
                try {
                    const { mimeType, data } = await fetchAsBase64(att);
                    if (data) {
                        parts.push({
                            inlineData: {
                                mimeType: mimeType,
                                data: data
                            }
                        });
                    }
                } catch (err) {
                    console.warn("Could not process attachment:", att, err);
                    // Continue with other parts
                }
            }

            // Add text prompt
            if (newUserMessage.content) {
                parts.push({ text: newUserMessage.content });
            }

            const model = selectedModel || GEMINI_MODEL_ID;

            // Config based on mode
            const config = generationMode === 'image' ? { responseModalities: ["IMAGE"] } : undefined;
            const contents = { parts };

            // For Text Mode, we add a system instruction (prepended to prompt or as separate context if API supported it, here just prepend text)
            if (generationMode === 'text') {
                const systemPrompt = "Actúa como un asistente experto en ingeniería de prompts para generación de imágenes. Ayuda al usuario a crear, refinar y mejorar sus prompts. Ofrece sugerencias creativas y técnicas. Responde únicamente con texto (no generes imágenes).";
                // Prepend to parts
                // Use a dedicated text part if possible
                const lastTextPart = parts.findLast(p => p.text);
                if (lastTextPart) {
                    lastTextPart.text = `${systemPrompt}\n\nUser Query: ${lastTextPart.text}`;
                } else {
                    parts.push({ text: systemPrompt });
                }
            }

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

            // Replace direct call with retry utility
            const response = await generateContentWithRetry(import.meta.env.VITE_GEMINI_API_KEY, model, contents, config);


            // Extract Response Parts
            let newImageBase64: string | null = null;
            let responseText = '';

            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
                for (const part of candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        newImageBase64 = part.inlineData.data;
                    }
                    if (part.text) {
                        responseText += part.text;
                    }
                }
            }

            if (newImageBase64 || responseText) {
                // Deduct Credit
                if (deductCredit) await deductCredit();

                const aiMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: responseText || (newImageBase64 ? 'Imagen generada:' : ''),
                    attachments: newImageBase64 ? [`data:image/png;base64,${newImageBase64}`] : undefined,
                    timestamp: Date.now(),
                    isImageOnly: !!newImageBase64 && !responseText
                };
                setMessages([...newMessages, aiMessage]);
            } else {
                throw new Error("El modelo no devolvió ninguna respuesta válida.");
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
                                                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onSaveToLibrary(dataURLtoBlob(att) as any); }}
                                                            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full"
                                                            title="Guardar en librería"
                                                        >
                                                            <FolderIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const link = document.createElement('a');
                                                                link.href = att;
                                                                link.download = `generated-image-${Date.now()}.png`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            }}
                                                            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full"
                                                            title="Descargar"
                                                        >
                                                            <DownloadIcon className="w-4 h-4" />
                                                        </button>
                                                        {onSendToSketch && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onSendToSketch(att); }}
                                                                className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full"
                                                                title="Enviar a Sketch"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setAttachments(prev => [...prev, att]); }}
                                                            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors group"
                                                            title="Agregar al chat (usar como referencia)"
                                                        >
                                                            <PlusIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {msg.content && <p className="whitespace-pre-wrap select-text">{msg.content}</p>}
                            </div>
                            <span className="text-[10px] text-theme-text-secondary mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}

                    {isGenerating && (
                        <div className="self-start flex items-center gap-2 p-3 bg-theme-bg-tertiary rounded-2xl rounded-tl-none animate-pulse">
                            <SparklesIcon className="w-4 h-4 text-theme-accent-primary animate-spin" />
                            <span className="text-sm text-theme-text-secondary">{generationMode === 'image' ? "Generando imagen (Gemini Vision)..." : "Pensando..."}</span>
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

                    {/* Mode Toggle */}
                    <div className="flex justify-center mb-2">
                        <div className="flex bg-theme-bg-secondary rounded-full p-1 border border-theme-bg-tertiary">
                            <button
                                onClick={() => setGenerationMode('image')}
                                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1 ${generationMode === 'image' ? 'bg-theme-accent-primary text-white shadow-sm' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}
                            >
                                <ImageIcon className="w-3 h-3" /> Imagen
                            </button>
                            <button
                                onClick={() => setGenerationMode('text')}
                                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1 ${generationMode === 'text' ? 'bg-theme-accent-primary text-white shadow-sm' : 'text-theme-text-secondary hover:text-theme-text-primary'}`}
                            >
                                <EditIcon className="w-3 h-3" /> Chat / Prompt Helper
                            </button>
                        </div>
                    </div>

                    <div className="flex items-end gap-2 max-w-4xl mx-auto w-full">
                        <div className="relative flex-grow flex items-end bg-theme-bg-secondary rounded-2xl border border-theme-bg-tertiary px-2 focus-within:ring-2 focus-within:ring-theme-accent-primary shadow-sm hover:border-theme-bg-hover transition-all">
                            {/* Import Sketch Action */}
                            <button
                                onClick={handleImportSketch}
                                className="p-3 text-theme-text-secondary hover:text-theme-accent-primary rounded-full transition-colors group mb-0.5"
                                title="Importar desde Sketch"
                            >
                                <ImageIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                            </button>

                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder={generationMode === 'image' ? "Describe la imagen que quieres generar..." : "Escribe para recibir ayuda con tus prompts..."}
                                className="flex-grow bg-transparent text-theme-text-primary pl-2 pr-12 py-3 max-h-48 min-h-[52px] focus:outline-none resize-none text-sm"
                                rows={1}
                            />

                            {/* Attachment Action */}
                            <button
                                onClick={() => setAttachmentModalOpen(true)}
                                className="absolute right-3 bottom-2 p-2 text-theme-text-secondary hover:text-theme-accent-primary rounded-full transition-colors"
                                title="Subir imagen"
                            >
                                <PaperClipIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Send Action */}
                        <button
                            onClick={handleSendMessage}
                            disabled={(!inputValue.trim() && attachments.length === 0) || isGenerating}
                            className={`p-3.5 rounded-full shadow-lg transition-all ${(!inputValue.trim() && attachments.length === 0) || isGenerating
                                ? 'bg-theme-bg-tertiary text-theme-text-tertiary cursor-not-allowed'
                                : 'bg-theme-accent-primary text-white hover:scale-110 active:scale-95 hover:shadow-theme-accent-primary/20'
                                }`}
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            {/* Saved Prompts Sidebar (Overlay) */}
            <div className={`absolute top-0 right-0 h-full bg-theme-bg-primary border-l border-theme-bg-tertiary transition-transform duration-300 z-20 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '256px' }}>
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
