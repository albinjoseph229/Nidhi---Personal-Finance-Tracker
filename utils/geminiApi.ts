// In utils/geminiApi.ts
import axios from "axios";
import { GEMINI_API_KEY } from "../config";
import { Transaction } from "../database";

// Define the structure of the report we expect from the AI
export interface StructuredReport {
  title: string;
  summary: string;
  insights: string[];
  tips: string[];
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const generateReportWithGemini = async (
  transactions: Transaction[]
): Promise<StructuredReport> => { // <-- Return type is now our structured interface
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing. Please add it to your config.js file.");
  }

  const summary = transactions
    .map((t) => `${t.date.split("T")[0]}: ${t.type} of ${t.amount.toFixed(2)} in ${t.category}`)
    .join("\n");

  // UPDATED: The prompt now asks for a specific JSON structure
  const prompt = `
    As a financial analyst, analyze the following transaction data for a user in India (currency is INR).
    Provide a concise financial wellness report.
    Your response MUST be a valid JSON object with the following structure:
    {
      "title": "Your Financial Summary",
      "summary": "A brief, one-paragraph overview of the user's key financial activities (total income, total expenses, and net savings). Keep the tone encouraging.",
      "insights": [
        "A bullet point identifying the largest spending category.",
        "A second bullet point about a notable financial habit (e.g., frequent small purchases, significant income source)."
      ],
      "tips": [
        "A personalized, actionable savings tip based on their spending.",
        "A second, different actionable savings tip."
      ]
    }

    Here is the transaction data:
    ---
    ${summary}
    ---
  `;

  try {
    const response = await axios.post(API_URL, {
      contents: [{ parts: [{ text: prompt }] }],
      // Add a generation config to ensure the output is clean JSON
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new Error("The response from the AI was blocked or empty.");
    }

    const reportJsonString = response.data.candidates[0].content.parts[0].text;
    const reportObject: StructuredReport = JSON.parse(reportJsonString);

    if (!reportObject.title || !reportObject.summary) {
        throw new Error("Received an incomplete report from the API.");
    }
    
    return reportObject;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Gemini API Error:", error.response?.data || error.message);
    } else {
      console.error("An unexpected error occurred:", error);
    }
    throw new Error("Failed to communicate with the Gemini API.");
  }
};