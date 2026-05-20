import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Search, Plus, Edit, Trash2, Phone, Mail, Building, FileText, AlertTriangle } from 'lucide-react';
import { Supplier } from '../types';
import { useNavigate } from 'react-router-dom';

export default function Suppliers() {
  const { suppliers = [], addSupplier, updateSupplier, deleteSupplier, currentUser } = useStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser?.role === 'Cajero') {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  if (currentUser?.role === 'Cajero') {
    return null;
  }
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [suppliers, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, formData);
    } else {
      addSupplier(formData);
    }
    setShowModal(false);
    setEditingSupplier(null);
    setFormData({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const confirmDelete = (id: string) => {
    deleteSupplier(id);
    setDeleteConfirm({ isOpen: false, id: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestiona el directorio de tus proveedores
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setFormData({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center shadow-sm transition-colors font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          <span className="hidden sm:inline">Nuevo Proveedor</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {filteredSuppliers.length} proveedores registrados
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <Building className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No se encontraron proveedores</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                Busca con otro término o agrega un nuevo proveedor para comenzar.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="text-right py-4 px-6 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {supplier.name}
                          </div>
                          {supplier.notes && (
                            <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">
                              {supplier.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {supplier.contactName && (
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {supplier.contactName}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Phone className="w-3 h-3 mr-1.5" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="w-3 h-3 mr-1.5" />
                            {supplier.email}
                          </div>
                        )}
                        {!supplier.contactName && !supplier.phone && !supplier.email && (
                          <span className="text-sm text-gray-400">Sin datos</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-600 dark:text-gray-300 max-w-[200px] line-clamp-2">
                        {supplier.address || <span className="text-gray-400">Sin dirección</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors inline-flex"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, id: supplier.id })}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors inline-flex"
                        title="Eliminar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  placeholder="Ej. Distribuidora del Norte SA"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nombre del Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                    placeholder="Ej. 555-0123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  placeholder="ejemplo@proveedor.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                  placeholder="Calle, Número, Colonia, Ciudad"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Notas / Detalles Adicionales
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none"
                  placeholder="Condiciones de pago, días de entrega, etc..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end space-y-3 space-y-reverse sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Eliminar proveedor?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Esta acción no se puede deshacer. Los productos asociados a este proveedor no se eliminarán pero mantendrán el registro de este nombre de proveedor.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: '' })}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
