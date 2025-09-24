// In utils/geminiApi.ts
import axios from "axios";
import { GEMINI_API_KEY } from "../config";
import { Transaction } from "../database";

// Enhanced structure for more comprehensive reports
export interface StructuredReport {
  title: string;
  summary: string;
  insights: string[];
  tips: string[];
  financialHealth?: {
    score: number; // 1-100
    status: 'Poor' | 'Fair' | 'Good' | 'Excellent';
    primaryConcerns: string[];
  };
  keyMetrics?: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number; // percentage
    topSpendingCategory: string;
  };
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const generateReportWithGemini = async (
  transactions: Transaction[]
): Promise<StructuredReport> => {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing. Please add it to your config.js file.");
  }

  // Calculate basic metrics for better context
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Group expenses by category
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const topCategory = Object.entries(expensesByCategory)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

  const summary = transactions
    .map((t) => `${t.date.split("T")[0]}: ${t.type} of ₹${t.amount.toFixed(2)} in ${t.category}`)
    .join("\n");

  const prompt = `
    As a certified financial advisor in India, analyze this transaction data and provide a comprehensive financial wellness report.
    
    Context:
    - Total Income: ₹${income.toFixed(2)}
    - Total Expenses: ₹${expenses.toFixed(2)}
    - Net Position: ₹${(income - expenses).toFixed(2)}
    - Top Spending Category: ${topCategory} (₹${expensesByCategory[topCategory]?.toFixed(2) || 0})
    
    Your response MUST be a valid JSON object with this exact structure:
    {
      "title": "Personalized Financial Health Report",
      "summary": "A comprehensive 2-3 sentence overview highlighting the user's financial position, including total income, expenses, and net savings. Use encouraging but realistic language.",
      "insights": [
        "Primary insight about spending patterns or the largest expense category with specific amounts",
        "Secondary insight about financial habits, frequency of transactions, or income sources",
        "Additional insight about seasonal patterns, recurring expenses, or opportunities (if data supports it)"
      ],
      "tips": [
        "Most impactful, specific tip based on their top spending category with actionable steps",
        "Second priority tip focusing on savings or budgeting with concrete suggestions",
        "Long-term financial tip for wealth building or emergency fund creation"
      ],
      "financialHealth": {
        "score": 75,
        "status": "Good",
        "primaryConcerns": ["List 1-2 main areas needing attention based on the data"]
      },
      "keyMetrics": {
        "totalIncome": ${income},
        "totalExpenses": ${expenses},
        "netSavings": ${income - expenses},
        "savingsRate": ${income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0},
        "topSpendingCategory": "${topCategory}"
      }
    }

    Guidelines:
    - Financial Health Score (1-100): Consider savings rate, expense control, and spending patterns
    - Status: Poor (0-40), Fair (41-60), Good (61-80), Excellent (81-100)
    - Make insights specific with actual amounts and percentages where relevant
    - Provide actionable tips that are realistic for Indian context
    - Keep language positive but honest about areas needing improvement
    - Use Indian Rupee (₹) formatting consistently

    Transaction Data:
    ---
    ${summary}
    ---
  `;

  try {
    const response = await axios.post(API_URL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3, // Lower temperature for more consistent formatting
        topK: 40,
        topP: 0.95,
      }
    });

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new Error("The response from the AI was blocked or empty.");
    }

    const reportJsonString = response.data.candidates[0].content.parts[0].text;
    let reportObject: StructuredReport;
    
    try {
      reportObject = JSON.parse(reportJsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", reportJsonString);
      throw new Error("The AI response was not in the expected JSON format.");
    }

    // Validate required fields
    if (!reportObject.title || !reportObject.summary || !Array.isArray(reportObject.insights) || !Array.isArray(reportObject.tips)) {
      throw new Error("Received an incomplete report from the API. Missing required fields.");
    }

    // Ensure minimum content requirements
    if (reportObject.insights.length === 0) {
      reportObject.insights = ["Your transaction data shows regular financial activity that we're analyzing."];
    }
    
    if (reportObject.tips.length === 0) {
      reportObject.tips = [
        "Track your daily expenses to identify saving opportunities.",
        "Set up automatic transfers to a savings account."
      ];
    }

    // Fallback for financial health if not provided
    if (!reportObject.financialHealth) {
      const savingsRate = income > 0 ? ((income - expenses) / income * 100) : 0;
      reportObject.financialHealth = {
        score: Math.max(10, Math.min(90, 50 + savingsRate * 0.8)), // Basic score calculation
        status: savingsRate > 20 ? 'Good' : savingsRate > 10 ? 'Fair' : 'Poor',
        primaryConcerns: expenses > income ? ['Spending exceeds income'] : ['Build emergency fund']
      };
    }

    // Fallback for key metrics if not provided
    if (!reportObject.keyMetrics) {
      reportObject.keyMetrics = {
        totalIncome: income,
        totalExpenses: expenses,
        netSavings: income - expenses,
        savingsRate: income > 0 ? parseFloat(((income - expenses) / income * 100).toFixed(1)) : 0,
        topSpendingCategory: topCategory
      };
    }
    
    return reportObject;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Gemini API Error:", error.response?.data || error.message);
      
      // Provide a fallback report if API fails
      return {
        title: "Financial Summary Report",
        summary: `Based on your transactions, you have ₹${income.toFixed(2)} in income and ₹${expenses.toFixed(2)} in expenses, resulting in ${income >= expenses ? 'savings' : 'a deficit'} of ₹${Math.abs(income - expenses).toFixed(2)}.`,
        insights: [
          `Your primary spending category is ${topCategory} with ₹${expensesByCategory[topCategory]?.toFixed(2) || 0} spent.`,
          `You have ${transactions.length} recorded transactions in this period.`
        ],
        tips: [
          "Review your largest spending category to identify potential savings.",
          "Consider setting up a monthly budget to track expenses better."
        ],
        financialHealth: {
          score: 50,
          status: 'Fair',
          primaryConcerns: ['Unable to generate detailed analysis - please try again']
        },
        keyMetrics: {
          totalIncome: income,
          totalExpenses: expenses,
          netSavings: income - expenses,
          savingsRate: income > 0 ? parseFloat(((income - expenses) / income * 100).toFixed(1)) : 0,
          topSpendingCategory: topCategory
        }
      };
    } else {
      console.error("An unexpected error occurred:", error);
      throw new Error("Failed to analyze your financial data. Please try again later.");
    }
  }
};