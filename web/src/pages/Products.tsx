import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Check, X, ShieldAlert, Trash2, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [priceGhs, setPriceGhs] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [category, setCategory] = useState('');
  const [inStock, setInStock] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
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
      </div>

      {error && (
        <div className="glass-panel" style={{ borderColor: 'var(--color-error)', background: 'rgba(239, 68, 68, 0.05)', color: '#ffffff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={20} color="var(--color-error)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Operations Exception:</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>{error}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN (~30% width) */}
        <div style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-secondary)' }}>
              <ShoppingBag size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                Total Active Products
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
                {products.filter(p => p.inStock).length}
              </span>
            </div>
          </div>

          {!editingId && vendors.length > 0 && (
            <div className="glass-panel" style={{ borderTop: '4px solid var(--accent-secondary)' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="var(--accent-secondary)" /> Add Catalog Product
              </h3>
              <form onSubmit={handleSaveAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Product Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" placeholder="e.g. White Maize Bag" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Price (GHS)</label>
                  <input type="number" step="0.01" required value={priceGhs} onChange={(e) => setPriceGhs(e.target.value)} className="premium-input" placeholder="e.g. 150.50" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Partner Vendor</label>
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="premium-input" style={{ WebkitAppearance: 'none' }}>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Category</label>
                  <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} className="premium-input" placeholder="e.g. Grains" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="checkbox" id="stock-checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="stock-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Set as In-Stock</label>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '12px' }}>
                  Add to Catalog
                </button>
              </form>
            </div>
          )}

          {!editingId && vendors.length === 0 && (
             <div className="glass-panel" style={{ color: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
               You must register at least one vendor before you can add products to the catalog.
             </div>
          )}

        </div>

        {/* RIGHT COLUMN (~70% width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid var(--bg-tertiary)',
                borderTopColor: 'var(--accent-primary)',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          ) : products.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No products available in the catalog. Use the panel on the left to add your first product.
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {currentProducts.map((product) => {
                  const isEditing = editingId === product.id;
                  return (
                    <div key={product.id} style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: product.inStock ? '4px solid var(--border-color)' : '4px solid var(--color-warning)' }}>
                      {isEditing ? (
                        <form onSubmit={(e) => handleSaveEdit(e, product.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Product Name</label>
                            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Price (GHS)</label>
                            <input type="number" step="0.01" required value={priceGhs} onChange={(e) => setPriceGhs(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Vendor</label>
                            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="premium-input" style={{ WebkitAppearance: 'none' }}>
                              {vendors.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Category</label>
                            <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} className="premium-input" />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                            <input type="checkbox" id={`stock-${product.id}`} checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
                            <label htmlFor={`stock-${product.id}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>In Stock</label>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1', marginTop: '8px' }}>
                            <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}><Check size={16} /> Save Changes</button>
                            <button type="button" onClick={cancelEdit} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}><X size={16} /> Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {product.name}
                              {product.inStock ? (
                                <span className="badge-monef-success">In Stock</span>
                              ) : (
                                <span className="badge-monef-warning">Out of Stock</span>
                              )}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>GHS {(product.priceInPesewas / 100).toFixed(2)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>|</span>
                              <span>Vendor: {getVendorName(product.vendorId)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>|</span>
                              <span>Category: {product.category}</span>
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => startEdit(product)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Edit2 size={14} /> Edit
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Pagination Footer */}
              <div className="flex-between" style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Showing {startIndex + 1}-{Math.min(endIndex, products.length)} of {products.length} products
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage === 1}
                    style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      style={{
                        width: '36px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '8px',
                        background: currentPage === page ? 'var(--accent-primary)' : 'transparent',
                        border: currentPage === page ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      {page}
                    </button>
                  ))}

                  <button 
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage === totalPages}
                    style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
