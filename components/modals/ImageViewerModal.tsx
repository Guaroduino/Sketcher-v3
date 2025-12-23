import React, { useState, useRef, useEffect } from 'react';
import { XIcon, ZoomInIcon, ZoomOutIcon } from '../icons';

interface ImageViewerModalProps {
    imageUrl: string | null;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, onClose }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (imageUrl) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [imageUrl]);

    if (!imageUrl) return null;

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(0.1, scale * delta), 10);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col" onClick={onClose}>
            {/* Toolbar */}
            <div className="flex justify-between items-center p-4 z-10" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2 bg-theme-bg-secondary/80 backdrop-blur rounded-lg p-2">
                    <button onClick={() => setScale(s => Math.min(s + 0.1, 10))} className="p-2 hover:bg-white/10 rounded-full text-white" title="Zoom In">
                        <ZoomInIcon className="w-5 h-5" />
                    </button>
                    <span className="text-white font-mono text-sm flex items-center w-16 justify-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-white/10 rounded-full text-white" title="Zoom Out">
                        <ZoomOutIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="ml-2 text-xs text-white/70 hover:text-white flex items-center" title="Reset">
                        Reset
                    </button>
                </div>
                <button onClick={onClose} className="p-2 bg-theme-bg-secondary/50 hover:bg-theme-bg-secondary rounded-full text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Canvas Area */}
            <div
                className="flex-grow flex items-center justify-center overflow-hidden cursor-move relative"
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={e => e.stopPropagation()}
            >
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="View"
                    draggable={false}
                    className="max-w-none transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                    }}
                />
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none">
                Scroll para Zoom • Arrastrar para Mover • Doble Click para salir
            </div>
        </div>
    );
};
