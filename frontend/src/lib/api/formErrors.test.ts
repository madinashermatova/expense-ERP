import { describe, it, expect, vi } from 'vitest';
import { handleFormErrors } from './formErrors';

describe('formErrors', () => {
  it('maps details array to RHF setError', () => {
    const setError = vi.fn();
    const error = {
      response: {
        data: {
          details: {
            'shares.0.amount': ['Xato summa'],
            'branchId': ['Majburiy maydon']
          }
        }
      }
    };

    handleFormErrors(error, setError);

    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenCalledWith('shares.0.amount', { message: 'Xato summa' });
    expect(setError).toHaveBeenCalledWith('branchId', { message: 'Majburiy maydon' });
  });

  it('does nothing if details missing', () => {
    const setError = vi.fn();
    handleFormErrors({ response: { data: {} } }, setError);
    expect(setError).not.toHaveBeenCalled();
  });
});
