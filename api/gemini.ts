// In api/gemini.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return response.status(500).json({ error: 'Gemini API key not configured on server.' });
  }
  
  const { prompt } = request.body;

  if (!prompt) {
    return response.status(400).json({ error: 'Prompt is required in request body.' });
  }

  try {
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
        }
      },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    return response.status(200).json(geminiResponse.data);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle axios/network errors
      console.error("Error in /api/gemini (Axios):", error.response?.data || error.message);
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return response.status(408).json({ error: 'Request timeout - Gemini API took too long to respond.' });
      }
      
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const errorMessage = error.response.data?.error?.message || 'Gemini API error';
        
        if (status === 400) {
          return response.status(400).json({ error: 'Invalid request to Gemini API.' });
        } else if (status === 403) {
          return response.status(403).json({ error: 'Gemini API access denied. Check API key.' });
        } else if (status === 429) {
          return response.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        } else if (status >= 500) {
          return response.status(500).json({ error: 'Gemini API server error. Please try again later.' });
        }
        
        return response.status(500).json({ error: `Gemini API error: ${errorMessage}` });
      } else if (error.request) {
        // Network error
        return response.status(503).json({ error: 'Network error - unable to reach Gemini API.' });
      }
    } else if (error instanceof Error) {
      // For any other standard JavaScript error
      console.error("Error in /api/gemini (Generic):", error.message);
      return response.status(500).json({ error: 'Internal server error while processing Gemini request.' });
    } else {
      // For anything else that might be thrown
      console.error("Unknown error in /api/gemini:", error);
      return response.status(500).json({ error: 'Unknown error occurred.' });
    }

    return response.status(500).json({ error: 'An error occurred with the Gemini API.' });
  }
}