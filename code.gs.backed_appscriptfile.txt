// ---------------------------------------------------
// This script acts as the backend API for the Nidhi app.
// It handles storing, retrieving, updating, and deleting
// financial transactions and budgets in Google Sheets.
// ---------------------------------------------------

// --- CONFIGURATION ---
// Replace with your actual Google Sheet ID (from the URL)
const SHEET_ID = ""; // e.g., "1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
// Replace with a secret key (used for simple authentication)
const SECRET_API_key = ""; // e.g., "my-secret-123"

// --- SHEET NAMES ---
const TRANSACTIONS_SHEET = "Transactions";
const BUDGETS_SHEET = "Budgets";

// --- Main POST function (handles writing data) ---
function doPost(e) {
  const requestData = JSON.parse(e.postData.contents);

  if (requestData.apiKey !== SECRET_API_key) {
    return createJsonResponse({ "status": "error", "message": "Unauthorized" });
  }

  switch (requestData.action) {
    case "addTransaction":
      return addTransaction(requestData.data);
    case "setBudget":
      return setBudget(requestData.data);
    case "updateTransaction": // <-- ADD THIS
      return updateTransaction(requestData.data);
    case "deleteTransaction": // <-- ADD THIS
      return deleteTransaction(requestData.data);
    default:
      return createJsonResponse({ "status": "error", "message": "Invalid action" });
  }
}

// --- Main GET function (handles reading data) ---
function doGet(e) {
  if (e.parameter.apiKey !== SECRET_API_key) {
     return createJsonResponse({ "status": "error", "message": "Unauthorized" });
  }

  switch (e.parameter.action) {
    case "getTransactions":
      return getSheetData(TRANSACTIONS_SHEET);
    case "getBudgets":
      return getBudgetData(); // Use specialized function for budgets
    default:
      return createJsonResponse({ "status": "error", "message": "Invalid action" });
  }
}

// --- HELPER FUNCTIONS ---

function addTransaction(data) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TRANSACTIONS_SHEET);
    
    // Destructure and provide defaults
    const { 
      date, 
      category, 
      amount, 
      notes, 
      type, 
      uuid 
    } = data;
    
    // Validate that we have the required fields
    if (!date || !category || !amount || !type || !uuid) {
      console.error("Missing required fields:", data);
      return createJsonResponse({ 
        "status": "error", 
        "message": "Missing required fields: date, category, amount, type, uuid" 
      });
    }
    
    // Ensure type is either 'income' or 'expense'
    const validType = (type === 'income' || type === 'expense') ? type : 'expense';
    
    // Format date consistently
    const formattedDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Log what we're about to save (for debugging)
    console.log(`Saving transaction: UUID=${uuid}, Type=${validType}, Amount=${amount}, Category=${category}, Date=${formattedDate}`);
    
    // Append to sheet - MAKE SURE THE COLUMN ORDER MATCHES YOUR HEADER ROW
    // Assuming columns are: Date, Category, Amount, Notes, Type, UUID
    sheet.appendRow([
      formattedDate,
      category,
      parseFloat(amount),
      notes || "",
      validType,  // This is critical - make sure this matches your column
      uuid
    ]);
    
    return createJsonResponse({ 
      "status": "success", 
      "message": `Transaction added: ${validType} of ${amount}` 
    });
  } catch (error) {
    console.error("Error in addTransaction:", error);
    return createJsonResponse({ 
      "status": "error", 
      "message": error.message 
    });
  }
}

function setBudget(data) {
  try {
    const { MonthYear, BudgetAmount } = data;
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(BUDGETS_SHEET);
    const values = sheet.getDataRange().getValues();
    
    for (let i = 1; i < values.length; i++) {
      // Convert to string and trim for comparison
      if (values[i][0].toString().trim() === MonthYear.toString().trim()) {
        sheet.getRange(i + 1, 2).setValue(BudgetAmount);
        return createJsonResponse({ "status": "success", "message": "Budget updated" });
      }
    }
    
    // Make sure MonthYear is stored as text
    sheet.appendRow([`'${MonthYear}`, BudgetAmount]); // The ' prefix forces text format
    return createJsonResponse({ "status": "success", "message": "Budget set" });
  } catch (error) {
    return createJsonResponse({ "status": "error", "message": error.message });
  }
}

// Enhanced getSheetData with better column handling
function getSheetData(sheetName) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return createJsonResponse({ "status": "success", "data": [] });
    }
    
    const headers = data[0]; // First row is headers
    const rows = data.slice(1); // Rest are data rows
    
    console.log(`Headers found: ${headers.join(', ')}`); // Debug log
    
    const jsonArray = rows.map((row, index) => {
      let obj = {};
      headers.forEach((header, colIndex) => {
        if (header) {
          const cellValue = row[colIndex];
          
          // Handle different column names (case-insensitive)
          const headerLower = header.toString().toLowerCase();
          
          if (headerLower === 'type') {
            // Ensure type is properly set
            const typeValue = cellValue ? cellValue.toString().toLowerCase() : 'expense';
            obj['Type'] = (typeValue === 'income') ? 'income' : 'expense';
          } else if (headerLower === 'date') {
            obj['Date'] = cellValue;
          } else if (headerLower === 'category') {
            obj['Category'] = cellValue || 'Other';
          } else if (headerLower === 'amount') {
            obj['Amount'] = parseFloat(cellValue) || 0;
          } else if (headerLower === 'notes') {
            obj['Notes'] = cellValue || '';
          } else if (headerLower === 'uuid') {
            obj['uuid'] = cellValue;
          } else {
            // For any other columns, use the original header
            obj[header] = cellValue;
          }
        }
      });
      
      // Log each transaction for debugging
      console.log(`Row ${index + 2}: UUID=${obj.uuid}, Type=${obj.Type}, Amount=${obj.Amount}`);
      
      return obj;
    });

    console.log(`Returning ${jsonArray.length} transactions`);
    return createJsonResponse({ "status": "success", "data": jsonArray });
  } catch (error) {
    console.error("Error in getSheetData:", error);
    return createJsonResponse({ "status": "error", "message": error.message });
  }
}

