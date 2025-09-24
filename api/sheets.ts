// In api/sheets.ts
import axios from 'axios';
// --- NEW: Import Vercel's official types ---
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- MODIFIED: Added the types to the function parameters ---
export default async function handler(request: VercelRequest, response: VercelResponse) {
  // Get the secret keys securely from the server's environment
  const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  const API_URL = process.env.GOOGLE_SHEETS_API_URL;

  if (!API_KEY || !API_URL) {
    return response.status(500).json({ error: 'API keys not configured on server.' });
  }

  try {
    let result;
    // For GET requests from your app (like fetching all data)
    if (request.method === 'GET') {
      const actionQuery = request.query.action;
      const res = await axios.get(`${API_URL}?apiKey=${API_KEY}&action=${actionQuery}`);
      result = res.data;
    } 
    // For POST requests (like adding or updating data)
    else if (request.method === 'POST') {
      const { action, data } = request.body;
      const payload = { apiKey: API_KEY, action, data };
      const res = await axios.post(API_URL, payload);
      result = res.data;
    } else {
      return response.status(405).json({ message: 'Method not allowed' });
    }
    
    return response.status(200).json(result);

  } catch (error) {
    console.error("Error in /api/sheets:", error);
    return response.status(500).json({ error: 'An error occurred with the Sheets API.' });
  }
}