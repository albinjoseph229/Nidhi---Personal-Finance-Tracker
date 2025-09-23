// utils/dateUtils.ts
/**
 * Date utilities for consistent IST handling across the app
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_HOURS = 5.5;

/**
 * Get current date in IST as ISO string
 */
export const getCurrentISTDate = (): string => {
  const now = new Date();
  return convertToISTISOString(now);
};

/**
 * Convert any date to IST and return as ISO string
 * This ensures consistent storage format
 */
export const convertToISTISOString = (date: Date): string => {
  // Create a new date object to avoid mutating the original
  const istDate = new Date(date);
  
  // Get the IST time by adjusting for timezone offset
  const utcTime = istDate.getTime() + (istDate.getTimezoneOffset() * 60000);
  const istTime = new Date(utcTime + (IST_OFFSET_HOURS * 3600000));
  
  // Return as ISO string but ensure it represents IST time
  return istTime.toISOString();
};

/**
 * Parse date from various formats and convert to IST ISO string
 * Handles dates from Google Sheets, user input, etc.
 */
export const parseAndNormalizeToIST = (dateInput: any): string => {
  if (!dateInput) {
    return getCurrentISTDate();
  }

  let date: Date;

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      // ISO format - parse directly
      date = new Date(dateInput);
    } else if (dateInput.includes('/')) {
      // MM/DD/YYYY or DD/MM/YYYY format
      date = new Date(dateInput);
    } else if (dateInput.includes('-')) {
      // YYYY-MM-DD format - treat as local date
      const [year, month, day] = dateInput.split('-').map(Number);
      date = new Date(year, month - 1, day); // Month is 0-indexed
    } else {
      date = new Date(dateInput);
    }
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    console.warn(`Invalid date input: ${dateInput}, using current date`);
    return getCurrentISTDate();
  }

  // Validate the date
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date parsed: ${dateInput}, using current date`);
    return getCurrentISTDate();
  }

  return convertToISTISOString(date);
};

/**
 * Format date for display in Indian format
 */
export const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format date for Google Sheets (YYYY-MM-DD format in IST)
 */
export const formatDateForSheets = (dateString: string): string => {
  const date = new Date(dateString);
  
  // Convert to IST
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
  
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get date object in IST timezone
 */
export const getISTDate = (dateString?: string): Date => {
  const date = dateString ? new Date(dateString) : new Date();
  return new Date(date.toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
};

/**
 * Check if two dates are the same day in IST
 */
export const isSameDayIST = (date1: string | Date, date2: string | Date): boolean => {
  const d1 = getISTDate(typeof date1 === 'string' ? date1 : date1.toISOString());
  const d2 = getISTDate(typeof date2 === 'string' ? date2 : date2.toISOString());
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};