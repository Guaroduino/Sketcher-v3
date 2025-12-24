import React, { useState } from 'react';
import { XIcon, BookOpenIcon, EditIcon, ImageIcon, ZapIcon, GridIcon } from '../icons';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HelpSection = 'intro' | 'sketch' | 'render' | 'free' | 'shortcuts';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState<HelpSection>('intro');

    if (!isOpen) return null;

    const sections = [
        { id: 'intro', label: 'Introducción', icon: BookOpenIcon },
        { id: 'sketch', label: 'Modo Boceto', icon: EditIcon },
        { id: 'render', label: 'Modo Render', icon: ImageIcon },
        { id: 'free', label: 'Modo Libre', icon: ZapIcon },
        { id: 'shortcuts', label: 'Atajos/Herramientas', icon: GridIcon },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 md:p-8">
            <div className="bg-theme-bg-secondary w-full max-w-5xl h-full max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex border border-theme-bg-tertiary">

                {/* Sidebar Navigation */}
                <div className="w-64 bg-theme-bg-primary border-r border-theme-bg-tertiary flex flex-col hidden md:flex">
                    <div className="p-6 border-b border-theme-bg-tertiary">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <BookOpenIcon className="w-6 h-6 text-theme-accent-primary" />
                            Manual
                        </h2>
                    </div>
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as HelpSection)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeSection === section.id
                                        ? 'bg-theme-accent-primary text-white font-bold shadow-md'
                                        : 'text-theme-text-secondary hover:bg-theme-bg-tertiary hover:text-theme-text-primary'
                                    }`}
                            >
                                <section.icon className="w-5 h-5" />
                                {section.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col relative bg-theme-bg-secondary">
                    {/* Mobile Header */}
                    <div className="md:hidden p-4 border-b border-theme-bg-tertiary flex items-center justify-between bg-theme-bg-primary">
                        <select
                            value={activeSection}
                            onChange={(e) => setActiveSection(e.target.value as HelpSection)}
                            className="bg-theme-bg-tertiary text-theme-text-primary p-2 rounded outline-none"
                        >
                            {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <button onClick={onClose}><XIcon className="w-6 h-6" /></button>
                    </div>

                    {/* Desktop Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-theme-bg-tertiary hover:bg-theme-bg-hover rounded-full text-theme-text-secondary transition-colors hidden md:block"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>

                    <div className="flex-1 overflow-y-auto p-8 md:p-12 prose prose-invert max-w-none">
                        {activeSection === 'intro' && (
                            <div className="space-y-6">
                                <h1 className="text-3xl font-bold text-theme-text-primary">Bienvenido a Sketcher Companion</h1>
                                <p className="text-lg text-theme-text-secondary leading-relaxed">
                                    Sketcher Companion combina herramientas de dibujo vectorial de precisión con potentes modelos de inteligencia artificial para transformar garabatos simples en visualizaciones complejas.
                                </p>

                                <div className="aspect-video bg-black/40 rounded-xl border border-theme-bg-tertiary flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-theme-accent-primary transition-colors">
                                    <div className="text-center">
                                        <p className="font-bold text-theme-text-secondary">[VIDEO: Tour General de la Interfaz]</p>
                                        <p className="text-xs text-theme-text-tertiary mt-2">Próximamente</p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                    <div className="p-6 bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary">
                                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                            <EditIcon className="w-5 h-5 text-blue-400" /> Dibuja sin límites
                                        </h3>
                                        <p className="text-sm text-theme-text-secondary">Un lienzo infinito con herramientas de vectoriales precisas.</p>
                                    </div>
                                    <div className="p-6 bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary">
                                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                            <ZapIcon className="w-5 h-5 text-yellow-400" /> Potenciado por IA
                                        </h3>
                                        <p className="text-sm text-theme-text-secondary">Convierte trazos en renders fotorealistas con Gemini 2.0.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'sketch' && (
                            <div className="space-y-8">
                                <h1 className="text-3xl font-bold text-theme-text-primary">Modo Boceto</h1>

                                <section>
                                    <h3 className="text-xl font-bold text-theme-accent-primary mb-4">Barra de Herramientas</h3>
                                    <p className="mb-4 text-theme-text-secondary">Utiliza las herramientas vectoriales para crear la base de tu diseño. La IA seguirá estas líneas fielmente.</p>

                                    <div className="aspect-[4/1] bg-theme-bg-primary rounded-lg border border-theme-bg-tertiary flex items-center justify-center mb-4">
                                        <span className="text-theme-text-tertiary text-sm">[IMAGEN: Diagrama de la Barra de Herramientas]</span>
                                    </div>

                                    <ul className="list-disc pl-5 space-y-2 text-theme-text-secondary">
                                        <li><strong>Lápiz (P):</strong> Para trazos libres y orgánicos.</li>
                                        <li><strong>Línea (L):</strong> Trazos rectos precisos. Mantén Shift para líneas ortogonales (0°, 45°, 90°).</li>
                                        <li><strong>Polilínea:</strong> Conecta múltiples segmentos de línea continua.</li>
                                        <li><strong>Formas:</strong> Rectángulos y círculos para definir volúmenes rápidos.</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-theme-accent-primary mb-4">Guías y Asistentes</h3>
                                    <p className="text-theme-text-secondary">Activa las guías isométricas o de perspectiva desde la barra superior para mantener la proporción.</p>
                                </section>
                            </div>
                        )}

                        {activeSection === 'render' && (
                            <div className="space-y-6">
                                <h1 className="text-3xl font-bold text-theme-text-primary">Modo Render</h1>
                                <p className="text-lg text-theme-text-secondary">
                                    Transforma tu lineart en una imagen final utilizando el motor de IA.
                                </p>

                                <div className="space-y-8 mt-6">
                                    <div className="p-6 bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary">
                                        <h3 className="text-xl font-bold mb-4">1. Define tu Escena</h3>
                                        <p className="mb-4 text-theme-text-secondary">Selecciona si es un <strong>Interior</strong>, <strong>Exterior</strong> u <strong>Objeto</strong>. Esto ajusta el entendimiento espacial de la IA.</p>
                                    </div>

                                    <div className="p-6 bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary">
                                        <h3 className="text-xl font-bold mb-4">2. Estilo Visual</h3>
                                        <p className="mb-4 text-theme-text-secondary">Elige la estética final. "Fotorealista" intentará imitar la realidad, mientras que "Boceto a Tinta" mantendrá un estilo artístico.</p>
                                        <div className="h-20 bg-theme-bg-secondary/50 rounded flex items-center justify-center text-xs text-theme-text-tertiary border border-dashed border-theme-bg-tertiary">
                                            [IMAGEN: Ejemplos de Estilos]
                                        </div>
                                    </div>

                                    <div className="p-6 bg-theme-bg-primary rounded-xl border border-theme-bg-tertiary">
                                        <h3 className="text-xl font-bold mb-4">3. El Prompt</h3>
                                        <p className="text-theme-text-secondary">
                                            Describe materiales, iluminación, clima y atmósfera. Ejemplo: <em>"Madera de roble claro, iluminación suave de atardecer, estilo minimalista."</em>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'free' && (
                            <div className="space-y-6">
                                <h1 className="text-3xl font-bold text-theme-text-primary">Modo Libre (Canvas Infinito)</h1>
                                <p className="text-lg text-theme-text-secondary">
                                    El Modo Libre te permite combinar múltiples generaciones en un solo lienzo infinito.
                                </p>

                                <div className="aspect-video bg-black/40 rounded-xl border border-theme-bg-tertiary flex items-center justify-center mb-6 text-theme-text-tertiary">
                                    [VIDEO: Demostración de Modo Libre]
                                </div>

                                <h3 className="text-xl font-bold text-theme-accent-primary">Flujo de Trabajo</h3>
                                <ol className="list-decimal pl-5 space-y-4 text-theme-text-secondary">
                                    <li>
                                        <strong>Genera Objetos:</strong> Crea elementos individuales (sillas, árboles, personas) y arrástralos al lienzo.
                                    </li>
                                    <li>
                                        <strong>Compón la Escena:</strong> Organiza los elementos, ajústalos de tamaño y posición.
                                    </li>
                                    <li>
                                        <strong>Chat con el Asistente:</strong> Usa el panel lateral para pedirle a la IA que "genere un fondo de bosque" o "añada sombras a la escena".
                                    </li>
                                </ol>
                            </div>
                        )}

                        {activeSection === 'shortcuts' && (
                            <div className="space-y-6">
                                <h1 className="text-3xl font-bold text-theme-text-primary">Atajos de Teclado</h1>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-theme-bg-primary p-4 rounded-lg border border-theme-bg-tertiary">
                                        <h3 className="text-theme-accent-primary font-bold mb-3">Herramientas</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Seleccionar</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">V</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Lápiz</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">P</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Línea</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">L</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Borrador</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">E</kbd></div>
                                        </div>
                                    </div>
                                    <div className="bg-theme-bg-primary p-4 rounded-lg border border-theme-bg-tertiary">
                                        <h3 className="text-theme-accent-primary font-bold mb-3">Acciones</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Deshacer</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">Ctrl + Z</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Rehacer</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">Ctrl + Y</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Guardar</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">Ctrl + S</kbd></div>
                                            <div className="flex justify-between border-b border-theme-bg-tertiary/50 pb-1"><span className="text-theme-text-secondary">Renderizar</span> <kbd className="bg-theme-bg-tertiary px-2 rounded font-mono text-theme-text-primary">Enter</kbd></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
