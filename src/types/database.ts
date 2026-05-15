export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'borrower' | 'master_admin';
export type LoanStatus = 'pending' | 'approved' | 'active' | 'completed' | 'rejected';
export type RepaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
export type FeedbackType = 'feature_request' | 'problem_report';
export type FeedbackStatus = 'new' | 'reviewed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          registered: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          registered?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          registered?: boolean;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          user_email: string;
          user_name: string;
          message: string;
          type: FeedbackType;
          status: FeedbackStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_email: string;
          user_name: string;
          message: string;
          type: FeedbackType;
          status?: FeedbackStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_email?: string;
          user_name?: string;
          message?: string;
          type?: FeedbackType;
          status?: FeedbackStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      email_logs: {
        Row: {
          id: string;
          email_type: string;
          recipient_email: string;
          recipient_name: string;
          loan_id: string | null;
          subject: string;
          status: string;
          provider_message_id: string | null;
          error_message: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          email_type: string;
          recipient_email: string;
          recipient_name?: string;
          loan_id?: string | null;
          subject?: string;
          status?: string;
          provider_message_id?: string | null;
          error_message?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          email_type?: string;
          recipient_email?: string;
          recipient_name?: string;
          loan_id?: string | null;
          subject?: string;
          status?: string;
          provider_message_id?: string | null;
          error_message?: string | null;
          sent_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      stripe_user_subscriptions: {
        Row: {
          user_id: string | null;
          subscription_id: string | null;
          price_id: string | null;
          current_period_start: number | null;
          current_period_end: number | null;
          cancel_at_period_end: boolean | null;
          payment_method_brand: string | null;
          payment_method_last4: string | null;
          status: string | null;
          subscription_status: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_borrower_registered: {
        Args: { borrower_email_param: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
