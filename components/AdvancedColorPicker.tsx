import React, { useState, useEffect, useRef, useCallback } from 'react';

interface AdvancedColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

// Helper: Hex to HSV
function hexToHsv(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
}

// Helper: HSV to Hex
function hsvToHex(h: number, s: number, v: number) {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const AdvancedColorPicker: React.FC<AdvancedColorPickerProps> = ({ color, onChange }) => {
    const [hsv, setHsv] = useState(hexToHsv(color));
    const isDraggingSatVal = useRef(false);
    const isDraggingHue = useRef(false);
    const satValRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);

    // Sync external color changes to internal state (only if not dragging to avoid loops)
    useEffect(() => {
        if (!isDraggingSatVal.current && !isDraggingHue.current) {
            // Check if color actually changed enough to warrant update to prevent jitter?
            // Simple exact match check usually sufficient
            const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
            if (color.toLowerCase() !== currentHex.toLowerCase()) {
                setHsv(hexToHsv(color));
            }
        }
    }, [color]);

    const handleSatValChange = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!satValRef.current) return;
        const rect = satValRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        const newS = x * 100;
        const newV = (1 - y) * 100;

        setHsv(prev => {
            const next = { ...prev, s: newS, v: newV };
            onChange(hsvToHex(next.h, next.s, next.v));
            return next;
        });
    }, [onChange]);

    const handleHueChange = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

        const newH = x * 360;
        setHsv(prev => {
            const next = { ...prev, h: newH };
            onChange(hsvToHex(next.h, next.s, next.v));
            return next;
        });
    }, [onChange]);

    // Global events for dragging
    useEffect(() => {
        const handleUp = () => {
            isDraggingSatVal.current = false;
            isDraggingHue.current = false;
        };
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isDraggingSatVal.current) handleSatValChange(e as any);
            if (isDraggingHue.current) handleHueChange(e as any);
        };

        window.addEventListener('mouseup', handleUp);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });

        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchmove', handleMove);
        };
    }, [handleSatValChange, handleHueChange]);


    return (
        <div className="flex flex-col gap-3 w-64 select-none touch-none">
            {/* Saturation / Value Area */}
            <div
                ref={satValRef}
                className="w-full h-48 rounded-lg relative overflow-hidden cursor-crosshair shadow-inner"
                style={{
                    backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                    backgroundImage: `
                        linear-gradient(to top, #000, transparent),
                        linear-gradient(to right, #fff, transparent)
                    `
                }}
                onMouseDown={(e) => { isDraggingSatVal.current = true; handleSatValChange(e); }}
                onTouchStart={(e) => { isDraggingSatVal.current = true; handleSatValChange(e); }}
            >
                <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                        left: `${hsv.s}%`,
                        top: `${100 - hsv.v}%`,
                        backgroundColor: color
                    }}
                />
            </div>

            {/* Hue Slider */}
            <div
                ref={hueRef}
                className="w-full h-6 rounded-full relative cursor-pointer shadow-inner"
                style={{
                    background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
                }}
                onMouseDown={(e) => { isDraggingHue.current = true; handleHueChange(e); }}
                onTouchStart={(e) => { isDraggingHue.current = true; handleHueChange(e); }}
            >
                <div
                    className="absolute w-6 h-6 rounded-full border-2 border-white shadow bg-transparent -translate-x-1/2 top-0 pointer-events-none"
                    style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
            </div>
        </div>
    );
};
