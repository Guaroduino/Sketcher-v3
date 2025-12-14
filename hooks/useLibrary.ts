import { useState, useCallback, useEffect } from 'react';
import type { LibraryItem, RgbColor, LibraryFolder, LibraryImage, ScaleUnit } from '../types';
import { User } from 'firebase/auth';
import { db, storage } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';


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
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting data URL to blob", e);
        return null;
    }
}

export function useLibrary(user: User | null) {
    const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
    const [imageToEdit, setImageToEdit] = useState<(LibraryImage & { originalDataUrl: string }) | null>(null);
    const [deletingLibraryItem, setDeletingLibraryItem] = useState<LibraryItem | null>(null);

    useEffect(() => {
        if (user) {
            const q = query(collection(db, `users/${user.uid}/libraryItems`), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                const itemPromises = querySnapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    if (data.type === 'folder') {
                        return {
                            id: doc.id,
                            name: data.name,
                            type: 'folder' as const,
                            parentId: data.parentId || null,
                        };
                    }

                    // It's an image
                    if (!data.storagePath) return null;
                    const downloadURL = await getDownloadURL(ref(storage, data.storagePath));
                    return {
                        id: doc.id,
                        name: data.name,
                        type: 'image' as const,
                        storagePath: data.storagePath,
                        transparentColors: data.transparentColors || [],
                        scaleFactor: data.scaleFactor || 5,
                        tolerance: data.tolerance,
                        dataUrl: downloadURL,
                        parentId: data.parentId || null,
                        scaleUnit: data.scaleUnit || 'mm',
                    };
                });
                const items = (await Promise.all(itemPromises)).filter(Boolean) as LibraryItem[];
                setLibraryItems(items);
            }, (error) => {
                console.error("Error fetching library items:", error);
            });
            return () => unsubscribe();
        } else {
            setLibraryItems([]);
        }
    }, [user]);

    const handleImportToLibrary = useCallback(async (file: File, parentId: string | null, options?: { scaleFactor?: number }) => {
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
                type: 'image',
                parentId,
                scaleFactor: options?.scaleFactor || 5, // Default to 5 if not provided
            });
        } catch (error) {
            console.error("Error uploading file to library:", error);
            alert("Failed to upload image.");
        }
    }, [user]);

    const handleCreateFolder = useCallback(async (name: string, parentId: string | null) => {
        if (!user) {
            alert("Please log in to create folders.");
            return;
        }
        try {
            await addDoc(collection(db, `users/${user.uid}/libraryItems`), {
                name,
                parentId,
                type: 'folder',
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error creating folder:", error);
        }
    }, [user]);

    const handleMoveItems = useCallback(async (itemIds: string[], targetParentId: string | null) => {
        if (!user) {
            alert("Please log in to manage library items.");
            return;
        }

        const collectionRef = collection(db, `users/${user.uid}/libraryItems`);

        const movePromises = itemIds.map(itemId => {
            // Prevent moving a folder into itself or its own children
            const isDescendant = (potentialParentId: string, potentialChildId: string): boolean => {
                const child = libraryItems.find(item => item.id === potentialChildId);
                if (!child || !child.parentId) return false;
                if (child.parentId === potentialParentId) return true;
                return isDescendant(potentialParentId, child.parentId);
            };

            const itemToMove = libraryItems.find(i => i.id === itemId);
            if (itemToMove?.type === 'folder') {
                if (itemId === targetParentId || (targetParentId && isDescendant(itemId, targetParentId))) {
                    console.warn(`Cannot move folder "${itemToMove.name}" into itself or a child folder.`);
                    return Promise.resolve(); // Skip this move
                }
            }

            const docRef = doc(collectionRef, itemId);
            return updateDoc(docRef, {
                parentId: targetParentId,
            });
        });

        try {
            await Promise.all(movePromises);
        } catch (error) {
            console.error("Error moving items:", error);
            alert("Failed to move items.");
        }
    }, [user, libraryItems]);

    const prepareItemForEditing = useCallback(async (id: string) => {
        const item = libraryItems.find(i => i.id === id);
        if (!item || item.type !== 'image' || !item.dataUrl) return;

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

    const handleApplyTransparency = useCallback(async (newImageDataUrl: string, colors: RgbColor[], newScaleFactor: number, tolerance: number, newScaleUnit: ScaleUnit) => {
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
            await updateDoc(docRef, { transparentColors: colors, scaleFactor: newScaleFactor, tolerance: tolerance, scaleUnit: newScaleUnit });

            setLibraryItems(prev => prev.map(item =>
                (item.id === imageToEdit.id && item.type === 'image') ? { ...item, dataUrl: newDownloadURL, transparentColors: colors, scaleFactor: newScaleFactor, tolerance: tolerance, scaleUnit: newScaleUnit } : item
            ));
            setImageToEdit(null);
        } catch (error) {
            console.error("Error applying transparency:", error);
            alert("Failed to save changes.");
        }
    }, [user, imageToEdit]);

    const handleDeleteLibraryItem = (item: LibraryItem) => setDeletingLibraryItem(item);

    const handleConfirmDeleteLibraryItem = useCallback(async () => {
        if (!deletingLibraryItem || !user) return;

        const collectionRef = collection(db, `users/${user.uid}/libraryItems`);

        const recursiveDelete = async (itemId: string) => {
            // Find the item to determine if it's a folder or image
            const itemToDelete = libraryItems.find(i => i.id === itemId);
            if (!itemToDelete) return; // Already deleted or not found

            if (itemToDelete.type === 'image') {
                // Delete storage file
                await deleteObject(ref(storage, itemToDelete.storagePath));
            } else if (itemToDelete.type === 'folder') {
                // Find and delete children
                const childrenQuery = query(collectionRef, where("parentId", "==", itemId));
                const childrenSnapshot = await getDocs(childrenQuery);
                const deleteChildrenPromises = childrenSnapshot.docs.map(childDoc => recursiveDelete(childDoc.id));
                await Promise.all(deleteChildrenPromises);
            }
            // Delete Firestore document
            await deleteDoc(doc(collectionRef, itemId));
        };

        try {
            await recursiveDelete(deletingLibraryItem.id);
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item.");
        } finally {
            setDeletingLibraryItem(null);
        }
    }, [deletingLibraryItem, user, libraryItems]);

    const handleCancelDeleteLibraryItem = () => setDeletingLibraryItem(null);

    return {
        libraryItems,
        imageToEdit,
        deletingLibraryItem,
        onImportToLibrary: handleImportToLibrary,
        onCreateFolder: handleCreateFolder,
        onEditTransparency: prepareItemForEditing,
        onApplyTransparency: handleApplyTransparency,
        onDeleteLibraryItem: handleDeleteLibraryItem,
        onConfirmDeleteLibraryItem: handleConfirmDeleteLibraryItem,
        onCancelDeleteLibraryItem: handleCancelDeleteLibraryItem,
        onCancelEditTransparency: () => setImageToEdit(null),
        onMoveItems: handleMoveItems,
    };
}