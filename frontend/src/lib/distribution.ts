/**
 * Distributes a total amount equally among a number of recipients.
 * Any remainder (in cents/tiyin) is given to the first recipient.
 * @param totalAmount The total amount to distribute (e.g., 100000)
 * @param count The number of recipients (e.g., 3)
 * @returns Array of amounts (e.g., [33333.34, 33333.33, 33333.33])
 */
export const distributeEqually = (totalAmount: number, count: number): number[] => {
  if (count <= 0) return [];
  
  // Convert to cents to avoid floating point precision issues
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents - (baseCents * count);
  
  const result = new Array(count).fill(0);
  
  for (let i = 0; i < count; i++) {
    let amountCents = baseCents;
    if (remainder > 0) {
      amountCents += 1;
      remainder -= 1;
    }
    result[i] = amountCents / 100;
  }
  
  return result;
};
