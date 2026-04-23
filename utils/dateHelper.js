/**
 * Convert Firestore Timestamp to ISO string for API responses
 * Handles multiple date formats: Firestore Timestamp, Date object, _seconds object
 */
const formatDate = (date) => {
    if (!date) return null;
    
    // Firestore Timestamp object with toDate() method
    if (date.toDate && typeof date.toDate === 'function') {
        return date.toDate().toISOString();
    }
    
    // JavaScript Date object
    if (date instanceof Date) {
        return date.toISOString();
    }
    
    // Firestore Timestamp serialized as {_seconds, _nanoseconds}
    if (date._seconds) {
        return new Date(date._seconds * 1000).toISOString();
    }
    
    return date;
};

/**
 * Format an object's date fields recursively
 */
const formatObjectDates = (obj, dateFields = ['createdAt', 'updatedAt']) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const formatted = { ...obj };
    
    dateFields.forEach(field => {
        if (formatted[field]) {
            formatted[field] = formatDate(formatted[field]);
        }
    });
    
    return formatted;
};

/**
 * Format an array of objects' date fields
 */
const formatArrayDates = (array, dateFields = ['createdAt', 'updatedAt']) => {
    if (!Array.isArray(array)) return array;
    return array.map(item => formatObjectDates(item, dateFields));
};

module.exports = {
    formatDate,
    formatObjectDates,
    formatArrayDates
};
