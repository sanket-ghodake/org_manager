/**
 * Safely parses timestamps returned from PostgreSQL database queries.
 * 
 * PostgreSQL TIMESTAMP columns (without timezone) are queried and returned
 * either as Date objects (if the driver parsed them locally) or as strings.
 * Because JS parses timezone-less strings using the local system timezone, 
 * this function enforces UTC parsing by appending a 'Z' suffix if the input 
 * is a timezone-less string representation.
 */
export function parseDbTimestamp(val: any): Date {
  if (val instanceof Date) {
    return val;
  }
  if (typeof val === 'string') {
    // If it doesn't contain a timezone suffix/offset at the end, force parse it as UTC
    if (!val.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(val)) {
      // Replace whitespace separator with 'T' and suffix 'Z'
      return new Date(val.replace(' ', 'T') + 'Z');
    }
    return new Date(val);
  }
  return new Date(val);
}
