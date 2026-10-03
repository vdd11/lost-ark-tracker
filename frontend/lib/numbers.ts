/** Keep only the digits someone typed ("12,500g" -> "12500"). */
export function digitsOnly(text: string) {
  return text.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

/** Group digits with commas for display ("1234567" -> "1,234,567"). */
export function withCommas(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
