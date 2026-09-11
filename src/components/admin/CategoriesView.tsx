import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Category } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { Layers, Plus, Trash2, AlertCircle } from 'lucide-react';

interface CategoriesViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function CategoriesView({ user, businessConfig }: CategoriesViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const catRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
      const catSnap = await getDocs(catRef);
      const cats: Category[] = [];
      catSnap.forEach(d => {
        cats.push({ id: d.id, ...d.data() } as Category);
      });
      setCategories(cats);
    } catch (err) {
      try {
        const localCats = JSON.parse(localStorage.getItem('bar_pos_local_categories') || '[{"id":"cat-prescription","name":"Prescription Drugs (Rx)","description":"Antibiotics & prescription medications"},{"id":"cat-pain","name":"Analgesics & Pain Relief","description":"Pain relievers & anti-inflammatories"},{"id":"cat-cold","name":"Cold, Flu & Cough","description":"Cough syrups & cold remedies"}]');
        setCategories(localCats);
      } catch (e) {
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setError('Category name is required');
      return;
    }
    try {
      const catId = 'cat-' + Date.now();
      const newCat: Category = {
        id: catId,
        name: newCatName.trim(),
        description: newCatDesc.trim() || 'Pharmacy category'
      };
      await setDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories', catId), newCat);
      const updatedCats = [...categories, newCat];
      setCategories(updatedCats);
      localStorage.setItem('bar_pos_local_categories', JSON.stringify(updatedCats));
      await logAuditAction(user.uid, user.name, 'CATEGORY_CREATED', `Created category ${newCat.name}`, catId);
      setNewCatName('');
      setNewCatDesc('');
      setError('');
      alert(`Category "${newCat.name}" added successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (categories.length <= 1) {
      alert("You must keep at least one category.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories', cat.id));
      const updatedCats = categories.filter(c => c.id !== cat.id);
      setCategories(updatedCats);
      localStorage.setItem('bar_pos_local_categories', JSON.stringify(updatedCats));
      await logAuditAction(user.uid, user.name, 'CATEGORY_DELETED', `Deleted category ${cat.name}`, cat.id);
    } catch (err: any) {
      alert('Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
        <p className="text-sm text-gray-500">Create and manage pharmacy departments and medical product categories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Category Form Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-emerald-600">
            <Layers className="w-5 h-5" />
            <h3 className="text-lg font-bold text-gray-900">Add New Category</h3>
          </div>

          {error && (
            <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Category Name
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Antibiotics, Injectables, Surgical Supplies"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                Description
              </label>
              <textarea
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Brief description of this category..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Save Category</span>
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Existing Categories ({categories.length})</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No categories found. Create your first category on the left.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {categories.map(cat => (
                <div key={cat.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-gray-900">{cat.name}</h4>
                    <p className="text-xs text-gray-500">{cat.description || 'No description provided'}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
