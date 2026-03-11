
import { db } from "../firebase";
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    Timestamp,
    arrayUnion
} from "firebase/firestore";

export interface DailyLog {
    day: number;
    completed: boolean;
    checkFasting: boolean;
    checkFood: boolean;
    checkExercise: boolean;
    timestamp: Timestamp;
}

export interface ProtocolState {
    currentDay: number;
    daysCompleted: number;
    isFinished: boolean;
    logs: Record<number, DailyLog>;
    startDate: Timestamp;
    initialWeight?: string;
    initialWaist?: string;
    initialHip?: string;
    email?: string; // Captured on Day 7
}

const COLLECTION_NAME = "protocols";

/**
 * Initialize the 7-Day Protocol for a user if it doesn't exist.
 */
export async function initializeProtocol(userId: string): Promise<ProtocolState | null> {
    if (!userId) return null;

    const userProtocolRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(userProtocolRef);

    if (snap.exists()) {
        return snap.data() as ProtocolState;
    }

    // New Protocol State
    const initialState: ProtocolState = {
        currentDay: 1,
        daysCompleted: 0,
        isFinished: false,
        logs: {},
        startDate: Timestamp.now()
    };

    await setDoc(userProtocolRef, initialState);
    return initialState;
}

/**
 * Get the current protocol state for a user.
 */
export async function getProtocolState(userId: string): Promise<ProtocolState | null> {
    if (!userId) return null;

    const userProtocolRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(userProtocolRef);

    if (snap.exists()) {
        return snap.data() as ProtocolState;
    }

    // If not found, imply initialization needed or return null
    return null;
}

/**
 * Save onboarding data (weight, waist, hip) to the protocol state.
 */
export async function saveOnboardingData(userId: string, weight: string, waist: string, hip: string) {
    if (!userId) throw new Error("User ID required");

    const userProtocolRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(userProtocolRef);

    if (!snap.exists()) throw new Error("Protocol not initialized");

    const currentState = snap.data() as ProtocolState;
    const updates = {
        initialWeight: weight,
        initialWaist: waist,
        initialHip: hip
    };

    await updateDoc(userProtocolRef, updates);
    return { ...currentState, ...updates };
}

/**
 * Save lead email to the protocol state upon Day 7 completion.
 */
export async function saveLeadEmail(userId: string, email: string) {
    if (!userId) return;
    const userProtocolRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userProtocolRef, { email });
}

/**
 * Mark a day as complete and unlock the next day.
 */
export async function completeDay(userId: string, day: number, checkFasting: boolean, checkFood: boolean, checkExercise: boolean) {
    if (!userId) throw new Error("User ID required");

    const userProtocolRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(userProtocolRef);

    if (!snap.exists()) throw new Error("Protocol not initialized");

    const currentState = snap.data() as ProtocolState;

    // Validation: Can only complete current day (or previous days for correction)
    if (day > currentState.currentDay) {
        throw new Error("Cannot complete a future day.");
    }

    const newLog: DailyLog = {
        day,
        completed: true,
        checkFasting,
        checkFood,
        checkExercise,
        timestamp: Timestamp.now()
    };

    const updates: any = {
        [`logs.${day}`]: newLog,
    };

    // Logic: If completing the current active day, advance the day
    if (day === currentState.currentDay) {
        if (day < 7) {
            updates.currentDay = day + 1;
        } else {
            updates.isFinished = true;
        }
        updates.daysCompleted = currentState.daysCompleted + 1;
    }

    await updateDoc(userProtocolRef, updates);
    return { ...currentState, ...updates };
}
