import { otpExpiryTime } from '../src/utils/otpTime';

describe('UTC OTP expiry', () => {
  it('treats a timezone-less backend expiry as UTC, including fractional seconds', () => {
    expect(otpExpiryTime('2026-10-05T11:43:03.545128')).toBe(Date.UTC(2026, 9, 5, 11, 43, 3, 545));
  });
  it('preserves explicit timezone offsets', () => {
    expect(otpExpiryTime('2026-10-05T17:13:03+05:30')).toBe(otpExpiryTime('2026-10-05T11:43:03Z'));
  });
  it('does not treat an invalid timestamp as an unexpired code', () => {
    expect(Number.isNaN(otpExpiryTime('invalid'))).toBe(true);
  });
});
