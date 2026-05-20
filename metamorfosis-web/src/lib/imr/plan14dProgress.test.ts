/**
 * Tests de la lógica de progresión del Plan 14d (SPEC-101).
 */
import { describe, expect, it } from 'vitest';
import {
    INITIAL_PROGRESS,
    getCurrentDay,
    isDayCompleted,
    isDayLocked,
    canCompleteDay,
    canUndoLastDay,
    isPlanFinished,
    markDayComplete,
    undoLastDay,
} from './plan14dProgress';

const NOW = '2026-05-19T10:00:00.000Z';

describe('Estado inicial', () => {
    it('getCurrentDay = 1 cuando completedDays está vacío', () => {
        expect(getCurrentDay(INITIAL_PROGRESS)).toBe(1);
    });

    it('día 1 no está completado ni locked', () => {
        expect(isDayCompleted(INITIAL_PROGRESS, 1)).toBe(false);
        expect(isDayLocked(INITIAL_PROGRESS, 1)).toBe(false);
    });

    it('días 2-14 están locked', () => {
        for (let d = 2; d <= 14; d++) {
            expect(isDayLocked(INITIAL_PROGRESS, d)).toBe(true);
        }
    });

    it('canCompleteDay solo true para día 1', () => {
        expect(canCompleteDay(INITIAL_PROGRESS, 1)).toBe(true);
        expect(canCompleteDay(INITIAL_PROGRESS, 2)).toBe(false);
        expect(canCompleteDay(INITIAL_PROGRESS, 14)).toBe(false);
    });

    it('canUndoLastDay false cuando no hay días completados', () => {
        expect(canUndoLastDay(INITIAL_PROGRESS)).toBe(false);
    });

    it('isPlanFinished false', () => {
        expect(isPlanFinished(INITIAL_PROGRESS)).toBe(false);
    });
});

describe('Marcar día 1 como completado', () => {
    const result = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);

    it('completedDays incluye día 1', () => {
        expect(result.completedDays).toEqual([1]);
    });

    it('completedAt tiene timestamp del día 1', () => {
        expect(result.completedAt['1']).toBe(NOW);
    });

    it('startedAt se setea en la primera marca', () => {
        expect(result.startedAt).toBe(NOW);
    });

    it('initialPillar se setea en la primera marca', () => {
        expect(result.initialPillar).toBe('M');
    });

    it('finishedAt sigue null (no es día 14)', () => {
        expect(result.finishedAt).toBeNull();
    });

    it('getCurrentDay ahora es 2', () => {
        expect(getCurrentDay(result)).toBe(2);
    });

    it('día 1 completado, día 2 disponible, día 3 locked', () => {
        expect(isDayCompleted(result, 1)).toBe(true);
        expect(isDayLocked(result, 1)).toBe(false);
        expect(isDayLocked(result, 2)).toBe(false);
        expect(isDayLocked(result, 3)).toBe(true);
    });
});

describe('Secuencial estricto', () => {
    it('no se puede saltar del día 1 al día 3', () => {
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        expect(canCompleteDay(after1, 3)).toBe(false);
        // Intentar marcar día 3 debe ser no-op
        const after3Attempt = markDayComplete(after1, 3, 'M', NOW);
        expect(after3Attempt).toBe(after1); // mismo objeto (referencial)
    });

    it('no se puede re-marcar un día ya completado', () => {
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        expect(canCompleteDay(after1, 1)).toBe(false);
    });
});

describe('Preserva initialPillar y startedAt en marcas subsiguientes', () => {
    it('día 2 marca conserva initialPillar y startedAt del día 1', () => {
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        const LATER = '2026-05-20T10:00:00.000Z';
        const after2 = markDayComplete(after1, 2, 'C', LATER);

        expect(after2.initialPillar).toBe('M'); // del día 1, no del 2
        expect(after2.startedAt).toBe(NOW); // del día 1, no del 2
        expect(after2.completedAt['2']).toBe(LATER); // nuevo timestamp
    });
});

describe('Completar día 14', () => {
    function progressUpTo(day: number) {
        let p = INITIAL_PROGRESS;
        for (let d = 1; d <= day; d++) {
            p = markDayComplete(p, d, 'M', NOW);
        }
        return p;
    }

    it('al marcar día 14, finishedAt se setea', () => {
        const after13 = progressUpTo(13);
        expect(after13.finishedAt).toBeNull();
        const after14 = markDayComplete(after13, 14, 'M', NOW);
        expect(after14.finishedAt).toBe(NOW);
    });

    it('isPlanFinished true tras completar día 14', () => {
        const after14 = progressUpTo(14);
        expect(isPlanFinished(after14)).toBe(true);
    });

    it('getCurrentDay = 15 (TOTAL_DAYS + 1) en estado finalizado', () => {
        const after14 = progressUpTo(14);
        expect(getCurrentDay(after14)).toBe(15);
    });
});

describe('Undo del último día', () => {
    it('undo de día 3 cuando completedDays=[1,2,3] retorna [1,2]', () => {
        let p = INITIAL_PROGRESS;
        p = markDayComplete(p, 1, 'M', NOW);
        p = markDayComplete(p, 2, 'M', NOW);
        p = markDayComplete(p, 3, 'M', NOW);

        const undone = undoLastDay(p);
        expect(undone.completedDays).toEqual([1, 2]);
        expect(undone.completedAt['3']).toBeUndefined();
        expect(undone.completedAt['2']).toBe(NOW); // se preserva
    });

    it('undo de día 1 (único) limpia startedAt e initialPillar', () => {
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        const undone = undoLastDay(after1);

        expect(undone.completedDays).toEqual([]);
        expect(undone.startedAt).toBeNull();
        expect(undone.initialPillar).toBeNull();
        expect(undone.completedAt).toEqual({});
    });

    it('undo de día 14 limpia finishedAt', () => {
        let p = INITIAL_PROGRESS;
        for (let d = 1; d <= 14; d++) p = markDayComplete(p, d, 'M', NOW);
        expect(p.finishedAt).toBe(NOW);

        const undone = undoLastDay(p);
        expect(undone.finishedAt).toBeNull();
        expect(undone.completedDays).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it('undo en estado inicial es no-op', () => {
        const undone = undoLastDay(INITIAL_PROGRESS);
        expect(undone).toBe(INITIAL_PROGRESS);
    });

    it('canUndoLastDay refleja el estado correctamente', () => {
        expect(canUndoLastDay(INITIAL_PROGRESS)).toBe(false);
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        expect(canUndoLastDay(after1)).toBe(true);
    });
});

describe('No mutación de input', () => {
    it('markDayComplete no muta el objeto original', () => {
        const original = { ...INITIAL_PROGRESS };
        markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        expect(INITIAL_PROGRESS).toEqual(original);
    });

    it('undoLastDay no muta el objeto original', () => {
        const after1 = markDayComplete(INITIAL_PROGRESS, 1, 'M', NOW);
        const snapshot = JSON.parse(JSON.stringify(after1));
        undoLastDay(after1);
        expect(after1).toEqual(snapshot);
    });
});
