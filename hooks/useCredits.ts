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
                console.log("useCredits: Fetched user data:", data); // DEBUG LOG

                if (typeof data.credits === 'number') {
                    setCredits(data.credits);
                } else {
                    await updateDoc(userDocRef, { credits: DEFAULT_CREDITS });
                }

                // Role handling
                if (data.role && (data.role === 'admin' || data.role === 'regular')) {
                    console.log("useCredits: Setting role to:", data.role); // DEBUG LOG
                    setRole(data.role);
                } else {
                    console.warn("useCredits: Role missing or invalid, defaulting to regular. Found:", data.role); // DEBUG LOG
                    setRole('regular');
                }

            } else {
                console.log("useCredits: User document does not exist, creating new one."); // DEBUG LOG
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
