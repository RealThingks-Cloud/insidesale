/**
 * Table Column Alignment Utilities
 * Industry-standard alignment rules for list views:
 * - LEFT: Text fields, dates, names, links, text-based identifiers
 * - RIGHT: Monetary values, counts, percentages (for easy comparison)
 * - CENTER: Checkboxes, actions, compact status badges
 */

// Columns that should be right-aligned (numeric values for comparison)
const RIGHT_ALIGNED_COLUMNS = [
  'deal_count',
  'contact_count',
  'lead_count',
  'deal_value',
  'annual_revenue',
  'amount',
  'no_of_employees',
  'probability',
  'total_contract_value',
  'total_revenue',
  'quarterly_revenue_q1',
  'quarterly_revenue_q2',
  'quarterly_revenue_q3',
  'quarterly_revenue_q4',
  'project_duration',
];

// Columns that should be center-aligned (compact elements)
const CENTER_ALIGNED_COLUMNS = [
  'actions',
  'checkbox',
];

/**
 * Get the text alignment class for a column header
 */
export const getHeaderAlignment = (field: string): string => {
  if (CENTER_ALIGNED_COLUMNS.includes(field)) return 'text-center';
  if (RIGHT_ALIGNED_COLUMNS.includes(field)) return 'text-right';
  return 'text-left';
};

/**
 * Get the flex justify class for a column header (for flex containers)
 */
export const getHeaderJustify = (field: string): string => {
  if (CENTER_ALIGNED_COLUMNS.includes(field)) return 'justify-center';
  if (RIGHT_ALIGNED_COLUMNS.includes(field)) return 'justify-end';
  return 'justify-start';
};

/**
 * Get the text alignment class for a cell
 */
export const getCellAlignment = (field: string): string => {
  if (CENTER_ALIGNED_COLUMNS.includes(field)) return 'text-center';
  if (RIGHT_ALIGNED_COLUMNS.includes(field)) return 'text-right';
  return 'text-left';
};

/**
 * Get the empty value placeholder with proper alignment
 */
export const getEmptyValue = (field: string): string => {
  if (RIGHT_ALIGNED_COLUMNS.includes(field)) {
    return 'text-muted-foreground text-right';
  }
  if (CENTER_ALIGNED_COLUMNS.includes(field)) {
    return 'text-muted-foreground text-center';
  }
  return 'text-muted-foreground';
};

/**
 * Check if a column should be right-aligned
 */
export const isRightAligned = (field: string): boolean => {
  return RIGHT_ALIGNED_COLUMNS.includes(field);
};

/**
 * Check if a column should be center-aligned
 */
export const isCenterAligned = (field: string): boolean => {
  return CENTER_ALIGNED_COLUMNS.includes(field);
};
