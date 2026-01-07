import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from 'firebase/auth';

const DEFAULT_CREDITS = 2;

export function useCredits(user: User | null) {
    const [credits, setCredits] = useState<number | null>(null);
    const [role, setRole] = useState<'admin' | 'regular'>('regular');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!user) {
            setCredits(null);
            setRole('regular');
            setLoading(false);
            return;
        }

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);

        const unsubscribe = onSnapshot(userDocRef, async (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                // console.log("useCredits: Fetched user data:", data); 

                const val = data.credits;
                if (typeof val === 'number') {
                    setCredits(val);
                } else if (val === undefined || val === null) {
                    // Initialize if missing
                    console.log("useCredits: Credits field missing, initializing to default.");
                    await updateDoc(userDocRef, { credits: DEFAULT_CREDITS });
                } else {
                    // Try to recover if it's a string
                    const num = Number(val);
                    if (!isNaN(num)) {
                        setCredits(num);
                    } else {
                        console.warn("useCredits: Invalid credits format, resetting.");
                        await updateDoc(userDocRef, { credits: DEFAULT_CREDITS });
                    }
                }

                // Role handling
                if (data.role && (data.role === 'admin' || data.role === 'regular')) {
                    setRole(data.role);
                } else {
                    setRole('regular');
                }

            } else {
                console.log("useCredits: First time user? Creating profile.");
                // Use setDoc with merge to be safe, though !exists implies it's new
                await setDoc(userDocRef, {
                    email: user.email,
                    createdAt: new Date(),
                    credits: DEFAULT_CREDITS,
                    role: 'regular'
                }, { merge: true });
                setRole('regular');
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching credits:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const deductCredit = async (amount: number = 1): Promise<boolean> => {
        if (!user || credits === null) return false;

        if (credits < amount) {
            return false;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                credits: increment(-amount)
            });
            return true;
        } catch (error) {
            console.error("Error deducting credit:", error);
            return false;
        }
    };

    const addCredits = async (amount: number): Promise<boolean> => {
        if (!user) return false;
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                credits: increment(amount)
            });
            return true;
        } catch (error) {
            console.error("Error adding credits:", error);
            return false;
        }
    };

    return { credits, role, loading, deductCredit, addCredits };
}
