import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, BusinessConfig, Product, Category } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { formatCurrency, logAuditAction } from '../../lib/utils';
import { Package, Plus, Search, Edit2, Trash2, X, AlertCircle, Download, Upload, Layers } from 'lucide-react';
import { forceResetDatabaseToPharmacy } from '../../lib/dbSeeder';

interface ProductsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function ProductsView({ user, businessConfig }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catError, setCatError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    unitType: 'Bottle' as Product['unitType'],
    buyingPrice: 0,
    sellingPrice: 0,
    openingStock: 0,
    currentStock: 0,
    minStockLevel: 10
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProductsAndCategories();
  }, []);

  async function fetchProductsAndCategories() {
    try {
      const prodRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });

      const hasFood = prods.some(p => {
        const n = (p.name || '').toLowerCase();
        return n.includes('mukimo') || n.includes('chapati') || n.includes('cofee') || n.includes('chips') || n.includes('beer') || n.includes('ugali');
      });

      if (prods.length === 0 || hasFood) {
        await forceResetDatabaseToPharmacy();
        return fetchProductsAndCategories();
      }

      setProducts(prods);

      const catRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories');
      const catSnap = await getDocs(catRef);
      const cats: Category[] = [];
      catSnap.forEach(d => {
        cats.push({ id: d.id, ...d.data() } as Category);
      });
      setCategories(cats);
    } catch (err) {
      console.warn("Using local fallback products due to permission error:", err);
      try {
        let localProds = JSON.parse(localStorage.getItem('bar_pos_local_products') || '[]');
        // Check if food items present
        const hasFood = localProds.some((p: any) => {
          const n = (p.name || '').toLowerCase();
          return n.includes('mukimo') || n.includes('chapati') || n.includes('cofee') || n.includes('chips');
        });
        if (hasFood || localProds.length === 0) {
          localProds = [
            {
              id: 'prod-paracetamol',
              name: 'Paracetamol 500mg Tablets (Pack of 100)',
              categoryId: 'cat-pain',
              categoryName: 'Analgesics & Pain Relief',
              unitType: 'Pack',
              buyingPrice: 250,
              sellingPrice: 450,
              openingStock: 100,
              currentStock: 100,
              stockAdded: 0,
              minStockLevel: 15,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 'prod-ibuprofen',
              name: 'Ibuprofen 400mg Tablets (Box of 50)',
              categoryId: 'cat-pain',
              categoryName: 'Analgesics & Pain Relief',
              unitType: 'Box',
              buyingPrice: 350,
              sellingPrice: 600,
              openingStock: 80,
              currentStock: 80,
              stockAdded: 0,
              minStockLevel: 10,
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];
          localStorage.setItem('bar_pos_local_products', JSON.stringify(localProds));
        }
        const localCats = JSON.parse(localStorage.getItem('bar_pos_local_categories') || '[{"id":"cat-prescription","name":"Prescription Drugs (Rx)","description":"Antibiotics & prescription medications"},{"id":"cat-pain","name":"Analgesics & Pain Relief","description":"Pain relievers & anti-inflammatories"},{"id":"cat-cold","name":"Cold, Flu & Cough","description":"Cough syrups & cold remedies"}]');
        setProducts(localProds);
        setCategories(localCats);
      } catch (e) {
        setProducts([]);
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCatError('Category name is required');
      return;
    }
    try {
      const catId = 'cat-' + Date.now();
      const newCat: Category = {
        id: catId,
        name: newCatName.trim(),
        description: newCatDesc.trim() || 'Hotel category'
      };
      await setDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'categories', catId), newCat);
      const updatedCats = [...categories, newCat];
      setCategories(updatedCats);
      localStorage.setItem('bar_pos_local_categories', JSON.stringify(updatedCats));
      await logAuditAction(user.uid, user.name, 'CATEGORY_CREATED', `Created category ${newCat.name}`, catId);
      setNewCatName('');
      setNewCatDesc('');
      setIsCategoryModalOpen(false);
      await fetchProductsAndCategories();
    } catch (err: any) {
      setCatError(err.message || 'Failed to add category');
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
      await fetchProductsAndCategories();
    } catch (err: any) {
      alert('Failed to delete category');
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      alert("No products to export.");
      return;
    }
    const headers = ['id', 'name', 'categoryId', 'categoryName', 'unitType', 'buyingPrice', 'sellingPrice', 'openingStock', 'currentStock', 'minStockLevel'];
    const csvRows = [headers.join(',')];

    products.forEach(p => {
      const row = [
        p.id,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.categoryId || 'cat-beer',
        `"${(p.categoryName || 'Beers').replace(/"/g, '""')}"`,
        p.unitType || 'Bottle',
        p.buyingPrice || 0,
        p.sellingPrice || 0,
        p.openingStock || 0,
        p.currentStock || 0,
        p.minStockLevel || 10
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          alert("Invalid CSV file format. Must contain header and product rows.");
          return;
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const nameIdx = header.indexOf('name');
        const catIdIdx = header.indexOf('categoryId');
        const catNameIdx = header.indexOf('categoryName');
        const unitIdx = header.indexOf('unitType');
        const buyIdx = header.indexOf('buyingPrice');
        const sellIdx = header.indexOf('sellingPrice');
        const stockIdx = header.indexOf('openingStock');
        const minIdx = header.indexOf('minStockLevel');

        if (nameIdx === -1 || sellIdx === -1) {
          alert("CSV must at least have 'name' and 'sellingPrice' columns.");
          return;
        }

        let importedCount = 0;
        const newProds = [...products];
        const now = new Date().toISOString();

        for (let i = 1; i < lines.length; i++) {
          const rowLine = lines[i];
          // Robust CSV line parser handling commas inside quotes and missing fields
          const cleanRow: string[] = [];
          let currentVal = '';
          let inQuotes = false;
          for (let c = 0; c < rowLine.length; c++) {
            const char = rowLine[c];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cleanRow.push(currentVal.trim().replace(/^"|"$/g, ''));
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          cleanRow.push(currentVal.trim().replace(/^"|"$/g, ''));

          const name = (nameIdx !== -1 && cleanRow[nameIdx]) ? cleanRow[nameIdx] : `Product ${i}`;
          const categoryId = (catIdIdx !== -1 && cleanRow[catIdIdx]) ? cleanRow[catIdIdx] : categories[0]?.id || 'cat-beer';
          const categoryName = (catNameIdx !== -1 && cleanRow[catNameIdx]) ? cleanRow[catNameIdx] : 'Beers';
          const unitType = (unitIdx !== -1 && cleanRow[unitIdx]) ? cleanRow[unitIdx] as Product['unitType'] : 'Bottle';
          const buyingPrice = (buyIdx !== -1 && !isNaN(Number(cleanRow[buyIdx]))) ? Number(cleanRow[buyIdx]) : 150;
          const sellingPrice = (sellIdx !== -1 && !isNaN(Number(cleanRow[sellIdx]))) ? Number(cleanRow[sellIdx]) : 250;
          const openingStock = (stockIdx !== -1 && !isNaN(Number(cleanRow[stockIdx]))) ? Number(cleanRow[stockIdx]) : 50;
          const minStockLevel = (minIdx !== -1 && !isNaN(Number(cleanRow[minIdx]))) ? Number(cleanRow[minIdx]) : 10;

          const productId = 'prod-' + Date.now() + '-' + i;
          const newProd: Product = {
            id: productId,
            name,
            categoryId,
            categoryName,
            unitType: ['Bottle', 'Cans', 'Tot', 'Pint', 'Pitcher', 'Glass', 'Packet', 'Piece'].includes(unitType) ? unitType : 'Bottle',
            buyingPrice,
            sellingPrice,
            openingStock,
            currentStock: openingStock,
            stockAdded: 0,
            minStockLevel,
            status: 'active',
            createdAt: now,
            updatedAt: now
          };

          try {
            await setDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', productId), newProd);
          } catch (err) {
            // Firestore permission fallback
          }
          newProds.unshift(newProd);
          importedCount++;
        }

        setProducts(newProds);
        localStorage.setItem('bar_pos_local_products', JSON.stringify(newProds));
        await logAuditAction(user.uid, user.name, 'PRODUCTS_IMPORTED', `Imported ${importedCount} products via CSV`);
        alert(`Successfully imported ${importedCount} products!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchProductsAndCategories();
      } catch (err: any) {
        console.error(err);
        alert('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteAllProducts = async () => {
    if (products.length === 0) return;
    setIsDeletingAll(true);
    try {
      // Delete all products from Firestore
      for (const p of products) {
        try {
          await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', p.id));
        } catch (err) {
          console.warn(`Could not delete product ${p.id} from Firestore`, err);
        }
      }
      setProducts([]);
      localStorage.setItem('bar_pos_local_products', JSON.stringify([]));
      await logAuditAction(user.uid, user.name, 'PRODUCTS_DELETED_ALL', `Deleted all ${products.length} products from catalog`);
      setIsDeleteAllModalOpen(false);
      setDeleteAllConfirmText('');
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete all products: ' + err.message);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      categoryId: categories[0]?.id || 'cat-beer',
      unitType: 'Bottle',
      buyingPrice: 150,
      sellingPrice: 250,
      openingStock: 50,
      currentStock: 50,
      minStockLevel: 10
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      categoryId: product.categoryId,
      unitType: product.unitType,
      buyingPrice: product.buyingPrice || 0,
      sellingPrice: product.sellingPrice,
      openingStock: product.openingStock || 0,
      currentStock: product.currentStock || 0,
      minStockLevel: product.minStockLevel
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Product name is required');
      return;
    }

    try {
      const cat = categories.find(c => c.id === formData.categoryId);
      const categoryName = cat ? cat.name : 'General';
      const now = new Date().toISOString();

      if (editingProduct) {
        // Edit
        const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', editingProduct.id);
        const updatedData = {
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          categoryName,
          unitType: formData.unitType,
          buyingPrice: Number(formData.buyingPrice),
          sellingPrice: Number(formData.sellingPrice),
          openingStock: Number(formData.openingStock),
          currentStock: Number(formData.currentStock),
          minStockLevel: Number(formData.minStockLevel),
          updatedAt: now
        };
        await updateDoc(prodRef, updatedData);
        await logAuditAction(user.uid, user.name, 'PRODUCT_EDITED', `Updated product ${formData.name}`, editingProduct.id);
      } else {
        // Create
        const productId = 'prod-' + Date.now();
        const newProduct: Product = {
          id: productId,
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          categoryName,
          unitType: formData.unitType,
          buyingPrice: Number(formData.buyingPrice),
          sellingPrice: Number(formData.sellingPrice),
          openingStock: Number(formData.openingStock),
          currentStock: Number(formData.openingStock),
          stockAdded: 0,
          minStockLevel: Number(formData.minStockLevel),
          status: 'active',
          createdAt: now,
          updatedAt: now
        };
        const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', productId);
        await setDoc(prodRef, newProduct);
        await logAuditAction(user.uid, user.name, 'PRODUCT_CREATED', `Created product ${formData.name}`, productId);
      }

      setIsModalOpen(false);
      await fetchProductsAndCategories();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.name}?`)) return;

    try {
      await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', product.id));
      await logAuditAction(user.uid, user.name, 'PRODUCT_DELETED', `Deleted product ${product.name}`, product.id);
      await fetchProductsAndCategories();
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete product');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const currency = businessConfig?.currency || 'KSh';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-sm text-gray-500">Create, edit, and configure pharmacy products & pricing or bulk import/export</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all active:scale-95"
            title="Import Products from CSV"
          >
            <Upload className="w-4 h-4 text-gray-500" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-2 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all active:scale-95"
            title="Export Products to CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              setCatError('');
              setNewCatName('');
              setNewCatDesc('');
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center space-x-2 rounded-2xl bg-white border border-gray-300 hover:bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all active:scale-95"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={() => {
              setDeleteAllConfirmText('');
              setIsDeleteAllModalOpen(true);
            }}
            disabled={products.length === 0}
            className="inline-flex items-center space-x-2 rounded-2xl bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-red-600 shadow-sm transition-all active:scale-95"
            title="Delete All Products"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Delete All</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Product</span>
          </button>
          <button
            onClick={async () => {
              if (window.confirm('Reset and reload all default pharmacy products and categories?')) {
                await forceResetDatabaseToPharmacy();
                await fetchProductsAndCategories();
              }
            }}
            className="inline-flex items-center space-x-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            title="Reset to default pharmacy products"
          >
            <span>Reload Pharmacy Catalog</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading products...</div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4 text-right">Selling Price</th>
                  <th className="p-4 text-center">Opening Stock</th>
                  <th className="p-4 text-center">Current Stock</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{product.name}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {product.categoryName}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{product.unitType}</td>
                    <td className="p-4 text-right font-black text-emerald-700">
                      {formatCurrency(product.sellingPrice, currency)}
                    </td>
                    <td className="p-4 text-center font-medium text-gray-700">{product.openingStock}</td>
                    <td className="p-4 text-center font-bold text-gray-900">{product.currentStock}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(product)}
                        className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Create New Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Paracetamol 500mg (Pack of 100)"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Category
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Unit Type
                  </label>
                  <select
                    value={formData.unitType}
                    onChange={(e) => setFormData({ ...formData, unitType: e.target.value as any })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 bg-white"
                  >
                    <option value="Pack">Pack</option>
                    <option value="Box">Box</option>
                    <option value="Strip">Strip</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Tube">Tube (Ointment/Cream)</option>
                    <option value="Vial">Vial (Injection)</option>
                    <option value="Sachet">Sachet</option>
                    <option value="Piece">Piece / Unit</option>
                    <option value="Roll">Roll (Bandage)</option>
                    <option value="Set">Set / Kit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Buying Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.buyingPrice}
                    onChange={(e) => setFormData({ ...formData, buyingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Selling Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
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

      {/* Delete All Confirmation Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-2.5 text-red-600">
                <div className="rounded-full bg-red-100 p-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Delete All Products</h3>
              </div>
              <button
                onClick={() => {
                  if (!isDeletingAll) {
                    setIsDeleteAllModalOpen(false);
                    setDeleteAllConfirmText('');
                  }
                }}
                disabled={isDeletingAll}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold">Caution: Destructive Action</p>
              <p>
                This will permanently remove <strong>all {products.length} products</strong>, stock counts, and pricing configurations from both the database and local storage. This action cannot be reversed.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                To confirm, please type <span className="font-mono font-bold text-red-600">DELETE</span> below:
              </label>
              <input
                type="text"
                disabled={isDeletingAll}
                value={deleteAllConfirmText}
                onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <div className="pt-2 flex space-x-3">
              <button
                type="button"
                onClick={handleDeleteAllProducts}
                disabled={deleteAllConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAll}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-bold text-white shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAll ? 'Deleting Products...' : 'Yes, Delete All'}</span>
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={() => {
                  setIsDeleteAllModalOpen(false);
                  setDeleteAllConfirmText('');
                }}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-gray-900">Manage Categories</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {catError && (
              <div className="flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{catError}</span>
              </div>
            )}

            {/* Add Category Form */}
            <form onSubmit={handleAddCategory} className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-800">Add New Category</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Conference Rooms"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="e.g. Meeting & event halls"
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-800">Existing Categories ({categories.length})</h4>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
                {categories.map(cat => (
                  <div key={cat.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500">{cat.description || 'No description'}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-xl bg-gray-900 hover:bg-gray-800 px-5 py-2.5 text-sm font-bold text-white transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
