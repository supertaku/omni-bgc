/** PHP decimal amounts: at most 12 whole digits, no signs, separators or rounding.
 * Callers enforce currency/evidence and retain their own null/error policy.
 */
export function parsePhpCentavos(value: string): bigint | null {
  if (typeof value !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
