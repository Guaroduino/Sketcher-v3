import { useState, useCallback, useEffect } from 'react';
import type { LibraryItem, RgbColor } from '../types';
import { User } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { db, storage } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';


const dataURLtoBlob = (dataurl: string): Blob | null => {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    } catch(e) {
        console.error("Error converting data URL to blob", e);
        return null;
    }
}

export function useLibrary(user: User | null) {
    const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
    const [imageToEdit, setImageToEdit] = useState<(LibraryItem & { originalDataUrl: string }) | null>(null);
    const [deletingLibraryItemId, setDeletingLibraryItemId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            const q = query(collection(db, `users/${user.uid}/libraryItems`), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                const itemPromises = querySnapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const downloadURL = await getDownloadURL(ref(storage, data.storagePath));
                    return {
                        id: doc.id,
                        name: data.name,
                        type: 'image' as const,
                        storagePath: data.storagePath,
                        transparentColors: data.transparentColors || [],
                        dataUrl: downloadURL,
                    };
                });
                const items = await Promise.all(itemPromises);
                setLibraryItems(items);
            }, (error) => {
                console.error("Error fetching library items:", error);
            });
            return () => unsubscribe();
        } else {
            setLibraryItems([]);
        }
    }, [user]);

    const handleImportToLibrary = useCallback(async (file: File) => {
        if (!user) {
            alert("Please log in to save items to your library.");
            return;
        }
        const storagePath = `users/${user.uid}/library/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);

        try {
            await uploadBytes(storageRef, file);
            await addDoc(collection(db, `users/${user.uid}/libraryItems`), {
                name: file.name.split('.').slice(0, -1).join('.') || 'Image',
                storagePath: storagePath,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error uploading file to library:", error);
            alert("Failed to upload image.");
        }
    }, [user]);
    
    const prepareItemForEditing = useCallback(async (id: string) => {
        const item = libraryItems.find(i => i.id === id);
        if (!item || !item.dataUrl) return;

        try {
            const response = await fetch(item.dataUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                setImageToEdit({ ...item, originalDataUrl: base64data });
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error("Error preparing image for editing:", error);
            alert("Could not load image for editing.");
        }
    }, [libraryItems]);

    const handleApplyTransparency = useCallback(async (newImageDataUrl: string, colors: RgbColor[]) => {
        if (!imageToEdit || !user) return;

        const blob = dataURLtoBlob(newImageDataUrl);
        if (!blob) {
            alert("Error processing image data.");
            return;
        }
        
        const storageRef = ref(storage, imageToEdit.storagePath);
        const docRef = doc(db, `users/${user.uid}/libraryItems`, imageToEdit.id);
        
        try {
            await uploadBytes(storageRef, blob);
            const newDownloadURL = await getDownloadURL(storageRef);
            await updateDoc(docRef, { transparentColors: colors });

            setLibraryItems(prev => prev.map(item =>
                item.id === imageToEdit.id ? { ...item, dataUrl: newDownloadURL, transparentColors: colors } : item
            ));
            setImageToEdit(null);
        } catch (error) {
            console.error("Error applying transparency:", error);
            alert("Failed to save changes.");
        }
    }, [user, imageToEdit]);

    const handleDeleteLibraryItem = (id: string) => setDeletingLibraryItemId(id);

    const handleConfirmDeleteLibraryItem = useCallback(async () => {
        if (!deletingLibraryItemId || !user) return;
        
        const itemToDelete = libraryItems.find(i => i.id === deletingLibraryItemId);
        if (!itemToDelete) return;

        const storageRef = ref(storage, itemToDelete.storagePath);
        const docRef = doc(db, `users/${user.uid}/libraryItems`, deletingLibraryItemId);
        
        try {
            await deleteObject(storageRef);
            await deleteDoc(docRef);
            setDeletingLibraryItemId(null);
        } catch(error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item.");
            setDeletingLibraryItemId(null);
        }
    }, [deletingLibraryItemId, user, libraryItems]);

    const handleCancelDeleteLibraryItem = () => setDeletingLibraryItemId(null);
    
    return {
        libraryItems,
        imageToEdit,
        deletingLibraryItemId,
        onImportToLibrary: handleImportToLibrary,
        onEditTransparency: prepareItemForEditing,
        onApplyTransparency: handleApplyTransparency,
        onDeleteLibraryItem: handleDeleteLibraryItem,
        onConfirmDeleteLibraryItem: handleConfirmDeleteLibraryItem,
        onCancelDeleteLibraryItem: handleCancelDeleteLibraryItem,
        onCancelEditTransparency: () => setImageToEdit(null),
    };
}
