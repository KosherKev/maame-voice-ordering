import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Check, X, ShieldAlert, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  priceInPesewas: number;
  vendorId: string;
  category: string;
  inStock: boolean;
  createdAt: string;
}

interface VendorLookup {
  id: string;
  name: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<VendorLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [priceGhs, setPriceGhs] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState(true);

  const fetchCatalogData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch products
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (prodError) throw prodError;

      // Fetch vendors for mapping IDs to names
      const { data: vendData, error: vendError } = await supabase
        .from('vendors')
        .select('id, name');
      if (vendError) throw vendError;

      setProducts(prodData || []);
      setVendors(vendData || []);

      if (vendData && vendData.length > 0) {
        setVendorId(vendData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, []);

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const priceInPesewas = Math.round(parseFloat(priceGhs) * 100);
      if (isNaN(priceInPesewas) || priceInPesewas <= 0) {
        throw new Error('Price must be a positive number');
      }

      const { error: dbError } = await supabase
        .from('products')
        .insert([{ name, priceInPesewas, vendorId, category, inStock }]);

      if (dbError) throw dbError;
      setIsAdding(false);
      resetForm();
      fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    try {
      const priceInPesewas = Math.round(parseFloat(priceGhs) * 100);
      if (isNaN(priceInPesewas) || priceInPesewas <= 0) {
        throw new Error('Price must be a positive number');
      }

      const { error: dbError } = await supabase
        .from('products')
        .update({ name, priceInPesewas, vendorId, category, inStock })
        .eq('id', id);

      if (dbError) throw dbError;
      setEditingId(null);
      resetForm();
      fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
      fetchCatalogData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setPriceGhs((product.priceInPesewas / 100).toString());
    setVendorId(product.vendorId);
    setCategory(product.category);
    setInStock(product.inStock);
  };

  const resetForm = () => {
    setName('');
    setPriceGhs('');
    setCategory('');
    setInStock(true);
    if (vendors.length > 0) {
      setVendorId(vendors[0].id);
    }
  };

  const getVendorName = (vId: string) => {
    const found = vendors.find((v) => v.id === vId);
    return found ? found.name : 'Unknown Vendor';
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Product Catalog
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Configure prices and active inventory stock details for AI order matching.
          </p>
        </div>
        {!isAdding && !editingId && vendors.length > 0 && (
          <button onClick={() => { setIsAdding(true); resetForm(); }} className="btn-primary">
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={20} color="var(--color-error)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Operations Exception:</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Add Product Panel */}
      {isAdding && (
        <div className="glass-panel" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>Add Catalog Product</h3>
          <form onSubmit={handleSaveAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Product Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" placeholder="e.g. White Maize Bag" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Price (GHS)</label>
              <input type="number" step="0.01" required value={priceGhs} onChange={(e) => setPriceGhs(e.target.value)} className="premium-input" placeholder="e.g. 150.50" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Partner Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="premium-input">
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Category</label>
              <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} className="premium-input" placeholder="e.g. Grains" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '45px' }}>
              <input type="checkbox" id="stock-checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
              <label htmlFor="stock-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item In Stock</label>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid var(--bg-tertiary)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {products.map((product) => {
            const isEditing = editingId === product.id;
            return (
              <div key={product.id} className="glass-panel" style={{ borderLeft: product.inStock ? 'none' : '4px solid var(--color-warning)' }}>
                {isEditing ? (
                  <form onSubmit={(e) => handleSaveEdit(e, product.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Product Name</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Price (GHS)</label>
                      <input type="number" step="0.01" required value={priceGhs} onChange={(e) => setPriceGhs(e.target.value)} className="premium-input" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Partner Vendor</label>
                      <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="premium-input">
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Category</label>
                      <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} className="premium-input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '45px' }}>
                      <input type="checkbox" id={`stock-${product.id}`} checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
                      <label htmlFor={`stock-${product.id}`} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>In Stock</label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn-primary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}><Check size={16} /> Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}><X size={16} /> Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {product.name}
                        {!product.inStock && <span className="badge badge-warning">Out of Stock</span>}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Price: <strong style={{ color: 'var(--accent-primary)' }}>GHS {(product.priceInPesewas / 100).toFixed(2)}</strong> • Vendor: {getVendorName(product.vendorId)} • Category: {product.category}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => startEdit(product)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--color-error)' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
