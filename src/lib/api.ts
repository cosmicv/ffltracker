import { Database } from '../types/database';

export type Loan = Database['public']['Tables']['loans']['Row'];
export type Repayment = Database['public']['Tables']['repayments']['Row'];
export type UserRole = 'borrower' | 'admin' | 'master_admin';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  registered: boolean;
  created_at?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  auth: {
    me: () => request<{ user: AppUser | null; profile: AppUser | null }>('/auth/me'),
    login: (email: string, password: string) =>
      request<{ user: AppUser; profile: AppUser }>('/auth/login', json('POST', { email, password })),
    signup: (email: string, password: string, fullName: string) =>
      request<{ user: AppUser; profile: AppUser }>('/auth/signup', json('POST', { email, password, fullName })),
    logout: () => request<{ success: boolean }>('/auth/logout', json('POST')),
    forgotPassword: (email: string) =>
      request<{ success: boolean; resetUrl?: string }>('/auth/forgot-password', json('POST', { email })),
    resetPassword: (token: string, password: string) =>
      request<{ success: boolean }>('/auth/reset-password', json('POST', { token, password })),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean }>('/auth/change-password', json('POST', { currentPassword, newPassword })),
  },
  loans: {
    list: () => request<Loan[]>('/loans'),
    create: (input: Partial<Loan>) => request<Loan>('/loans', json('POST', input)),
    update: (id: string, input: Partial<Loan>) => request<Loan>(`/loans/${id}`, json('PATCH', input)),
    remove: (id: string) => request<{ success: boolean }>(`/loans/${id}`, json('DELETE')),
  },
  repayments: {
    list: (loanIds: string[]) =>
      request<Repayment[]>(`/repayments?loanIds=${encodeURIComponent(loanIds.join(','))}`),
    create: (input: Partial<Repayment>) => request<Repayment>('/repayments', json('POST', input)),
    remove: (id: string) => request<{ success: boolean }>(`/repayments/${id}`, json('DELETE')),
  },
  users: {
    list: () => request<AppUser[]>('/users'),
    remove: (id: string) => request<{ success: boolean }>(`/users/${id}`, json('DELETE')),
    resendInvite: (id: string) =>
      request<{ success: boolean; error?: string }>(`/users/${id}/resend-invite`, json('POST')),
  },
  emailLogs: {
    list: () => request<Array<Record<string, string | null>>>('/email-logs'),
  },
  feedback: {
    create: (message: string, type: 'feature_request' | 'problem_report') =>
      request<{ id: string }>('/feedback', json('POST', { message, type })),
  },
  emails: {
    invite: (borrowerEmail: string, borrowerName: string) =>
      request<{ success: boolean }>('/emails/invite', json('POST', { borrowerEmail, borrowerName })),
    status: (loan: Loan, status: string) =>
      request<{ success: boolean }>('/emails/status', json('POST', {
        borrowerEmail: loan.borrower_email,
        borrowerName: loan.borrower_name,
        loanId: loan.id,
        status,
      })),
  },
};
