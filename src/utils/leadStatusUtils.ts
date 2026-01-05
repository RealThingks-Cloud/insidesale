// Shared lead status utilities for consistent styling across components

export const LEAD_STATUSES = [
  'New',
  'Attempted',
  'Follow-up',
  'Qualified',
  'Disqualified',
  'Converted'
] as const;

export type LeadStatus = typeof LEAD_STATUSES[number];

export const getLeadStatusColor = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'new':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'attempted':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'follow-up':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'qualified':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'disqualified':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'converted':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// For dynamic status colors from database (hex color to tailwind classes)
export const getStatusColorFromHex = (hexColor?: string | null): string => {
  if (!hexColor) return 'bg-muted text-muted-foreground border-border';
  
  // Convert common hex colors to tailwind classes
  const colorMap: Record<string, string> = {
    '#3b82f6': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    '#f59e0b': 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    '#64748b': 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    '#10b981': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    '#ef4444': 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    '#6366f1': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    '#6b7280': 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  };
  
  return colorMap[hexColor.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
};

export const LEAD_SOURCES = [
  'LinkedIn',
  'Website',
  'Referral',
  'Social Media',
  'Email Campaign',
  'Cold Call',
  'Trade Show',
  'Other'
] as const;
