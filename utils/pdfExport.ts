// In utils/pdfExport.ts
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Investment, Transaction } from "../database";

// Interfaces for structured report data
interface MonthlyData {
  month: string;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  transactionCount: number;
}

interface InvestmentData {
  totalInvestment: number;
  currentValue: number;
  totalProfitLoss: number;
  totalSoldProfit: number;
  activeInvestments: number;
  soldInvestments: number;
  investmentsByType: {
    [type: string]: {
      investment: number;
      currentValue: number;
      profitLoss: number;
      count: number;
    };
  };
}

interface YearlyData {
  year: number;
  income: number;
  expenses: number;
  savings: number;
  transactionCount: number;
  monthlyBreakdown: MonthlyData[];
  investments: InvestmentData;
}

// Main function to generate and share the PDF
export const generateFinancialReport = async (
  transactions: Transaction[],
  investments: Investment[] = []
): Promise<void> => {
  try {
    const reportData = processTransactionData(transactions, investments);
    const htmlContent = generateHTMLContent(reportData, investments);

    // 1. Print the HTML to a temporary PDF file
    const { uri: tempUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // 2. Create a File instance for the temporary file
    const tempFile = new File(tempUri);

    // 3. Define the new filename and create a File instance for the destination
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const fileName = `Financial_Report_${timestamp}.pdf`;
    const destinationFile = new File(Paths.document, fileName);

    // 4. Move the temporary file to its final destination
    await tempFile.move(destinationFile);

    // 5. Share the file from its new location
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destinationFile.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Financial Report",
      });
    }
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw new Error("Failed to generate PDF report");
  }
};

// Process investments data for a specific year
const processInvestmentDataForYear = (
  investments: Investment[],
  year: number
): InvestmentData => {
  const yearInvestments = investments.filter((inv) => {
    const purchaseYear = new Date(inv.purchaseDate).getFullYear();
    return purchaseYear === year;
  });

  const investmentData: InvestmentData = {
    totalInvestment: 0,
    currentValue: 0,
    totalProfitLoss: 0,
    totalSoldProfit: 0,
    activeInvestments: 0,
    soldInvestments: 0,
    investmentsByType: {},
  };

  yearInvestments.forEach((inv) => {
    const totalInvested = inv.quantity * inv.purchasePrice;
    const currentVal =
      inv.status === "sold"
        ? (inv.soldPrice || 0) * inv.quantity
        : inv.currentValue * inv.quantity;
    const profitLoss = currentVal - totalInvested;

    investmentData.totalInvestment += totalInvested;
    investmentData.currentValue += currentVal;
    investmentData.totalProfitLoss += profitLoss;

    if (inv.status === "sold") {
      investmentData.totalSoldProfit += profitLoss;
      investmentData.soldInvestments++;
    } else {
      investmentData.activeInvestments++;
    }

    // Group by investment type
    if (!investmentData.investmentsByType[inv.type]) {
      investmentData.investmentsByType[inv.type] = {
        investment: 0,
        currentValue: 0,
        profitLoss: 0,
        count: 0,
      };
    }

    investmentData.investmentsByType[inv.type].investment += totalInvested;
    investmentData.investmentsByType[inv.type].currentValue += currentVal;
    investmentData.investmentsByType[inv.type].profitLoss += profitLoss;
    investmentData.investmentsByType[inv.type].count++;
  });

  return investmentData;
};

// Processes raw transactions and investments into a structured yearly/monthly format
const processTransactionData = (
  transactions: Transaction[],
  investments: Investment[] = []
): YearlyData[] => {
  const yearlyMap: { [year: number]: YearlyData } = {};

  // Process transactions
  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    const year = date.getFullYear();
    const month = date.toLocaleString("en-US", { month: "long" });

    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        year,
        income: 0,
        expenses: 0,
        savings: 0,
        transactionCount: 0,
        monthlyBreakdown: [],
        investments: {
          totalInvestment: 0,
          currentValue: 0,
          totalProfitLoss: 0,
          totalSoldProfit: 0,
          activeInvestments: 0,
          soldInvestments: 0,
          investmentsByType: {},
        },
      };
    }

    const yearData = yearlyMap[year];
    yearData.transactionCount++;

    if (tx.type === "income") {
      yearData.income += tx.amount;
    } else {
      yearData.expenses += tx.amount;
    }

    let monthData = yearData.monthlyBreakdown.find((m) => m.month === month);
    if (!monthData) {
      monthData = {
        month,
        year,
        income: 0,
        expenses: 0,
        savings: 0,
        transactionCount: 0,
      };
      yearData.monthlyBreakdown.push(monthData);
    }

    monthData.transactionCount++;
    if (tx.type === "income") {
      monthData.income += tx.amount;
    } else {
      monthData.expenses += tx.amount;
    }
    monthData.savings = monthData.income - monthData.expenses;
  });

  // Process investments for each year
  Object.keys(yearlyMap).forEach((yearStr) => {
    const year = parseInt(yearStr);
    yearlyMap[year].investments = processInvestmentDataForYear(
      investments,
      year
    );
  });

  // Also add years that only have investments (no transactions)
  investments.forEach((inv) => {
    const year = new Date(inv.purchaseDate).getFullYear();
    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        year,
        income: 0,
        expenses: 0,
        savings: 0,
        transactionCount: 0,
        monthlyBreakdown: [],
        investments: processInvestmentDataForYear(investments, year),
      };
    }
  });

  Object.values(yearlyMap).forEach((yearData) => {
    yearData.savings = yearData.income - yearData.expenses;
    const monthOrder = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    yearData.monthlyBreakdown.sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );
  });

  return Object.values(yearlyMap).sort((a, b) => b.year - a.year);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("₹", "₹ ");
};

