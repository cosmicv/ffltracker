/*
  # Remove Unused Indexes from Feedback Table

  1. Changes
    - Remove idx_feedback_created_at index (not currently needed)
    - Remove idx_feedback_status index (not currently needed)
    - Keep idx_feedback_user_id (used by RLS policies and foreign key filtering)
  
  2. Indexes on Loans Table
    - idx_loans_borrower_id and idx_loans_lender_id are kept as they improve join performance
    - These are marked as unused because they're new, but will be utilized in queries
  
  3. Important Notes
    - Indexes can be re-added in the future if query patterns require them
    - Foreign key indexes (user_id, borrower_id, lender_id) should remain for optimal performance
*/

-- Remove unused indexes from feedback table
DROP INDEX IF EXISTS idx_feedback_created_at;
DROP INDEX IF EXISTS idx_feedback_status;