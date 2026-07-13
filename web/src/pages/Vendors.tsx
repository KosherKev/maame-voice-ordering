import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Check, X, ShieldAlert, Trash2, Users, ChevronLeft, ChevronRight, Phone } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  phone: string;
  momoChannel: 'mtn' | 'telecel' | 'at';
  active: boolean;
  createdAt: string;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [momoChannel, setMomoChannel] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [active, setActive] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });

      if (dbError) throw dbError;
      setVendors(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .insert([{ name, phone, momoChannel, active }]);

      if (dbError) throw dbError;
      resetForm();
      fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to save vendor');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .update({ name, phone, momoChannel, active })
        .eq('id', id);

      if (dbError) throw dbError;
      setEditingId(null);
      resetForm();
      fetchVendors();
    } catch (err: any) {
      setError(err.message || 'Failed to update vendor');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor? If they have order history, this deletion will be blocked.')) {
      return;
    }
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);

      if (dbError) {
        if (dbError.message && dbError.message.includes('trigger')) {
          setError('This vendor has order history and cannot be deleted. Deactivate them instead to soft-delete.');
        } else {
          throw dbError;
        }
      } else {
        fetchVendors();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete vendor');
    }
  };

  const startEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setName(vendor.name);
    setPhone(vendor.phone);
    setMomoChannel(vendor.momoChannel);
    setActive(vendor.active);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const totalPages = Math.ceil(vendors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVendors = vendors.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setMomoChannel('mtn');
    setActive(true);
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Vendor Registries
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Configure and register momo disbursement accounts for partner vendors.
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
            <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-primary)' }}>
              <Users size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                Total Active Vendors
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
                {vendors.filter(v => v.active).length}
              </span>
            </div>
          </div>

          {!editingId && (
            <div className="glass-panel" style={{ borderTop: '4px solid var(--accent-primary)' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="var(--accent-primary)" /> Register New Vendor
              </h3>
              <form onSubmit={handleSaveAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Vendor Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" placeholder="e.g. Ama Goods Store" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Momo Phone</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" placeholder="e.g. 0541112222" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Network Channel</label>
                  <select value={momoChannel} onChange={(e) => setMomoChannel(e.target.value as any)} className="premium-input" style={{ WebkitAppearance: 'none' }}>
                    <option value="mtn">MTN Mobile Money</option>
                    <option value="telecel">Telecel Cash</option>
                    <option value="at">AT Money</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input type="checkbox" id="active-checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                  <label htmlFor="active-checkbox" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Set as Active immediately</label>
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px', padding: '12px' }}>
                  Create Vendor Profile
                </button>
              </form>
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
          ) : vendors.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No vendors registered yet. Use the panel on the left to add your first vendor.
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {currentVendors.map((vendor) => {
                  const isEditing = editingId === vendor.id;
                  return (
                    <div key={vendor.id} style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: vendor.active ? '4px solid var(--accent-primary)' : '4px solid var(--color-error)' }}>
                      {isEditing ? (
                        <form onSubmit={(e) => handleSaveEdit(e, vendor.id)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Name</label>
                            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Momo Phone</label>
                            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="premium-input" />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Network</label>
                            <select value={momoChannel} onChange={(e) => setMomoChannel(e.target.value as any)} className="premium-input" style={{ WebkitAppearance: 'none' }}>
                              <option value="mtn">MTN</option>
                              <option value="telecel">Telecel</option>
                              <option value="at">AT</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                            <input type="checkbox" id={`active-${vendor.id}`} checked={active} onChange={(e) => setActive(e.target.checked)} />
                            <label htmlFor={`active-${vendor.id}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Active</label>
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
                              {vendor.name}
                              {vendor.active ? (
                                <span className="badge-monef-success">Active</span>
                              ) : (
                                <span className="badge-monef-error">Deactivated</span>
                              )}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} /> {vendor.phone}</span>
                              <span style={{ color: 'var(--text-muted)' }}>|</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ 
                                  display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', 
                                  background: vendor.momoChannel === 'mtn' ? '#facc15' : vendor.momoChannel === 'telecel' ? '#ef4444' : '#3b82f6' 
                                }} />
                                <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{vendor.momoChannel}</span>
                              </span>
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => startEdit(vendor)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Edit2 size={14} /> Edit
                            </button>
                            <button onClick={() => handleDelete(vendor.id)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-error)' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}>
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
                  Showing {startIndex + 1}-{Math.min(endIndex, vendors.length)} of {vendors.length} vendors
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
