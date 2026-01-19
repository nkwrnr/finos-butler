# Personal Finance Web App

A Next.js-based personal finance application with Zcash tracking and savings goals management.

## Features

- **Dashboard**: View your financial status, Zcash guidance, and savings goals progress
- **Import Statements**: Upload and parse PDF or CSV bank statements with automatic transaction extraction
- **Settings**: Manually input and update your Zcash holdings and cost basis
- **SQLite Database**: Local database storing accounts, transactions, Zcash holdings, and savings goals
- **Responsive Design**: Clean, minimal interface built with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Navigate to the project directory:
```bash
cd finance-app
```

2. Install dependencies (already done):
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Schema

The app uses SQLite with the following tables:

### accounts
- `id`: Primary key
- `name`: Account name
- `institution`: Financial institution
- `type`: Account type
- `balance`: Current balance
- `last_updated`: Last update timestamp

### transactions
- `id`: Primary key
- `account_id`: Foreign key to accounts
- `date`: Transaction date
- `description`: Transaction description
- `amount`: Transaction amount
- `category`: Transaction category

### zcash_holdings
- `id`: Primary key
- `total_zec`: Total Zcash amount
- `cost_basis_usd`: Cost basis in USD (optional)
- `last_updated`: Last update timestamp

### savings_goals
- `id`: Primary key
- `name`: Goal name (unique)
- `target_amount`: Target amount
- `current_amount`: Current amount saved

## Pre-seeded Data

The database comes pre-seeded with two savings goals:
- **House**: $0 / $100,000
- **Life**: $0 / $30,000

## Usage

### Dashboard
- View your financial status with totals for checking, savings, and credit card accounts
- See when your accounts were last updated from imported statements
- Track progress on your savings goals with visual progress bars
- View Zcash guidance section (placeholder for future features)

### Import Statements
- Select your financial institution (Ally, Chase, Gemini, Wells Fargo, or Bilt)
- Choose account type (checking, savings, or credit card)
- Upload PDF or CSV statement files
- View import results including:
  - Number of transactions imported
  - Detected statement balance
  - Any parsing warnings or issues
- Supports automatic transaction extraction from:
  - **CSV files**: Auto-detects columns for date, description, and amount
  - **PDF files**: Extracts text and identifies transaction patterns and balances

### Settings
- Enter your total Zcash (ZEC) holdings
- Optionally add your cost basis in USD
- Save changes to update the database

## Project Structure

```
finance-app/
├── app/
│   ├── api/
│   │   ├── import/
│   │   │   └── route.ts       # API endpoint for statement import
│   │   └── zcash/
│   │       └── route.ts       # API endpoint for Zcash data
│   ├── import/
│   │   └── page.tsx           # Import statements page
│   ├── settings/
│   │   └── page.tsx           # Settings page
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout with navigation
│   └── page.tsx               # Dashboard page
├── lib/
│   ├── db.ts                  # Database configuration and initialization
│   └── parsers.ts             # CSV and PDF parsing logic
├── finance.db                 # SQLite database (created on first run)
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **better-sqlite3** - SQLite database
- **pdf-parse** - PDF text extraction
- **csv-parse** - CSV file parsing
- **React** - UI library

## Supported File Formats

### CSV Files
The importer automatically detects columns for:
- Date (looks for "date", "posted", "trans")
- Description (looks for "desc", "memo", "merchant", "payee")
- Amount (looks for "amount", "total", "debit", "credit")

If columns can't be auto-detected, it uses sensible defaults (first column for date, second for description, last for amount).

### PDF Files
The PDF parser extracts:
- **Statement Balance**: Searches for patterns like "Ending Balance", "Statement Balance", "New Balance", "Current Balance"
- **Transactions**: Identifies lines with date patterns and amounts
- **Warnings**: Provides feedback about parsing quality and any data that couldn't be extracted

Note: PDF parsing quality depends on the PDF format. Some PDFs (especially scanned documents) may be harder to parse and will show warnings.

## Future Enhancements

- Transaction viewing and filtering page
- Automatic duplicate transaction detection
- Transaction categorization and budgeting
- Integrate Zcash price API for real-time valuation
- Add charts and visualizations for spending trends
- Implement goal contribution tracking
- Support for additional statement formats
- OCR for scanned PDF statements
