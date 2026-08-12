import { UseFormSetError, Path } from 'react-hook-form';

export const handleFormErrors = <T extends Record<string, any>>(
  error: any,
  setError: UseFormSetError<T>
) => {
  if (error?.response?.data?.details) {
    const details = error.response.data.details;
    for (const [key, messages] of Object.entries(details)) {
      if (Array.isArray(messages) && messages.length > 0) {
        // cast to Path<T> assuming the backend paths match the frontend ones
        setError(key as Path<T>, { message: messages[0] as string });
      }
    }
  }
};
