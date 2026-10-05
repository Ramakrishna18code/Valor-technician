/** OTP expiry timestamps are emitted from the backend's UTC business clock. */
export function otpExpiryTime(value: string): number {
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
}
