// In utils/geminiApi.ts
import { Investment, Transaction } from "../database";

// --- REMOVED: Direct API access ---
// import axios from "axios";
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- NEW: Backend URL configuration ---
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Enhanced structure for more comprehensive reports including investments
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
  investmentMetrics?: {
    totalInvestment: number;
    currentValue: number;
    totalProfitLoss: number;
    profitLossPercentage: number;
    activeInvestments: number;
    soldInvestments: number;
    bestPerformingType: string;
    worstPerformingType: string;
    portfolioDiversification: number; // 1-100 score
  };
  investmentInsights?: string[];
  investmentTips?: string[];
}

export const generateReportWithGemini = async (
  transactions: Transaction[],
  investments: Investment[] = []
): Promise<StructuredReport> => {
  if (!BACKEND_URL) {
    throw new Error("Backend URL is not defined. Please add EXPO_PUBLIC_BACKEND_URL to your .env file.");
  }

  // Calculate basic transaction metrics
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

  // Calculate investment metrics
  let totalInvestment = 0;
  let currentValue = 0;
  let totalProfitLoss = 0;
  let activeCount = 0;
  let soldCount = 0;
  const investmentsByType: Record<string, { investment: number; currentValue: number; profitLoss: number; count: number }> = {};

  investments.forEach(inv => {
    const invested = inv.quantity * inv.purchasePrice;
    const current = inv.status === 'sold' ? (inv.soldPrice || 0) * inv.quantity : inv.currentValue * inv.quantity;
    const profitLoss = current - invested;

    totalInvestment += invested;
    currentValue += current;
    totalProfitLoss += profitLoss;

    if (inv.status === 'sold') {
      soldCount++;
    } else {
      activeCount++;
    }

    // Group by type
    if (!investmentsByType[inv.type]) {
      investmentsByType[inv.type] = { investment: 0, currentValue: 0, profitLoss: 0, count: 0 };
    }
    investmentsByType[inv.type].investment += invested;
    investmentsByType[inv.type].currentValue += current;
    investmentsByType[inv.type].profitLoss += profitLoss;
    investmentsByType[inv.type].count++;
  });

  const profitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
  const portfolioDiversification = Object.keys(investmentsByType).length * 25; // Simple diversification score

  // Find best and worst performing investment types
  const typePerformances = Object.entries(investmentsByType)
    .map(([type, data]) => ({ type, percentage: data.investment > 0 ? (data.profitLoss / data.investment) * 100 : 0 }))
    .sort((a, b) => b.percentage - a.percentage);

  const bestPerformingType = typePerformances[0]?.type || 'N/A';
  const worstPerformingType = typePerformances[typePerformances.length - 1]?.type || 'N/A';

  const transactionSummary = transactions
    .map((t) => `${t.date.split("T")[0]}: ${t.type} of ₹${t.amount.toFixed(2)} in ${t.category}`)
    .join("\n");

  const investmentSummary = investments
    .map((inv) => `${inv.purchaseDate.split("T")[0]}: ${inv.type} - ${inv.name}, Qty: ${inv.quantity}, Purchase: ₹${inv.purchasePrice}, Current: ₹${inv.currentValue}, Status: ${inv.status}`)
    .join("\n");

  const prompt = `
    As a certified financial advisor in India, analyze this comprehensive financial data including transactions and investments to provide a holistic financial wellness report.
    
    Transaction Context:
    - Total Income: ₹${income.toFixed(2)}
    - Total Expenses: ₹${expenses.toFixed(2)}
    - Net Savings: ₹${(income - expenses).toFixed(2)}
    - Top Spending Category: ${topCategory} (₹${expensesByCategory[topCategory]?.toFixed(2) || 0})
    
    Investment Context:
    - Total Investment: ₹${totalInvestment.toFixed(2)}
    - Current Portfolio Value: ₹${currentValue.toFixed(2)}
    - Total Profit/Loss: ₹${totalProfitLoss.toFixed(2)} (${profitLossPercentage.toFixed(1)}%)
    - Active Investments: ${activeCount}, Sold: ${soldCount}
    - Best Performing Type: ${bestPerformingType}
    - Worst Performing Type: ${worstPerformingType}
    - Investment Types: ${Object.keys(investmentsByType).join(', ') || 'None'}

    Your response MUST be a valid JSON object with this exact structure:
    {
      "title": "Comprehensive Financial & Investment Report",
      "summary": "A 3-4 sentence overview covering both cash flow and investment performance. Highlight the overall financial picture including net worth progress.",
      "insights": [
        "Primary insight about spending patterns with specific amounts and categories",
        "Secondary insight about investment performance, diversification, or portfolio allocation",
        "Third insight about financial habits, seasonal patterns, or risk management"
      ],
      "tips": [
        "Most impactful cash flow optimization tip based on spending patterns",
        "Investment-focused tip addressing portfolio performance or diversification",
        "Long-term wealth building tip combining both savings and investment strategies"
      ],
      "financialHealth": {
        "score": 75,
        "status": "Good",
        "primaryConcerns": ["List 1-2 main areas needing attention considering both cash flow and investments"]
      },
      "keyMetrics": {
        "totalIncome": ${income},
        "totalExpenses": ${expenses},
        "netSavings": ${income - expenses},
        "savingsRate": ${income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0},
        "topSpendingCategory": "${topCategory}"
      },
      "investmentMetrics": {
        "totalInvestment": ${totalInvestment},
        "currentValue": ${currentValue},
        "totalProfitLoss": ${totalProfitLoss},
        "profitLossPercentage": ${profitLossPercentage.toFixed(2)},
        "activeInvestments": ${activeCount},
        "soldInvestments": ${soldCount},
        "bestPerformingType": "${bestPerformingType}",
        "worstPerformingType": "${worstPerformingType}",
        "portfolioDiversification": ${Math.min(100, portfolioDiversification)}
      },
      "investmentInsights": [
        "Insight about portfolio performance and risk assessment",
        "Insight about asset allocation and diversification effectiveness",
        "Insight about investment timing or market positioning if relevant"
      ],
      "investmentTips": [
        "Specific tip for improving portfolio performance or reducing risk",
        "Diversification or rebalancing recommendation based on current allocation",
        "Long-term investment strategy tip aligned with Indian market conditions"
      ]
    }

    Guidelines:
    - Financial Health Score: Consider cash flow, savings rate, investment returns, and risk diversification
    - For investments: Focus on diversification, risk management, and long-term growth potential
    - Provide actionable advice specific to Indian financial markets and tax implications
    - If no investments exist, focus investment insights on getting started with investing
    - Use Indian Rupee (₹) formatting and consider Indian investment options (PPF, ELSS, etc.)
    - Balance encouragement with realistic assessments of financial health

    Transaction Data:
    ---
    ${transactionSummary}
    ---

    Investment Data:
    ---
    ${investmentSummary || 'No investment data available'}
    ---
  `;

  try {
    // --- MODIFIED: Call secure backend instead of direct Gemini API ---
    const response = await fetch(`${BACKEND_URL}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(errorData.error || `Server returned status ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("The response from the AI was blocked or empty.");
    }

    const reportJsonString = data.candidates[0].content.parts[0].text;
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
      const investmentReturn = profitLossPercentage;
      const baseScore = Math.max(10, Math.min(90, 50 + savingsRate * 0.5 + investmentReturn * 0.3));
      
      reportObject.financialHealth = {
        score: Math.round(baseScore),
        status: baseScore > 80 ? 'Excellent' : baseScore > 60 ? 'Good' : baseScore > 40 ? 'Fair' : 'Poor',
        primaryConcerns: expenses > income ? ['Spending exceeds income'] : totalInvestment === 0 ? ['No investments found'] : ['Build emergency fund']
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

    // Fallback for investment metrics if not provided
    if (!reportObject.investmentMetrics && investments.length > 0) {
      reportObject.investmentMetrics = {
        totalInvestment,
        currentValue,
        totalProfitLoss,
        profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2)),
        activeInvestments: activeCount,
        soldInvestments: soldCount,
        bestPerformingType,
        worstPerformingType,
        portfolioDiversification: Math.min(100, portfolioDiversification)
      };
    }

    // Fallback investment insights and tips
    if (investments.length > 0) {
      if (!reportObject.investmentInsights || reportObject.investmentInsights.length === 0) {
        reportObject.investmentInsights = [
          `Your investment portfolio shows ${profitLossPercentage >= 0 ? 'positive' : 'negative'} returns of ${profitLossPercentage.toFixed(1)}%.`,
          `You have ${Object.keys(investmentsByType).length} different investment types in your portfolio.`
        ];
      }

      if (!reportObject.investmentTips || reportObject.investmentTips.length === 0) {
        reportObject.investmentTips = [
          "Consider diversifying across different asset classes to reduce risk.",
          "Review your investment performance quarterly and rebalance if needed."
        ];
      }
    }
    
    return reportObject;

  } catch (error) {
    console.error("Gemini API Error via backend:", error);
    
    // Enhanced fallback report including investments
    return {
      title: "Financial Summary Report",
      summary: `Based on your data: ₹${income.toFixed(2)} income, ₹${expenses.toFixed(2)} expenses (${income >= expenses ? 'savings' : 'deficit'} of ₹${Math.abs(income - expenses).toFixed(2)}), and ₹${totalInvestment.toFixed(2)} in investments ${totalInvestment > 0 ? `with ${profitLossPercentage.toFixed(1)}% returns` : ''}.`,
      insights: [
        `Your primary spending category is ${topCategory} with ₹${expensesByCategory[topCategory]?.toFixed(2) || 0} spent.`,
        investments.length > 0 ? `Your investment portfolio has ${investments.length} holdings across ${Object.keys(investmentsByType).length} types.` : "Consider starting an investment portfolio for long-term growth.",
        `You have ${transactions.length} recorded transactions in this period.`
      ],
      tips: [
        "Review your largest spending category to identify potential savings.",
        investments.length > 0 ? "Monitor your investment performance and consider rebalancing quarterly." : "Start investing with SIPs in diversified mutual funds.",
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
      },
      ...(investments.length > 0 && {
        investmentMetrics: {
          totalInvestment,
          currentValue,
          totalProfitLoss,
          profitLossPercentage: parseFloat(profitLossPercentage.toFixed(2)),
          activeInvestments: activeCount,
          soldInvestments: soldCount,
          bestPerformingType,
          worstPerformingType,
          portfolioDiversification: Math.min(100, portfolioDiversification)
        },
        investmentInsights: [
          `Portfolio shows ${profitLossPercentage.toFixed(1)}% overall return.`,
          `${activeCount} active investments across ${Object.keys(investmentsByType).length} types.`
        ],
        investmentTips: [
          "Review portfolio performance and consider diversification.",
          "Monitor market trends and rebalance as needed."
        ]
      })
    };
  }
};