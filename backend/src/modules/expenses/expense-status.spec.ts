import { ExpenseStatus, Role } from '../../generated/prisma/enums';
import { ExpenseAction, findTransition, TRANSITIONS } from './expense-status';

describe('Status mashinasi (TZ 3.7)', () => {
  it('yakuniy statuslardan hech qanday o‘tish yo‘q', () => {
    const terminal = [
      ExpenseStatus.APPROVED,
      ExpenseStatus.REJECTED,
      ExpenseStatus.CANCELLED,
      ExpenseStatus.REFUNDED,
      ExpenseStatus.PARTIALLY_REFUNDED,
    ];

    for (const status of terminal) {
      expect(TRANSITIONS.filter((t) => t.from === status)).toHaveLength(0);
    }
  });

  it('2-bosqichni faqat bosh admin hal qiladi', () => {
    const stageTwo = TRANSITIONS.filter(
      (t) => t.from === ExpenseStatus.ADMIN_PENDING,
    );

    expect(stageTwo.length).toBeGreaterThan(0);
    for (const transition of stageTwo) {
      expect(transition.roles).toEqual([Role.ADMIN]);
    }
  });

  it('rad etish va tuzatish so‘rashda sabab majburiy', () => {
    for (const action of ['reject', 'request-fix'] as ExpenseAction[]) {
      const withAction = TRANSITIONS.filter((t) => t.action === action);
      expect(withAction.length).toBeGreaterThan(0);
      for (const transition of withAction) {
        expect(transition.reasonRequired).toBe(true);
      }
    }
  });

  it('bekor qilishni faqat kiritgan shaxs bajaradi', () => {
    const cancels = TRANSITIONS.filter((t) => t.action === 'cancel');

    expect(cancels.length).toBeGreaterThan(0);
    for (const transition of cancels) {
      expect(transition.creatorOnly).toBe(true);
      expect(transition.to).toBe(ExpenseStatus.CANCELLED);
    }
  });

  it('tuzatishdan keyingi qayta yuborish 1-bosqichga qaytaradi', () => {
    const resubmit = findTransition(ExpenseStatus.NEEDS_FIX, 'submit');
    expect(resubmit?.to).toBe(ExpenseStatus.DIRECTOR_PENDING);
  });

  it('bir (from, action) juftligi uchun bittadan ortiq o‘tish yo‘q', () => {
    const keys = TRANSITIONS.map((t) => `${t.from}:${t.action}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mavjud bo‘lmagan o‘tish undefined qaytaradi', () => {
    expect(findTransition(ExpenseStatus.APPROVED, 'approve')).toBeUndefined();
    expect(
      findTransition(ExpenseStatus.ADMIN_PENDING, 'cancel'),
    ).toBeUndefined();
  });
});
