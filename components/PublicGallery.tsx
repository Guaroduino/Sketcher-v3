import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PhotoIcon, XIcon, UserIcon, CalendarIcon } from './icons';

interface PublicGalleryProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PublicImage {
    id: string;
    imageUrl: string;
    title: string;
    authorName: string;
    createdAt: any;
    description?: string;
    likes?: number;
}

export const PublicGallery: React.FC<PublicGalleryProps> = ({ isOpen, onClose }) => {
    const [images, setImages] = useState<PublicImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPublicImages();
        }
    }, [isOpen]);

    const fetchPublicImages = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'public_gallery'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const querySnapshot = await getDocs(q);
            const loadedImages: PublicImage[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                loadedImages.push({
                    id: doc.id,
                    imageUrl: data.imageUrl,
                    title: data.title || 'Untitled',
                    authorName: data.authorName || 'Anonymous',
                    createdAt: data.createdAt,
                    description: data.description,
                    likes: data.likes || 0
                });
            });
            setImages(loadedImages);
        } catch (error) {
            console.error("Error fetching public gallery:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 md:p-8">
            <div className="bg-theme-bg-secondary w-full max-w-6xl h-full max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-theme-bg-tertiary">
                {/* Header */}
                <div className="p-4 border-b border-theme-bg-tertiary flex items-center justify-between bg-theme-bg-primary">
                    <div className="flex items-center gap-2">
                        <PhotoIcon className="w-6 h-6 text-theme-accent-primary" />
                        <h2 className="text-xl font-bold text-theme-text-primary">Galería Pública (Beta)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-theme-bg-tertiary rounded-full text-theme-text-secondary hover:text-theme-text-primary transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-theme-bg-tertiary">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-10 h-10 border-4 border-theme-accent-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-theme-text-secondary">Cargando inspiración...</p>
                        </div>
                    ) : images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-theme-text-secondary">
                            <PhotoIcon className="w-16 h-16 opacity-20 mb-4" />
                            <p>No hay imágenes públicas aún. ¡Sé el primero en publicar!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {images.map((img) => (
                                <div
                                    key={img.id}
                                    className="group relative aspect-square rounded-xl overflow-hidden bg-theme-bg-tertiary cursor-pointer border border-transparent hover:border-theme-accent-primary transition-all hover:shadow-lg"
                                    onClick={() => setSelectedImage(img)}
                                >
                                    <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-white font-bold text-sm truncate">{img.title}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-gray-300 flex items-center gap-1">
                                                <UserIcon className="w-3 h-3" /> {img.authorName}
                                            </span>
                                            {/* Future: Likes */}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Image Detail View (Modal over Gallery) */}
            {selectedImage && (
                <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4">
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                        <XIcon className="w-8 h-8" />
                    </button>

                    <div className="max-w-5xl w-full flex flex-col md:flex-row gap-6 bg-theme-bg-secondary p-1 rounded-xl overflow-hidden max-h-[90vh]">
                        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh]">
                            <img src={selectedImage.imageUrl} alt={selectedImage.title} className="max-w-full max-h-[80vh] object-contain" />
                        </div>
                        <div className="w-full md:w-80 bg-theme-bg-secondary p-6 flex flex-col text-theme-text-primary">
                            <h3 className="text-2xl font-bold mb-2">{selectedImage.title}</h3>
                            <div className="flex items-center gap-2 text-theme-text-secondary mb-6 pb-6 border-b border-theme-bg-tertiary">
                                <div className="p-2 bg-theme-bg-tertiary rounded-full">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">{selectedImage.authorName}</span>
                                    <span className="text-xs flex items-center gap-1 opacity-70">
                                        <CalendarIcon className="w-3 h-3" />
                                        {selectedImage.createdAt?.toDate ? selectedImage.createdAt.toDate().toLocaleDateString() : 'Reciente'}
                                    </span>
                                </div>
                            </div>

                            {selectedImage.description && (
                                <div className="mb-6">
                                    <h4 className="text-xs font-bold uppercase text-theme-text-secondary mb-2">Descripción</h4>
                                    <p className="text-sm leading-relaxed">{selectedImage.description}</p>
                                </div>
                            )}

                            <div className="mt-auto">
                                <button className="w-full py-3 bg-theme-accent-primary hover:bg-theme-accent-secondary text-white rounded-lg font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]">
                                    Usar como Referencia
                                </button>
                                <p className="text-[10px] text-center text-theme-text-tertiary mt-2">Próximamente</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