// Generates the complete HTML string for the PDF
const generateHTMLContent = (
  data: YearlyData[],
  allInvestments: Investment[] = []
): string => {
  const currentDate = new Date().toLocaleDateString("en-IN");
  const totalIncome = data.reduce((sum, year) => sum + year.income, 0);
  const totalExpenses = data.reduce((sum, year) => sum + year.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;

  // Calculate overall investment summary
  const overallInvestmentSummary = allInvestments.reduce(
    (acc, inv) => {
      const totalInvested = inv.quantity * inv.purchasePrice;
      const currentVal =
        inv.status === "sold"
          ? (inv.soldPrice || 0) * inv.quantity
          : inv.currentValue * inv.quantity;
      const profitLoss = currentVal - totalInvested;

      acc.totalInvestment += totalInvested;
      acc.currentValue += currentVal;
      acc.totalProfitLoss += profitLoss;

      if (inv.status === "sold") {
        acc.totalSoldProfit += profitLoss;
        acc.soldCount++;
      } else {
        acc.activeCount++;
      }

      return acc;
    },
    {
      totalInvestment: 0,
      currentValue: 0,
      totalProfitLoss: 0,
      totalSoldProfit: 0,
      activeCount: 0,
      soldCount: 0,
    }
  );

  const generateChartUrl = (yearData: YearlyData) => {
    const labels = yearData.monthlyBreakdown.map((m) =>
      m.month.substring(0, 3)
    );
    const incomeData = yearData.monthlyBreakdown.map((m) => m.income);
    const expenseData = yearData.monthlyBreakdown.map((m) => m.expenses);

    const chartConfig = {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Income",
            data: incomeData,
            backgroundColor: "rgba(52, 199, 89, 0.7)",
          },
          {
            label: "Expenses",
            data: expenseData,
            backgroundColor: "rgba(255, 59, 48, 0.7)",
          },
        ],
      },
      options: {
        title: { display: true, text: `${yearData.year} Financial Summary` },
        legend: { position: "top" },
        scales: { y: { beginAtZero: true } },
      },
    };
    return `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify(chartConfig)
    )}&width=500&height=300`;
  };

  const generateInvestmentChart = (yearData: YearlyData) => {
    if (Object.keys(yearData.investments.investmentsByType).length === 0)
      return "";

    const types = Object.keys(yearData.investments.investmentsByType);
    const values = types.map(
      (type) => yearData.investments.investmentsByType[type].currentValue
    );

    const chartConfig = {
      type: "pie",
      data: {
        labels: types,
        datasets: [
          {
            data: values,
            backgroundColor: [
              "rgba(52, 199, 89, 0.8)",
              "rgba(0, 122, 255, 0.8)",
              "rgba(255, 149, 0, 0.8)",
              "rgba(175, 82, 222, 0.8)",
              "rgba(255, 59, 48, 0.8)",
            ],
          },
        ],
      },
      options: {
        title: { display: true, text: `${yearData.year} Investment Portfolio` },
        legend: { position: "right" },
      },
    };

    return `<div class="chart">
      <img src="https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify(chartConfig)
      )}&width=400&height=250" alt="${yearData.year} Investment Chart" />
    </div>`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Financial Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #007AFF; padding-bottom: 20px; }
        h1 { color: #007AFF; margin: 0; }
        h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 40px; }
        h3 { color: #555; margin-top: 30px; }
        .summary-card { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .investment-card { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary-grid { display: flex; justify-content: space-around; text-align: center; flex-wrap: wrap; }
        .summary-item { margin: 10px; }
        .summary-item .label { font-size: 14px; color: #6c757d; }
        .summary-item .value { font-size: 24px; font-weight: bold; }
        .income { color: #34C759; }
        .expense { color: #FF3B30; }
        .investment { color: #007AFF; }
        .profit { color: #34C759; }
        .loss { color: #FF3B30; }
        .chart { text-align: center; margin: 30px 0; }
        .chart img { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; }
        .investment-breakdown { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .investment-type-card { background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .investment-type-card .type { font-weight: bold; color: #333; }
        .investment-type-card .amount { font-size: 18px; margin: 5px 0; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6c757d; }
        .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 768px) { .two-column { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Albin Joseph Financial Report</h1>
        <p>Generated on ${currentDate}</p>
      </div>
      
      <div class="summary-card">
        <h2>Overall Financial Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Income</div>
            <div class="value income">${formatCurrency(totalIncome)}</div>
          </div>
          <div class="summary-item">
            <div class="label">Total Expenses</div>
            <div class="value expense">${formatCurrency(totalExpenses)}</div>
          </div>
          <div class="summary-item">
            <div class="label">Net Savings</div>
            <div class="value">${formatCurrency(totalSavings)}</div>
          </div>
        </div>
      </div>

      ${
        overallInvestmentSummary.totalInvestment > 0
          ? `
      <div class="investment-card">
        <h2>Overall Investment Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Investment</div>
            <div class="value investment">${formatCurrency(
              overallInvestmentSummary.totalInvestment
            )}</div>
          </div>
          <div class="summary-item">
            <div class="label">Current Value</div>
            <div class="value investment">${formatCurrency(
              overallInvestmentSummary.currentValue
            )}</div>
          </div>
          <div class="summary-item">
            <div class="label">Total P&L</div>
            <div class="value ${
              overallInvestmentSummary.totalProfitLoss >= 0 ? "profit" : "loss"
            }">${formatCurrency(overallInvestmentSummary.totalProfitLoss)}</div>
          </div>
          <div class="summary-item">
            <div class="label">Active Investments</div>
            <div class="value">${overallInvestmentSummary.activeCount}</div>
          </div>
          <div class="summary-item">
            <div class="label">Sold Investments</div>
            <div class="value">${overallInvestmentSummary.soldCount}</div>
          </div>
          <div class="summary-item">
            <div class="label">Realized P&L</div>
            <div class="value ${
              overallInvestmentSummary.totalSoldProfit >= 0 ? "profit" : "loss"
            }">${formatCurrency(overallInvestmentSummary.totalSoldProfit)}</div>
          </div>
        </div>
      </div>
      `
          : ""
      }

      ${data
        .map(
          (yearData) => `
        <div class="year-section">
          <h2>${yearData.year} Report</h2>
          
          <div class="two-column">
            <div>
              <h3>Income vs Expenses</h3>
              <div class="chart">
                <img src="${generateChartUrl(yearData)}" alt="${
            yearData.year
          } Chart" />
              </div>
            </div>
            
            ${
              yearData.investments.totalInvestment > 0
                ? `
            <div>
              <h3>Investment Portfolio</h3>
              ${generateInvestmentChart(yearData)}
            </div>
            `
                : "<div></div>"
            }
          </div>

          ${
            yearData.investments.totalInvestment > 0
              ? `
          <div class="investment-card">
            <h3>${yearData.year} Investment Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="label">Total Investment</div>
                <div class="value investment">${formatCurrency(
                  yearData.investments.totalInvestment
                )}</div>
              </div>
              <div class="summary-item">
                <div class="label">Current Value</div>
                <div class="value investment">${formatCurrency(
                  yearData.investments.currentValue
                )}</div>
              </div>
              <div class="summary-item">
                <div class="label">Profit/Loss</div>
                <div class="value ${
                  yearData.investments.totalProfitLoss >= 0 ? "profit" : "loss"
                }">${formatCurrency(yearData.investments.totalProfitLoss)}</div>
              </div>
              <div class="summary-item">
                <div class="label">Active</div>
                <div class="value">${
                  yearData.investments.activeInvestments
                }</div>
              </div>
              <div class="summary-item">
                <div class="label">Sold</div>
                <div class="value">${yearData.investments.soldInvestments}</div>
              </div>
            </div>
            
            ${
              Object.keys(yearData.investments.investmentsByType).length > 0
                ? `
            <div class="investment-breakdown">
              ${Object.entries(yearData.investments.investmentsByType)
                .map(
                  ([type, data]) => `
                <div class="investment-type-card">
                  <div class="type">${type}</div>
                  <div class="amount investment">${formatCurrency(
                    data.currentValue
                  )}</div>
                  <div class="label">Investment: ${formatCurrency(
                    data.investment
                  )}</div>
                  <div class="label ${
                    data.profitLoss >= 0 ? "profit" : "loss"
                  }">P&L: ${formatCurrency(data.profitLoss)}</div>
                  <div class="label">${data.count} holdings</div>
                </div>
              `
                )
                .join("")}
            </div>
            `
                : ""
            }
          </div>
          `
              : ""
          }
          
          ${
            yearData.monthlyBreakdown.length > 0
              ? `
          <table>
            <thead>
              <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Savings</th></tr>
            </thead>
            <tbody>
              ${yearData.monthlyBreakdown
                .map(
                  (m) => `
                <tr>
                  <td>${m.month}</td>
                  <td class="income">${formatCurrency(m.income)}</td>
                  <td class="expense">${formatCurrency(m.expenses)}</td>
                  <td>${formatCurrency(m.savings)}</td>
                </tr>
              `
                )
                .join("")}
              <tr style="font-weight: bold; background-color: #f8f9fa;">
                <td>Total</td>
                <td class="income">${formatCurrency(yearData.income)}</td>
                <td class="expense">${formatCurrency(yearData.expenses)}</td>
                <td>${formatCurrency(yearData.savings)}</td>
              </tr>
            </tbody>
          </table>
          `
              : ""
          }
        </div>
      `
        )
        .join("")}
      
      <div class="footer">
        <p>End of Report</p>
      </div>
    </body>
    </html>
  `;
};
