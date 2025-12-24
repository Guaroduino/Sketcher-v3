import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PhotoIcon } from './icons';

interface LandingImage {
    id: string;
    imageUrl: string;
    title: string;
    authorName: string;
}

interface LandingGalleryCarouselProps {
    onOpenGallery: () => void;
}

export const LandingGalleryCarousel: React.FC<LandingGalleryCarouselProps> = ({ onOpenGallery }) => {
    const [images, setImages] = useState<LandingImage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const q = query(
                    collection(db, 'public_gallery'),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );
                const querySnapshot = await getDocs(q);
                const loadedImages: LandingImage[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.imageUrl) {
                        loadedImages.push({
                            id: doc.id,
                            imageUrl: data.imageUrl,
                            title: data.title || 'Untitled',
                            authorName: data.authorName || 'Artist'
                        });
                    }
                });
                setImages(loadedImages);
            } catch (error) {
                console.error("Error fetching landing images:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, []);

    if (loading) return null; // Invisible while loading
    if (images.length === 0) return null;

    return (
        <div className="w-full max-w-4xl mx-auto mt-8 mb-8">
            <div className="flex items-center justify-between mb-4 px-4">
                <h3 className="text-theme-text-secondary text-sm font-bold uppercase tracking-wider">Inspiración Reciente</h3>
                <button
                    onClick={onOpenGallery}
                    className="text-theme-accent-primary text-sm hover:underline flex items-center gap-1"
                >
                    <PhotoIcon className="w-4 h-4" />
                    Ver Galería
                </button>
            </div>

            <div
                className="flex gap-4 overflow-x-auto pb-6 px-4 scrollbar-thin scrollbar-thumb-theme-bg-tertiary scrollbar-track-transparent snap-x"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Add a "Explore" card at start */}
                <div
                    onClick={onOpenGallery}
                    className="flex-shrink-0 w-32 h-40 bg-theme-bg-tertiary rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-theme-bg-hover transition-colors snap-start border border-theme-bg-tertiary group"
                >
                    <div className="p-3 bg-theme-bg-secondary rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <PhotoIcon className="w-6 h-6 text-theme-accent-primary" />
                    </div>
                    <span className="text-xs font-bold text-theme-text-primary">Explorar</span>
                </div>

                {images.map((img) => (
                    <div
                        key={img.id}
                        className="flex-shrink-0 w-60 h-40 relative rounded-lg overflow-hidden snap-start cursor-pointer border border-theme-bg-tertiary group"
                        onClick={onOpenGallery}
                    >
                        <img
                            src={img.imageUrl}
                            alt={img.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <p className="text-white text-xs font-bold truncate">{img.title}</p>
                            <p className="text-gray-300 text-[10px] truncate">por {img.authorName}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
