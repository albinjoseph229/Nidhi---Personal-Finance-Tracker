// In utils/pdfExport.ts
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Transaction } from '../database';

// Interfaces for structured report data
interface MonthlyData {
  month: string;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  transactionCount: number;
}
interface YearlyData {
  year: number;
  income: number;
  expenses: number;
  savings: number;
  transactionCount: number;
  monthlyBreakdown: MonthlyData[];
}

// Main function to generate and share the PDF
export const generateFinancialReport = async (transactions: Transaction[]): Promise<void> => {
  try {
    const reportData = processTransactionData(transactions);
    const htmlContent = generateHTMLContent(reportData);
    
    // 1. Print the HTML to a temporary PDF file
    const { uri: tempUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // 2. Create a File instance for the temporary file
    const tempFile = new File(tempUri);

    // 3. Define the new filename and create a File instance for the destination
    const fileName = `Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    const destinationFile = new File(Paths.document, fileName);
    
    // 4. Move the temporary file to its final destination
    await tempFile.move(destinationFile);

    // 5. Share the file from its new location
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destinationFile.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Financial Report',
      });
    }
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF report');
  }
};

// Processes raw transactions into a structured yearly/monthly format
const processTransactionData = (transactions: Transaction[]): YearlyData[] => {
  const yearlyMap: { [year: number]: YearlyData } = {};
  
  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'long' });
    
    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        year,
        income: 0,
        expenses: 0,
        savings: 0,
        transactionCount: 0,
        monthlyBreakdown: [],
      };
    }
    
    const yearData = yearlyMap[year];
    yearData.transactionCount++;
    
    if (tx.type === 'income') {
      yearData.income += tx.amount;
    } else {
      yearData.expenses += tx.amount;
    }
    
    let monthData = yearData.monthlyBreakdown.find(m => m.month === month);
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
    if (tx.type === 'income') {
      monthData.income += tx.amount;
    } else {
      monthData.expenses += tx.amount;
    }
    monthData.savings = monthData.income - monthData.expenses;
  });
  
  Object.values(yearlyMap).forEach(yearData => {
    yearData.savings = yearData.income - yearData.expenses;
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    yearData.monthlyBreakdown.sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
  });
  
  return Object.values(yearlyMap).sort((a, b) => b.year - a.year);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount).replace('₹', '₹ ');
};

// Generates the complete HTML string for the PDF
const generateHTMLContent = (data: YearlyData[]): string => {
  const currentDate = new Date().toLocaleDateString('en-IN');
  const totalIncome = data.reduce((sum, year) => sum + year.income, 0);
  const totalExpenses = data.reduce((sum, year) => sum + year.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;

  const generateChartUrl = (yearData: YearlyData) => {
    const labels = yearData.monthlyBreakdown.map(m => m.month.substring(0, 3));
    const incomeData = yearData.monthlyBreakdown.map(m => m.income);
    const expenseData = yearData.monthlyBreakdown.map(m => m.expenses);
    
    const chartConfig = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Income', data: incomeData, backgroundColor: 'rgba(52, 199, 89, 0.7)' },
          { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(255, 59, 48, 0.7)' }
        ]
      },
      options: { title: { display: true, text: `${yearData.year} Financial Summary` }, legend: { position: 'top' } }
    };
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=500&height=300`;
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
        .summary-card { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary-grid { display: flex; justify-content: space-around; text-align: center; }
        .summary-item .label { font-size: 14px; color: #6c757d; }
        .summary-item .value { font-size: 24px; font-weight: bold; }
        .income { color: #34C759; }
        .expense { color: #FF3B30; }
        .chart { text-align: center; margin: 30px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Albin Joseph Financial Report</h1>
        <p>Generated on ${currentDate}</p>
      </div>
      <div class="summary-card">
        <h2>Overall Summary</h2>
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

      ${data.map(yearData => `
        <div class="year-section">
          <h2>${yearData.year} Report</h2>
          <div class="chart">
            <img src="${generateChartUrl(yearData)}" alt="${yearData.year} Chart" />
          </div>
          <table>
            <thead>
              <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Savings</th></tr>
            </thead>
            <tbody>
              ${yearData.monthlyBreakdown.map(m => `
                <tr>
                  <td>${m.month}</td>
                  <td class="income">${formatCurrency(m.income)}</td>
                  <td class="expense">${formatCurrency(m.expenses)}</td>
                  <td>${formatCurrency(m.savings)}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f8f9fa;">
                <td>Total</td>
                <td class="income">${formatCurrency(yearData.income)}</td>
                <td class="expense">${formatCurrency(yearData.expenses)}</td>
                <td>${formatCurrency(yearData.savings)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `).join('')}
      
      <div class="footer">
        <p>End of Report</p>
      </div>
    </body>
    </html>
  `;
};