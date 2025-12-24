import React, { useState, useRef } from 'react';
import { db, storage } from '../../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { XIcon, PlusIcon, ImageIcon, UploadIcon } from '../icons';

interface GalleryUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
    onUploadComplete: (newImage: any) => void;
}

export const GalleryUploadModal: React.FC<GalleryUploadModalProps> = ({ isOpen, onClose, currentUser, onUploadComplete }) => {
    const [mainImage, setMainImage] = useState<File | null>(null);
    const [inputImage, setInputImage] = useState<File | null>(null);
    const [refImage, setRefImage] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const titleRef = useRef<HTMLInputElement>(null);
    const descRef = useRef<HTMLTextAreaElement>(null);
    const mainInputRef = useRef<HTMLInputElement>(null);
    const inputInputRef = useRef<HTMLInputElement>(null);
    const refInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File | null>>) => {
        if (e.target.files && e.target.files[0]) {
            setter(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File, pathPrefix: string) => {
        const storageRef = ref(storage, `public-gallery/${pathPrefix}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mainImage) {
            alert("Debes seleccionar una imagen principal.");
            return;
        }

        setIsUploading(true);
        try {
            const mainUrl = await uploadFile(mainImage, 'main');
            let inputUrl = null;
            let refUrl = null;

            if (inputImage) inputUrl = await uploadFile(inputImage, 'inputs');
            if (refImage) refUrl = await uploadFile(refImage, 'refs');

            const title = titleRef.current?.value || mainImage.name.split('.')[0];
            const description = descRef.current?.value || '';

            const docData = {
                imageUrl: mainUrl,
                thumbnailUrl: mainUrl, // Use same URL for now
                inputImageUrl: inputUrl,
                refImageUrl: refUrl,
                title: title,
                description: description,
                authorName: currentUser?.displayName || 'Admin',
                authorId: currentUser?.uid,
                userId: currentUser?.uid,
                createdAt: serverTimestamp(),
                likes: 0,
                status: 'published'
            };

            const docRef = await addDoc(collection(db, 'public_gallery'), docData);

            // Notify parent to update UI locally without refetch
            onUploadComplete({
                id: docRef.id,
                ...docData,
                createdAt: { toDate: () => new Date() }
            });

            onClose();
        } catch (error) {
            console.error("Error uploading:", error);
            alert("Error al subir la imagen.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-theme-bg-secondary w-full max-w-2xl rounded-xl border border-theme-bg-tertiary overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-theme-bg-tertiary flex items-center justify-between bg-theme-bg-primary">
                    <h2 className="text-lg font-bold">Subir a Galería Pública</h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-theme-text-secondary" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Main Image Upload */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-theme-text-secondary">Imagen Principal (Resultado) *</label>
                            <div
                                onClick={() => mainInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${mainImage ? 'border-theme-accent-primary bg-theme-accent-primary/5' : 'border-theme-bg-tertiary hover:bg-theme-bg-tertiary'}`}
                            >
                                {mainImage ? (
                                    <div className="relative">
                                        <img src={URL.createObjectURL(mainImage)} alt="Preview" className="h-40 object-contain rounded" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold opacity-0 hover:opacity-100 transition-opacity rounded">Cambiar</div>
                                    </div>
                                ) : (
                                    <>
                                        <UploadIcon className="w-10 h-10 text-theme-text-tertiary mb-2" />
                                        <span className="text-sm text-theme-text-secondary">Click para seleccionar imagen</span>
                                    </>
                                )}
                                <input type="file" ref={mainInputRef} onChange={(e) => handleFileChange(e, setMainImage)} className="hidden" accept="image/*" />
                            </div>
                        </div>

                        {/* Title & Description */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-bold text-theme-text-secondary block mb-1">Título</label>
                                <input
                                    type="text"
                                    ref={titleRef}
                                    className="w-full bg-theme-bg-primary border border-theme-bg-tertiary rounded p-2 text-theme-text-primary focus:outline-none focus:border-theme-accent-primary"
                                    placeholder="Mi Obra Maestra"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-theme-text-secondary block mb-1">Descripción / Prompt / Historia</label>
                                <textarea
                                    ref={descRef}
                                    className="w-full bg-theme-bg-primary border border-theme-bg-tertiary rounded p-2 text-theme-text-primary focus:outline-none focus:border-theme-accent-primary h-24 resize-none"
                                    placeholder="Describe el proceso, el prompt utilizado, o la historia detrás de la imagen..."
                                />
                            </div>
                        </div>

                        {/* Optional Reference Images */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-theme-bg-tertiary">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-theme-text-secondary flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Imagen Input (Boceto)</label>
                                <div
                                    onClick={() => inputInputRef.current?.click()}
                                    className="h-24 border border-dashed border-theme-bg-tertiary rounded flex items-center justify-center cursor-pointer hover:bg-theme-bg-tertiary overflow-hidden"
                                >
                                    {inputImage ? (
                                        <img src={URL.createObjectURL(inputImage)} className="h-full w-full object-cover" />
                                    ) : <PlusIcon className="w-6 h-6 text-theme-text-tertiary" />}
                                    <input type="file" ref={inputInputRef} onChange={(e) => handleFileChange(e, setInputImage)} className="hidden" accept="image/*" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-theme-text-secondary flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Imagen de Referencia</label>
                                <div
                                    onClick={() => refInputRef.current?.click()}
                                    className="h-24 border border-dashed border-theme-bg-tertiary rounded flex items-center justify-center cursor-pointer hover:bg-theme-bg-tertiary overflow-hidden"
                                >
                                    {refImage ? (
                                        <img src={URL.createObjectURL(refImage)} className="h-full w-full object-cover" />
                                    ) : <PlusIcon className="w-6 h-6 text-theme-text-tertiary" />}
                                    <input type="file" ref={refInputRef} onChange={(e) => handleFileChange(e, setRefImage)} className="hidden" accept="image/*" />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-theme-bg-tertiary bg-theme-bg-primary flex justify-end gap-2">
                    <button onClick={onClose} disabled={isUploading} className="px-4 py-2 hover:bg-theme-bg-tertiary rounded text-theme-text-secondary transition-colors">Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isUploading || !mainImage}
                        className="px-6 py-2 bg-theme-accent-primary hover:bg-theme-accent-secondary text-white rounded font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isUploading ? 'Subiendo...' : 'Publicar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
