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
  // Validate input date
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn('Invalid date provided to convertToISTISOString, using current date');
    date = new Date();
  }
  
  // Use toLocaleString to get IST time, then create new Date
  const istString = date.toLocaleString('en-CA', { 
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Convert "YYYY-MM-DD, HH:MM:SS" format to ISO format
  const [datePart, timePart] = istString.split(', ');
  const isoString = `${datePart}T${timePart}.000Z`;
  
  return isoString;
};

/**
 * Parse date from various formats and convert to IST ISO string
 * Handles dates from Google Sheets, user input, Date objects, etc.
 */
export const parseAndNormalizeToIST = (dateInput: any): string => {
  try {
    if (!dateInput) {
      return getCurrentISTDate();
    }

    let date: Date;

    if (dateInput instanceof Date) {
      // If it's already a Date object, validate and use it
      if (isNaN(dateInput.getTime())) {
        console.warn('Invalid Date object provided, using current date');
        return getCurrentISTDate();
      }
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        // ISO format - parse directly
        date = new Date(dateInput);
      } else if (dateInput.includes('/')) {
        // MM/DD/YYYY or DD/MM/YYYY format
        date = new Date(dateInput);
      } else if (dateInput.includes('-')) {
        // YYYY-MM-DD format - treat as local date
        const [year, month, day] = dateInput.split('-').map(Number);
        if (year && month && day && year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          date = new Date(year, month - 1, day); // Month is 0-indexed
        } else {
          throw new Error(`Invalid date components: ${year}-${month}-${day}`);
        }
      } else {
        date = new Date(dateInput);
      }
    } else {
      console.warn(`Invalid date input type: ${typeof dateInput}, using current date`);
      return getCurrentISTDate();
    }

    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date parsed from: ${dateInput}, using current date`);
      return getCurrentISTDate();
    }

    return convertToISTISOString(date);
  } catch (error) {
    console.error('Error parsing date:', error, 'Input:', dateInput);
    return getCurrentISTDate();
  }
};

/**
 * Format date for display in Indian format
 */
export const formatDateForDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string for display:', dateString);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-IN', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date for display:', error);
    return 'Invalid Date';
  }
};

/**
 * Format date for Google Sheets (YYYY-MM-DD format in IST)
 * This version is robust and avoids parsing locale-specific strings.
 */
export const formatDateForSheets = (dateString: string): string => {
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      console.error('Invalid date string provided to formatDateForSheets:', dateString);
      // As a fallback, return today's date in IST
      const now = new Date();
      const year = now.toLocaleDateString('en-US', { year: 'numeric', timeZone: IST_TIMEZONE });
      const month = now.toLocaleDateString('en-US', { month: '2-digit', timeZone: IST_TIMEZONE });
      const day = now.toLocaleDateString('en-US', { day: '2-digit', timeZone: IST_TIMEZONE });
      return `${year}-${month}-${day}`;
    }

    // Use toLocaleString to get the individual date parts in the correct timezone
    // 'en-CA' locale is used as it reliably produces YYYY-MM-DD format.
    const formattedDate = date.toLocaleDateString('en-CA', {
      timeZone: IST_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    // The result is already in 'YYYY-MM-DD' format
    return formattedDate;

  } catch (error) {
    console.error('Error in formatDateForSheets:', error, 'Input:', dateString);
    // Fallback to current date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Get date object in IST timezone
 */
export const getISTDate = (dateString?: string): Date => {
  try {
    const sourceDate = dateString ? new Date(dateString) : new Date();
    
    // Validate source date
    if (isNaN(sourceDate.getTime())) {
      console.warn('Invalid date string provided to getISTDate:', dateString);
      return new Date(); // Return current date as fallback
    }
    
    // Use toLocaleString to convert to IST and then create a new Date
    const istString = sourceDate.toLocaleString('sv-SE', { 
      timeZone: IST_TIMEZONE 
    });
    
    const istDate = new Date(istString);
    
    // Validate the result
    if (isNaN(istDate.getTime())) {
      console.warn('Failed to create IST date, using current date');
      return new Date();
    }
    
    return istDate;
  } catch (error) {
    console.error('Error in getISTDate:', error);
    return new Date(); // Return current date as fallback
  }
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