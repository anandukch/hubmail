/** Escapes a value for safe use inside a markdown table cell. */
export function mdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