// Specialized function to handle budget data properly
function getBudgetData() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(BUDGETS_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const jsonArray = data.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        if (header) {
          // Special handling for MonthYear to convert date back to YYYY-MM format
          if (header === 'MonthYear') {
            const cellValue = row[index];
            if (cellValue instanceof Date) {
              // Convert Date object back to YYYY-MM format
              const year = cellValue.getFullYear();
              const month = String(cellValue.getMonth() + 1).padStart(2, '0');
              obj[header] = `${year}-${month}`;
            } else {
              // If it's already a string, use it as is
              obj[header] = cellValue.toString().trim();
            }
          } else {
            obj[header] = row[index];
          }
        }
      });
      return obj;
    });

    console.log("Budget data being returned:", JSON.stringify(jsonArray)); // Debug log
    return createJsonResponse({ "status": "success", "data": jsonArray });
  } catch (error) {
    return createJsonResponse({ "status": "error", "message": error.message });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}



function updateTransaction(data) {
  try {
    const { uuid, date, category, amount, notes, type } = data;
    
    if (!uuid) {
      return createJsonResponse({ "status": "error", "message": "UUID is required for update" });
    }
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TRANSACTIONS_SHEET);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // Get headers to find column indices dynamically
    const headers = values[0];
    const uuidColumnIndex = headers.findIndex(header => header.toLowerCase() === 'uuid');
    const dateColumnIndex = headers.findIndex(header => header.toLowerCase() === 'date');
    const categoryColumnIndex = headers.findIndex(header => header.toLowerCase() === 'category');
    const amountColumnIndex = headers.findIndex(header => header.toLowerCase() === 'amount');
    const notesColumnIndex = headers.findIndex(header => header.toLowerCase() === 'notes');
    const typeColumnIndex = headers.findIndex(header => header.toLowerCase() === 'type');

    if (uuidColumnIndex === -1) {
      return createJsonResponse({ "status": "error", "message": "UUID column not found" });
    }

    console.log(`Looking for transaction with UUID: ${uuid}`);
    
    // Search for the transaction with the matching UUID
    for (let i = 1; i < values.length; i++) {
      const currentUuid = values[i][uuidColumnIndex];
      console.log(`Row ${i + 1}: UUID = '${currentUuid}', Looking for: '${uuid}'`);
      
      if (currentUuid && currentUuid.toString().trim() === uuid.toString().trim()) {
        console.log(`Found matching transaction at row ${i + 1}, updating...`);
        
        // Format date consistently
        const formattedDate = new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
        const validType = (type === 'income' || type === 'expense') ? type : 'expense';
        
        // Update each column individually to avoid array length issues
        if (dateColumnIndex !== -1) sheet.getRange(i + 1, dateColumnIndex + 1).setValue(formattedDate);
        if (categoryColumnIndex !== -1) sheet.getRange(i + 1, categoryColumnIndex + 1).setValue(category);
        if (amountColumnIndex !== -1) sheet.getRange(i + 1, amountColumnIndex + 1).setValue(parseFloat(amount));
        if (notesColumnIndex !== -1) sheet.getRange(i + 1, notesColumnIndex + 1).setValue(notes || '');
        if (typeColumnIndex !== -1) sheet.getRange(i + 1, typeColumnIndex + 1).setValue(validType);
        
        console.log(`Successfully updated transaction: ${uuid}`);
        return createJsonResponse({ 
          "status": "success", 
          "message": `Transaction updated: ${validType} of ${amount}` 
        });
      }
    }
    
    console.log(`Transaction with UUID ${uuid} not found`);
    return createJsonResponse({ "status": "error", "message": "Transaction not found" });
  } catch (error) {
    console.error("Error in updateTransaction:", error);
    return createJsonResponse({ "status": "error", "message": error.message });
  }
}


function deleteTransaction(data) {
  try {
    const { uuid } = data;
    if (!uuid) {
      return createJsonResponse({ "status": "error", "message": "UUID is required for deletion" });
    }
    
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TRANSACTIONS_SHEET);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Dynamically find the UUID column index
    const headers = values[0];
    const uuidColumnIndex = headers.findIndex(header => header.toLowerCase() === 'uuid');

    if (uuidColumnIndex === -1) {
      return createJsonResponse({ "status": "error", "message": "UUID column not found in sheet" });
    }

    // Loop backwards when deleting rows to avoid index shifting issues
    for (var i = values.length - 1; i >= 1; i--) {
      // Check the correct column index
      if (values[i][uuidColumnIndex] && values[i][uuidColumnIndex].toString().trim() == uuid.toString().trim()) {
        sheet.deleteRow(i + 1);
        return createJsonResponse({ "status": "success", "message": "Transaction deleted" });
      }
    }
    return createJsonResponse({ "status": "error", "message": "Transaction not found" });
  } catch (error) {
    console.error("Error in deleteTransaction:", error);
    return createJsonResponse({ "status": "error", "message": error.message });
  }
}