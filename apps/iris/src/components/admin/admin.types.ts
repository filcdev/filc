/**
 * Shared type definitions for admin components.
 * API-derived types (InferResponseType etc.) remain co-located with their components.
 */

/** Common props shared by all admin dialog components. */
export type BaseDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/** Pagination props for paginated table components. */
export type PaginationProps = {
  limit: number;
  onPageChange: (page: number) => void;
  page: number;
  total: number;
};
