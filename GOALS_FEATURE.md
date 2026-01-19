# Savings Goals Integration Feature

## Overview
Connect your Ally savings accounts directly to savings goals during import. Track progress, see on-track status, and manage all your goals in one place.

## Key Features

### 1. Goal Assignment During Import
When importing an Ally savings account, you can now:
- Select from existing savings goals in a dropdown
- See goal targets next to each option
- Create a new goal on the fly without leaving the import page

**Flow:**
1. Select "Ally" as institution
2. Select "Savings" as account type
3. A third dropdown appears: "Savings Goal"
4. Choose an existing goal OR select "+ Create New Goal"
5. If creating new: enter name and target, click Create
6. Upload statement and import

### 2. Inline Goal Creation
When you select "+ Create New Goal" during import:
- Two fields appear: Goal Name and Target Amount
- Click "Create" to save the goal and auto-select it
- Or click "Cancel" to go back to the dropdown
- The new goal is immediately available for the import

### 3. Updated Dashboard Goals Display
The Savings Goals section now shows:

**For Each Goal:**
- Goal name and number of linked accounts
- Current balance (sum of all linked accounts)
- Target amount
- Progress bar (green/blue/red based on status)
- Percentage complete
- On-track status: "Complete", "Ahead", "On Track", or "Behind"
- If behind: shows how much extra per month is needed

**Format:**
```
House: $25,000.00 / $100,000 (25.0%) — On Track
2 accounts linked
```

### 4. On-Track Status Calculation
Assumes a 36-month timeline for all goals:

- **Complete**: Current ≥ Target
- **Ahead**: Saving faster than required (>10% ahead)
- **On Track**: Within ±10% of required pace
- **Behind**: Saving slower than required (>10% behind)

If behind, shows: "Need +$XXX.XX/month to catch up"

### 5. Manage Goals in Settings
New "Manage Savings Goals" section with:

**View All Goals:**
- List of all existing goals with names and targets
- Edit and Delete buttons for each goal

**Edit Goals:**
- Click "Edit" to modify name or target amount
- Click "Save" to update or "Cancel" to discard

**Delete Goals:**
- Click "Delete" with confirmation dialog
- Warns that associated accounts will be unlinked
- Accounts keep their balance, just lose the goal connection

**Create New Goals:**
- Form at bottom of section
- Enter goal name and target amount
- Click "Create Goal"
- Available immediately in import dropdown

## Database Changes

### accounts table
Added `goal_id` column (nullable integer):
- Links account to a savings_goals record
- NULL if not linked to a goal
- Foreign key constraint to savings_goals(id)

## API Endpoints

### GET /api/goals
Returns all savings goals ordered by name

### POST /api/goals
Creates a new savings goal
Body: `{ name: string, target_amount: number }`

### PUT /api/goals
Updates an existing goal
Body: `{ id: number, name: string, target_amount: number }`

### DELETE /api/goals?id={goalId}
Deletes a goal and unlinks associated accounts

## Usage Examples

### Example 1: First Time Setup
1. Go to Import page
2. Select Ally → Savings
3. Goal dropdown appears, select "+ Create New Goal"
4. Enter "House" and target "$100,000"
5. Click Create
6. Upload statement, import
7. Dashboard now shows House goal with account balance

### Example 2: Adding Another Account to Same Goal
1. Go to Import page
2. Select Ally → Savings
3. Select existing "House" goal from dropdown
4. Upload statement, import
5. Dashboard now shows House goal with combined balance from both accounts

### Example 3: Managing Goals
1. Go to Settings page
2. Scroll to "Manage Savings Goals"
3. Click "Edit" next to "House"
4. Change target from $100,000 to $120,000
5. Click "Save"
6. Dashboard immediately reflects new target

### Example 4: Deleting a Goal
1. Go to Settings page
2. Click "Delete" next to a goal
3. Confirm deletion
4. Goal removed, accounts remain but are unlinked
5. Can create a new goal with same name if desired

## Important Notes

- Only Ally savings accounts show the goal dropdown
- Checking and credit card accounts don't have goal assignment
- Goals can be created in two places: Import page or Settings page
- Deleting a goal doesn't delete the accounts, just unlinks them
- Current amount is calculated from linked account balances, not stored
- The 36-month timeline is currently fixed (can be customized later)
- On-track calculation is a rough estimate based on current balance

## Future Enhancements

- Custom timeline per goal (not just 36 months)
- Monthly contribution tracking from transaction history
- Goal progress history and charts
- Goal categories (short-term, long-term, emergency)
- Multi-account goal assignments for non-Ally banks
- Goal milestones and notifications
- Automatic monthly progress reports
