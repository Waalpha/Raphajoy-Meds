import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, AuditLog } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ShieldAlert, Search, Calendar } from 'lucide-react';

interface AuditLogsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function AuditLogsView({ user, businessConfig }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const colRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'auditLogs');
      const snap = await getDocs(colRef);
      const list: AuditLog[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as AuditLog);
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setLogs(list);
    } catch (err) {
      console.warn("Using local audit logs fallback due to permission error:", err);
      try {
        const localLogs = JSON.parse(localStorage.getItem('bar_pos_audit_logs') || '[]');
        setLogs(localLogs);
      } catch (e) {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(l =>
    l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Audit Logs</h2>
          <p className="text-sm text-gray-500">Immutable audit trail of important bar actions and security events</p>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, user, desc..."
            className="w-full sm:w-72 rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading audit logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">No Audit Logs Recorded</h3>
          <p className="text-sm text-gray-500 mt-1">Actions like logins, product creation, and stock additions appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">User Name</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-xs font-mono text-gray-500">{log.date} {log.time}</td>
                    <td className="p-4 font-bold text-gray-900">{log.userName}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 text-xs">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
