const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const DPI_RE = /^\d{13}$/;

const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v);
const isStrongPassword = (v) => typeof v === 'string' && PASSWORD_RE.test(v);
const isDpi = (v) => typeof v === 'string' && DPI_RE.test(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isInteger = (v) => Number.isInteger(v);
const isNonEmptyString = (v, min = 1, max = Infinity) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

module.exports = { isEmail, isStrongPassword, isDpi, isNumber, isInteger, isNonEmptyString };
