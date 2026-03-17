import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Mail, RefreshCw } from 'lucide-react';

interface EmailLog {
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
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  loan_invitation: 'Loan Invitation',
  payment_reminder: 'Payment Reminder',
  status_notification: 'Status Notification',
  account_statement: 'Account Statement',
};

export const EmailLogs = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed'>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['all', 'sent', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'all' ? `All (${logs.length})` : f === 'sent' ? `Sent (${sentCount})` : `Failed (${failedCount})`}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No email logs found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Error</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    {log.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {EMAIL_TYPE_LABELS[log.email_type] || log.email_type}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gray-900">{log.recipient_name}</div>
                    <div className="text-xs text-gray-500">{log.recipient_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell max-w-[200px] truncate">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.sent_at)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell max-w-[280px]">
                    {log.error_message ? (
                      <span className="text-xs text-red-600 break-words whitespace-normal block">
                        {log.error_message}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
