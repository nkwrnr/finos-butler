# Statement Import Feature

## Overview
The statement import feature allows you to upload PDF or CSV bank statements and automatically extract transactions and balances.

## How It Works

### 1. Import Page ([/import](http://localhost:3000/import))
- Select your financial institution from the dropdown
- Choose account type (checking, savings, or credit_card)
- Upload a PDF or CSV file
- Click "Import Statement"

### 2. File Processing

#### CSV Files
The parser:
- Auto-detects columns for date, description, and amount
- Handles various date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
- Parses amounts with or without $ signs, commas, and parentheses
- Creates warnings for any rows that can't be parsed

#### PDF Files
The parser:
- Extracts text from the PDF
- Searches for balance keywords ("Ending Balance", "Statement Balance", etc.)
- Identifies transaction lines by looking for date and amount patterns
- Provides detailed warnings about parsing quality

### 3. Results Display
After import, you'll see:
- ✅ Number of transactions imported
- 💰 Detected statement balance (if found)
- ⚠️ Any warnings about data that couldn't be parsed
- 🆕 Whether a new account was created

### 4. Dashboard Update
The dashboard automatically displays:
- Total checking account balances
- Total savings account balances
- Total credit card balances
- Last updated date from your most recent statement

## Supported Institutions
- Ally
- Chase
- Gemini
- Wells Fargo
- Bilt

## Account Types
- Checking
- Savings
- Credit Card

## Error Handling

The import system is designed to be forgiving:
- If a CSV column can't be detected, it uses sensible defaults
- If a PDF is hard to parse, it shows what was extracted and warns about missing data
- Invalid transactions are skipped with warnings
- The import will complete successfully even if some data couldn't be parsed

## Database Storage

### Accounts
When you import a statement, the system:
1. Looks for an existing account matching the institution and type
2. Creates a new account if none exists
3. Updates the balance and last_updated timestamp

### Transactions
Each transaction is stored with:
- `account_id` - Links to the parent account
- `date` - Transaction date from the statement
- `description` - Transaction description/merchant
- `amount` - Transaction amount (positive or negative)
- `category` - Optional category (currently null, for future use)

## Tips for Best Results

### CSV Files
- Use files directly from your bank (don't modify them)
- Ensure the file has a header row
- The parser works best with standard formats

### PDF Files
- Text-based PDFs work better than scanned images
- Clean, well-formatted statements produce better results
- If transactions aren't extracted, check the warnings for details

## Testing the Feature

1. Start the dev server (it should already be running at http://localhost:3000)
2. Navigate to "Import" in the navigation
3. Select an institution and account type
4. Upload a test CSV or PDF
5. Review the import results
6. Check the Dashboard to see updated balances

## Example CSV Format

```csv
Date,Description,Amount
01/15/2024,Coffee Shop,-4.50
01/16/2024,Paycheck,1500.00
01/17/2024,Gas Station,-45.00
```

The parser will automatically detect these columns and import the transactions.
