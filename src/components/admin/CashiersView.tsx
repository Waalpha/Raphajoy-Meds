import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { Users, Plus, UserCheck, Shield, Lock, X, AlertCircle } from 'lucide-react';

interface CashiersViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function CashiersView({ user, businessConfig }: CashiersViewProps) {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'cashier'>('cashier');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const colRef = collection(db, 'users');
      const snap = await getDocs(colRef);
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const u = { uid: d.id, ...d.data() } as UserProfile;
        // Do not include deleted users or the obsolete local-user-cashier
        if (u.status !== 'deleted' && u.uid !== 'local-user-cashier' && u.email !== 'cashier@barpos.com') {
          list.push(u);
        }
      });
      setUsersList(list);
    } catch (err) {
      console.warn("Using local fallback users due to permission error:", err);
      try {
        const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
        const filtered = localUsers.filter(u => u.status !== 'deleted' && u.uid !== 'local-user-cashier' && u.email !== 'cashier@barpos.com');
        setUsersList(filtered);
      } catch (e) {
        setUsersList([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !name.trim()) {
      setError('Name and email are required');
      return;
    }

    if (!editingUser && !password.trim()) {
      setError('Password is required for new accounts');
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        const updatedProfile: Partial<UserProfile> = {
          name: name.trim(),
          email: email.trim(),
          role: role
        };
        try {
          await updateDoc(doc(db, 'users', editingUser.uid), updatedProfile);
        } catch (dbErr) {
          const localUsers = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
          const idx = localUsers.findIndex((u: UserProfile) => u.uid === editingUser.uid);
          if (idx !== -1) {
            localUsers[idx] = { ...localUsers[idx], ...updatedProfile };
            localStorage.setItem('bar_pos_local_users', JSON.stringify(localUsers));
          }
        }
        await logAuditAction(user.uid, user.name, 'USER_UPDATED', `Updated account for ${name} (${email})`, editingUser.uid);
        setSuccess(`Successfully updated account for ${name}!`);
      } else {
        // Create new user profile in database
        const uid = 'user-' + Date.now();
        const newProfile: UserProfile & { password?: string } = {
          uid,
          email: email.trim(),
          name: name.trim(),
          role: role,
          password: password.trim(),
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', uid), newProfile);
        } catch (dbErr) {
          console.warn('Could not save user to Firestore directly, updating local cache:', dbErr);
        }

        const localUsers = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
        localUsers.unshift(newProfile);
        localStorage.setItem('bar_pos_local_users', JSON.stringify(localUsers));

        await logAuditAction(user.uid, user.name, 'USER_CREATED', `Created ${role} account for ${name} (${email})`, uid);
        setSuccess(`Successfully created ${role} account for ${name}!`);
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setName('');
      setEmail('');
      setPassword('');
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save user account');
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (targetUser.uid === user.uid) {
      alert("You cannot delete your own active admin account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete account for ${targetUser.name}? This action cannot be undone.`)) return;

    try {
      try {
        await deleteDoc(doc(db, 'users', targetUser.uid));
      } catch (e) {
        console.warn('Could not delete user from Firestore directly:', e);
      }

      // Always remove from local users cache
      try {
        const localUsers = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
        const filtered = localUsers.filter((u: UserProfile) => u.uid !== targetUser.uid && u.email !== targetUser.email);
        localStorage.setItem('bar_pos_local_users', JSON.stringify(filtered));
      } catch (e) {
        // ignore
      }

      await logAuditAction(user.uid, user.name, 'USER_DELETED', `Deleted user ${targetUser.name} (${targetUser.email})`, targetUser.uid);
      setSuccess(`Successfully deleted user ${targetUser.name}`);
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    const newStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    if (!window.confirm(`Are you sure you want to set ${targetUser.name} to ${newStatus}?`)) return;

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), { status: newStatus });
      await logAuditAction(user.uid, user.name, 'USER_UPDATED', `Set user ${targetUser.name} status to ${newStatus}`, targetUser.uid);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to update user status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cashier & Staff Accounts</h2>
          <p className="text-sm text-gray-500">Manage system users, login credentials, and access roles</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setName('');
            setEmail('');
            setPassword('');
            setRole('cashier');
            setError('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Create New Account</span>
        </button>
      </div>

      {success && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading user accounts...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {usersList.map(u => (
                  <tr key={u.uid} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{u.name}</td>
                    <td className="p-4 text-gray-600 font-mono text-xs">{u.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {u.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span className="capitalize">{u.role}</span>
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setName(u.name);
                            setEmail(u.email);
                            setPassword('');
                            setRole(u.role);
                            setError('');
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                        >
                          Edit
                        </button>
                        {u.uid !== user.uid && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                u.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-red-600 hover:text-white transition-all"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit Staff Account' : 'Create Staff Account'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Kamau"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. cashier@valentine.com"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin / Owner</option>
                </select>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all"
                >
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
