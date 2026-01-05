// Shared account status utilities for consistent styling across components

export const ACCOUNT_STATUSES = [
  'New',
  'Working', 
  'Warm',
  'Hot',
  'Nurture',
  'Closed-Won',
  'Closed-Lost'
] as const;

export type AccountStatus = typeof ACCOUNT_STATUSES[number];

export const getAccountStatusColor = (status?: string | null): string => {
  switch (status) {
    case 'Hot':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'Warm':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'Working':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'Nurture':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    case 'Closed-Won':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'Closed-Lost':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    case 'New':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const COMPANY_TYPES = [
  'OEM',
  'Tier-1', 
  'Tier-2',
  'Startup',
  'Enterprise',
  'SMB',
  'Government',
  'Non-Profit',
  'Other'
] as const;

export const INDUSTRIES = [
  'Automotive',
  'Technology',
  'Manufacturing',
  'Healthcare',
  'Finance/Banking',
  'Retail',
  'Energy',
  'Aerospace',
  'Telecommunications',
  'Logistics',
  'Government',
  'Education',
  'Consulting',
  'Software',
  'Electronics',
  'Other'
] as const;

export const REGIONS = ['EU', 'US', 'ASIA', 'LATAM', 'MEA', 'Other'] as const;

export const REGION_COUNTRIES: Record<string, string[]> = {
  EU: ['Germany', 'France', 'UK', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Poland', 'Belgium', 'Austria', 'Switzerland', 'Other EU'],
  US: ['United States', 'Canada', 'Mexico'],
  ASIA: ['Japan', 'China', 'India', 'South Korea', 'Singapore', 'Taiwan', 'Thailand', 'Vietnam', 'Malaysia', 'Indonesia', 'Other Asia'],
  LATAM: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Other LATAM'],
  MEA: ['UAE', 'Saudi Arabia', 'South Africa', 'Israel', 'Turkey', 'Egypt', 'Other MEA'],
  Other: ['Other']
};
