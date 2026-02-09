export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'borrower';
export type LoanStatus = 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
export type RepaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
        };
      };
      loans: {
        Row: {
          id: string;
          borrower_id: string | null;
          lender_id: string | null;
          borrower_name: string;
          borrower_email: string;
          amount: number;
          interest_rate: number;
          frequency: RepaymentFrequency;
          status: LoanStatus;
          approved_at: string | null;
          created_at: string;
          start_date: string | null;
          notes: string;
        };
        Insert: {
          id?: string;
          borrower_id?: string | null;
          lender_id?: string | null;
          borrower_name: string;
          borrower_email: string;
          amount: number;
          interest_rate?: number;
          frequency: RepaymentFrequency;
          status?: LoanStatus;
          approved_at?: string | null;
          created_at?: string;
          start_date?: string | null;
          notes?: string;
        };
        Update: {
          id?: string;
          borrower_id?: string | null;
          lender_id?: string | null;
          borrower_name?: string;
          borrower_email?: string;
          amount?: number;
          interest_rate?: number;
          frequency?: RepaymentFrequency;
          status?: LoanStatus;
          approved_at?: string | null;
          created_at?: string;
          start_date?: string | null;
          notes?: string;
        };
      };
      repayments: {
        Row: {
          id: string;
          loan_id: string;
          due_date: string;
          amount: number;
          paid: boolean;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          loan_id: string;
          due_date: string;
          amount: number;
          paid?: boolean;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          loan_id?: string;
          due_date?: string;
          amount?: number;
          paid?: boolean;
          paid_at?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
