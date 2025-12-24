import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, deleteDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebaseConfig'; // Added storage
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Added storage functions
import { PhotoIcon, XIcon, UserIcon, CalendarIcon, TrashIcon, PlusIcon, ImageIcon } from './icons'; // Added PlusIcon
import { GalleryUploadModal } from './modals/GalleryUploadModal';

interface PublicGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    isAdmin?: boolean;
    currentUser?: any;
}

interface PublicImage {
    id: string;
    imageUrl: string;
    thumbnailUrl?: string;
    inputImageUrl?: string;
    refImageUrl?: string;
    title: string;
    authorName: string;
    authorId?: string;
    createdAt: any;
    description: string;
    likes: number;
}

export const PublicGallery: React.FC<PublicGalleryProps> = ({ isOpen, onClose, isAdmin = false, currentUser }) => {
    const [images, setImages] = useState<PublicImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<PublicImage | null>(null);
    const [editingImage, setEditingImage] = useState<PublicImage | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
                    thumbnailUrl: data.thumbnailUrl,
                    inputImageUrl: data.inputImageUrl, // New field
                    refImageUrl: data.refImageUrl,     // New field
                    title: data.title || 'Untitled',
                    authorName: data.authorName || 'Anonymous',
                    authorId: data.userId || data.authorId,
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

    const handleDelete = async (e: React.MouseEvent, imageId: string, imageAuthorId?: string) => {
        e.stopPropagation();

        const isOwner = currentUser && imageAuthorId && currentUser.uid === imageAuthorId;

        if (!isAdmin && !isOwner) {
            alert("No tienes permiso para eliminar esta imagen.");
            return;
        }

        if (window.confirm("¿Seguro que quieres eliminar esta imagen de la galería pública? Se guardará en el archivo.")) {
            try {
                // 1. Get current doc
                const docRef = doc(db, 'public_gallery', imageId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // 2. Add to archive
                    await addDoc(collection(db, 'public_gallery_archive'), {
                        ...data,
                        archivedAt: serverTimestamp(),
                        deletedBy: isAdmin ? 'admin' : 'author',
                        deleterId: currentUser?.uid || 'unknown',
                        originalId: imageId
                    });
                    // 3. Delete from public gallery
                    await deleteDoc(docRef);

                    setImages(prev => prev.filter(img => img.id !== imageId));
                    if (selectedImage?.id === imageId) setSelectedImage(null);
                }
            } catch (error) {
                console.error("Error deleting image:", error);
                alert("Error al eliminar la imagen.");
            }
        }
    };

    const handleEdit = (e: React.MouseEvent, image: PublicImage) => {
        e.stopPropagation();
        setEditingImage(image);
        setIsUploadModalOpen(true);
    };

    const handleUploadComplete = (newOrUpdatedImage: any) => {
        if (editingImage) {
            // Update existing
            setImages(prev => prev.map(img => img.id === newOrUpdatedImage.id ? newOrUpdatedImage : img));
            if (selectedImage?.id === newOrUpdatedImage.id) {
                setSelectedImage(newOrUpdatedImage);
            }
        } else {
            // Add new
            setImages(prev => [newOrUpdatedImage, ...prev]);
        }
    };

    const closeUploadModal = () => {
        setIsUploadModalOpen(false);
        setEditingImage(null);
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
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-accent-primary text-white text-sm font-bold hover:bg-theme-accent-secondary transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Publicar</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-theme-bg-tertiary rounded-full text-theme-text-secondary hover:text-theme-text-primary transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
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
                            {images.map((img) => {
                                const canEdit = isAdmin || (currentUser && img.authorId && currentUser.uid === img.authorId);
                                return (
                                    <div
                                        key={img.id}
                                        className="group relative aspect-square rounded-xl overflow-hidden bg-theme-bg-tertiary cursor-pointer border border-transparent hover:border-theme-accent-primary transition-all hover:shadow-lg"
                                        onClick={() => setSelectedImage(img)}
                                    >
                                        <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />

                                        {/* Action Buttons (Top Right) */}
                                        {canEdit && (
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                                                <button
                                                    onClick={(e) => handleEdit(e, img)}
                                                    className="p-2 bg-black/60 hover:bg-theme-accent-primary rounded-full text-white shadow-sm backdrop-blur-sm"
                                                    title="Editar"
                                                >
                                                    <PlusIcon className="w-4 h-4 rotate-45" /> {/* Using PlusIcon rotated as rough edit icon or maybe I should use an EditIcon if available?? I'll stick to what I have or check imports */}
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, img.id, img.authorId)}
                                                    className="p-2 bg-red-500/90 hover:bg-red-600 rounded-full text-white shadow-sm"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                            <p className="text-white font-bold text-sm truncate">{img.title}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xs text-gray-300 flex items-center gap-1">
                                                    <UserIcon className="w-3 h-3" /> {img.authorName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Image Detail View (Modal over Gallery) */}
            {selectedImage && (
                <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4">
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors z-[80]"
                    >
                        <XIcon className="w-8 h-8" />
                    </button>

                    <div className="max-w-6xl w-full flex flex-col lg:flex-row gap-6 bg-theme-bg-secondary p-1 rounded-xl overflow-hidden h-full max-h-[90vh]">
                        {/* Main Image View */}
                        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] overflow-hidden">
                            <img src={selectedImage.imageUrl} alt={selectedImage.title} className="max-w-full max-h-full object-contain" />
                        </div>

                        {/* Sidebar Info */}
                        <div className="w-full lg:w-96 bg-theme-bg-secondary p-6 flex flex-col text-theme-text-primary overflow-y-auto">
                            <h3 className="text-2xl font-bold mb-2">{selectedImage.title}</h3>
                            <div className="flex items-center gap-2 text-theme-text-secondary mb-6 pb-6 border-b border-theme-bg-tertiary">
                                <div className="p-2 bg-theme-bg-tertiary rounded-full">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-sm font-bold">{selectedImage.authorName}</span>
                                    <span className="text-xs flex items-center gap-1 opacity-70">
                                        <CalendarIcon className="w-3 h-3" />
                                        {selectedImage.createdAt?.toDate ? selectedImage.createdAt.toDate().toLocaleDateString() : 'Reciente'}
                                    </span>
                                </div>
                            </div>

                            {/* Process Section */}
                            {(selectedImage.inputImageUrl || selectedImage.refImageUrl) && (
                                <div className="mb-6">
                                    <h4 className="text-xs font-bold uppercase text-theme-text-secondary mb-3 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" /> Proceso Creativo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedImage.inputImageUrl && (
                                            <div className="group relative aspect-square rounded overflow-hidden border border-theme-bg-tertiary">
                                                <img src={selectedImage.inputImageUrl} className="w-full h-full object-cover" />
                                                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 font-bold text-center">Input</span>
                                            </div>
                                        )}
                                        {selectedImage.refImageUrl && (
                                            <div className="group relative aspect-square rounded overflow-hidden border border-theme-bg-tertiary">
                                                <img src={selectedImage.refImageUrl} className="w-full h-full object-cover" />
                                                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 font-bold text-center">Referencia</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedImage.description && (
                                <div className="mb-6">
                                    <h4 className="text-xs font-bold uppercase text-theme-text-secondary mb-2">Descripción</h4>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedImage.description}</p>
                                </div>
                            )}

                            {/* Actions */}
                            {(isAdmin || (currentUser && selectedImage.authorId && currentUser.uid === selectedImage.authorId)) && (
                                <div className="mt-auto pt-6 border-t border-theme-bg-tertiary flex flex-col gap-2">
                                    <button
                                        onClick={(e) => handleEdit(e, selectedImage)}
                                        className="w-full p-2 bg-theme-accent-primary/10 hover:bg-theme-accent-primary/20 text-theme-accent-primary rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PlusIcon className="w-4 h-4 rotate-45" /> {/* Placeholder for edit icon */}
                                        <span className="text-xs font-bold">Editar Publicación</span>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, selectedImage.id, selectedImage.authorId)}
                                        className="w-full p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span className="text-xs font-bold">Eliminar Publicación</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <GalleryUploadModal
                isOpen={isUploadModalOpen}
                onClose={closeUploadModal}
                currentUser={currentUser}
                onUploadComplete={handleUploadComplete}
                initialData={editingImage}
            />
        </div>
    );
};
