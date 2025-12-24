import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, SparklesIcon, XIcon } from './icons';
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_ID } from '../utils/constants';

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
}

interface GuideChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
}

const SYSTEM_PROMPT = `You are a helpful and expert assistant for the "Sketcher Companion" app. 
Your goal is to guide the user on how to use the app, suggest prompts for architectural rendering, and provide creative ideas. 
You are strictly a text-based assistant in this chat. 
Keep your answers concise, friendly, and focused on helping the user create better sketches or renders. 
If asked about app features:
- "Sketch" tab is for drawing.
- "Render" tab is for turning sketches into photorealistic or artistic images.
- "Libre" (Free) mode is for open-ended AI image generation and editing.
`;

export const GuideChatSidebar: React.FC<GuideChatSidebarProps> = ({ isOpen, onClose, apiKey }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'model', content: '¡Hola! Soy tu guía de Sketcher. ¿En qué puedo ayudarte hoy? Pregúntame sobre cómo mejorar tus prompts o cómo usar las herramientas.', timestamp: Date.now() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsGenerating(true);

        try {
            // @ts-ignore
            const client = new GoogleGenAI({ apiKey });

            // Construct full history for stateless request
            const historyContents = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: "Entendido. Ayudaré al usuario con la app Sketcher Companion. ¿En qué puedo ayudarte hoy?" }] },
                ...messages.map(m => ({
                    role: m.role,
                    parts: [{ text: m.content }]
                }))
            ];

            const model = GEMINI_MODEL_ID;

            const response = await client.models.generateContent({
                model: model,
                contents: historyContents,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            });

            const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude generar una respuesta.";

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: responseText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error("Guide Chat Error:", error);
            setMessages(prev => [...prev, { id: 'err', role: 'model', content: 'Lo siento, tuve un problema al procesar eso. Inténtalo de nuevo.', timestamp: Date.now() }]);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={`h-full bg-theme-bg-secondary border-l border-theme-bg-tertiary shadow-xl transition-[width] duration-300 z-20 flex flex-col overflow-hidden flex-shrink-0 ${isOpen ? 'w-80' : 'w-0'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme-bg-tertiary bg-theme-bg-primary">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-theme-accent-primary" />
                    <h3 className="font-bold text-sm">Asistente Sketcher</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-theme-bg-tertiary rounded-full transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}>
                        <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-theme-accent-primary text-white rounded-tr-none' : 'bg-theme-bg-tertiary text-theme-text-primary rounded-tl-none'}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isGenerating && (
                    <div className="self-start p-3 bg-theme-bg-tertiary rounded-2xl rounded-tl-none animate-pulse">
                        <span className="text-xs text-theme-text-secondary">Escribiendo...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-theme-bg-primary border-t border-theme-bg-tertiary">
                <div className="relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Pregunta algo..."
                        className="w-full bg-theme-bg-secondary text-theme-text-primary text-sm rounded-full border border-theme-bg-tertiary pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent-primary"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isGenerating}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-theme-accent-primary text-white rounded-full disabled:opacity-50 hover:scale-105 transition-transform"
                    >
                        <SendIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
