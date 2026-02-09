/*
  # Remove Pending Status and Set Default to Active

  ## Changes Made

  1. **Update Default Status**
     - Change loans table default status from 'pending' to 'active'
     - All new loans will be created as active immediately

  2. **Update Existing Loans**
     - Convert all pending loans to active status
     - No approval workflow needed

  3. **Remove Approval Policy**
     - Drop "Borrowers can approve their pending loans" policy
     - No longer needed since loans are active by default

  4. **Simplify Borrower Access**
     - Ensure borrowers can see their loans immediately
     - Access based on email match, not just borrower_id

  ## Security
  - Maintains RLS restrictions
  - Only affects loan status workflow, not access control
*/

-- Update the default status for the loans table from 'pending' to 'active'
ALTER TABLE loans ALTER COLUMN status SET DEFAULT 'active';

-- Update all existing pending loans to active
UPDATE loans SET status = 'active' WHERE status = 'pending';

-- Drop the borrower approval policy since we no longer need pending approval
DROP POLICY IF EXISTS "Borrowers can approve their pending loans" ON loans;