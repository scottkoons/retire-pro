# Private Retirement Planner App

Build a private local retirement planning app.

## Tech Stack
- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts
- Local browser storage
- Export/import JSON backup
- PDF export

No backend, database, login, cloud sync, or external APIs.

## Main Navigation
1. Dashboard
2. Planner Sheet
3. Retirement Phases
4. Year-by-Year
5. Monte Carlo
6. Plan Summary
7. Settings

## Dashboard
Editable controls:
- Retirement age slider
- Average return slider
- Starting balance editable amount
- Withdrawal rate slider
- Inflation editable amount
- Toggle: Today's Dollars / Actual Dollars

Tiles:
- Selected scenario name
- Projected balance at retirement
- Monthly income at retirement
- Annual income at retirement
- Guaranteed monthly income
- Required portfolio withdrawal
- Monte Carlo success probability
- Status: On Track / Caution / Shortfall

Chart:
- Balance over time
- Retirement marker
- Lump-sum event dots
- Hover tooltips
- Optional Monte Carlo percentile band

Buttons:
- Run Monte Carlo
- Export PDF
- Open Planner Sheet
- Open Plan Summary

## Planner Sheet

### Monthly Contributions
- Name
- Start age
- End age
- Monthly amount
- Notes
- Total contributed

### Lump Sum Events
- Name
- Age/date
- Amount
- Notes

### Income Streams
- Name
- Monthly amount in today's dollars
- Start age
- End age
- Tax status
- Inflation adjusted
- Notes

## Retirement Phases
Support retirement spending phases:
- Phase name
- Start age
- End age
- Target monthly income
- Notes

## Investment Return Phases
Support return ramp-down phases:
- Name
- Start age
- End age
- Expected return
- Volatility
- Notes

## Settings
- Current age
- Model end age (default 95)
- Inflation
- Monte Carlo simulation count
- Return volatility
- Default display mode

## Monte Carlo
Dashboard summary plus dedicated page:
- Success probability
- Percentile analysis
- Failure age analysis
- Ending balance distribution

## Year-by-Year
Columns:
- Age
- Year
- Starting balance
- Contributions
- Lump sums
- Investment growth
- Guaranteed income
- Withdrawals
- Ending balance
- Today's dollars
- Actual dollars

## Plan Summary
Printable advisor-ready PDF including:
- Assumptions
- Contributions
- Lump sums
- Income streams
- Spending phases
- Monte Carlo results

## Data Persistence
- localStorage or IndexedDB
- Auto-save
- JSON export/import
- Reset demo data

## Design
Modern financial dashboard.
Dashboard should be visual.
Planner Sheet can be spreadsheet-like.

## Notes
Use Social Security and VA inputs as today's monthly amounts.
Inflation-adjusted income streams should grow with global inflation.
Support multiple scenarios.
Changing dashboard controls should update the active scenario.
