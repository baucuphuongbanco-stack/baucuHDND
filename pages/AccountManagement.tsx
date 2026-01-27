
import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AN_PHU_LOCATIONS, NEIGHBORHOODS } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { createLog } from '../lib/logger';

/**
 * COMPONENT: AccountManagement
 * 
 * Mục đích: Quản lý người dùng (CRUD), phân quyền chi tiết (RBAC) và kiểm soát trạng thái tài khoản.
 * 
 * Logic bảo mật:
 * - Soft Delete: Chỉ đánh dấu 'deleted', không xóa vật lý.
 * - Self-Lock/Delete Protection: Không cho phép thao tác trên tài khoản đang đăng nhập.
 * - Scope Enforcement: Vai trò 'Tổ bầu cử' bắt buộc phải có Unit và Area.
 */

interface AccountManagementProps {
  isLargeText?: boolean;
}

// --- CONSTANTS & TYPES ---

type RoleType = 'super_admin' | 'ban_chi_dao' | 'to_bau_cu' | 'nhap_lieu' | 'giam_sat' | 'khach';
type ActionType = 'view' | 'add' | 'edit' | 'delete' | 'confirm' | 'lock';
type ModuleType = 'dashboard' | 'voters' | 'candidates' | 'data_entry' | 'calculation' | 'reports' | 'accounts' | 'logs';

interface PermissionMatrix {
  [module: string]: ActionType[];
}

interface Account {
  id: string;
  name: string;
  username: string;
  role: RoleType;
  unitId?: string;
  areaId?: string;
  neighborhoodId?: string;
  status: 'active' | 'locked' | 'pending' | 'deleted';
  lastActive?: string;
  phone?: string;
  permissions: PermissionMatrix;
}

// Danh sách Role chuẩn hóa theo yêu cầu
const ROLES: { code: RoleType; label: string; color: string; desc: string }[] = [
  { code: 'super_admin', label: 'Super Admin (TP/Quận)', color: 'bg-purple-100 text-purple-700 border-purple-200', desc: 'Toàn quyền hệ thống, quản lý tài khoản.' },
  { code: 'ban_chi_dao', label: 'Ban Chỉ Đạo Phường', color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Xem toàn phường, không được xóa Admin.' },
  { code: 'to_bau_cu', label: 'Tổ Bầu Cử / KVBP', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Chỉ truy cập dữ liệu KVBP được phân công.' },
  { code: 'nhap_lieu', label: 'Nhập Liệu', color: 'bg-slate-100 text-slate-700 border-slate-200', desc: 'Chỉ nhập kết quả, không truy cập phân quyền.' },
  { code: 'giam_sat', label: 'Giám Sát', color: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Chỉ xem dữ liệu, truy xuất Audit Log.' },
];

const MODULES: { code: ModuleType; label: string }[] = [
  { code: 'dashboard', label: 'Dashboard & Thống kê' },
  { code: 'voters', label: 'Quản lý Cử tri' },
  { code: 'candidates', label: 'Hồ sơ Ứng cử viên' },
  { code: 'data_entry', label: 'Nhập liệu Kết quả' },
  { code: 'calculation', label: 'Tổng hợp & Phân bổ' },
  { code: 'reports', label: 'Hồ sơ & Mẫu biểu' },
  { code: 'accounts', label: 'Phân quyền hệ thống' },
  { code: 'logs', label: 'Nhật ký Audit Log' },
];

const ACTIONS: { code: ActionType; label: string; icon: string }[] = [
  { code: 'view', label: 'Xem', icon: 'visibility' },
  { code: 'add', label: 'Thêm', icon: 'add' },
  { code: 'edit', label: 'Sửa', icon: 'edit' },
  { code: 'delete', label: 'Xóa', icon: 'delete' },
  { code: 'confirm', label: 'Xác nhận', icon: 'check_circle' },
  { code: 'lock', label: 'Khóa sổ', icon: 'lock' },
];

const DEFAULT_PERMISSIONS: Record<RoleType, PermissionMatrix> = {
  super_admin: MODULES.reduce((acc, m) => ({ ...acc, [m.code]: ACTIONS.map(a => a.code) }), {}),
  ban_chi_dao: MODULES.reduce((acc, m) => ({ ...acc, [m.code]: ['view'] }), { reports: ['view'] }),
  to_bau_cu: {
    dashboard: ['view'], voters: ['view', 'edit'], candidates: ['view'],
    data_entry: ['view', 'add', 'edit', 'confirm'], reports: ['view', 'add'], accounts: [], logs: [], calculation: []
  },
  nhap_lieu: {
    data_entry: ['view', 'add', 'edit'], dashboard: ['view'], voters: [], candidates: [], calculation: [], reports: [], accounts: [], logs: []
  },
  giam_sat: MODULES.reduce((acc, m) => ({ ...acc, [m.code]: ['view'] }), { logs: ['view'] }),
  khach: { dashboard: ['view'], reports: ['view'], voters: [], candidates: [], data_entry: [], calculation: [], accounts: [], logs: [] }
};

// --- ZOD SCHEMA ---
const createAccountSchema = (isEdit: boolean) => z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự").transform(val => val.toUpperCase()),
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự").regex(/^[a-zA-Z0-9_]+$/, "Chỉ chấp nhận chữ cái, số và dấu gạch dưới").transform(val => val.toLowerCase()),
  password: z.string().optional().refine(val => isEdit || (val && val.length >= 6), {
    message: "Mật khẩu bắt buộc và tối thiểu 6 ký tự khi tạo mới"
  }),
  phone: z.string().regex(/^(0|\+84)\d{9,10}$/, "Số điện thoại không hợp lệ").optional().or(z.literal('')),
  status: z.enum(['active', 'locked', 'pending', 'deleted']),
  role: z.string(),
  unitId: z.string().optional(),
  areaId: z.string().optional(),
  neighborhoodId: z.string().optional(),
  permissions: z.record(z.string(), z.array(z.string())), // JSONB structure
  terms: z.boolean().refine(val => val === true, {
    message: "Bạn phải cam kết thông tin là chính xác"
  }),
}).refine(data => {
  // Validate điều kiện: Tổ bầu cử phải có Unit và Area
  if (data.role === 'to_bau_cu') {
    return !!data.unitId && !!data.areaId;
  }
  return true;
}, {
  message: "Tổ Bầu Cử bắt buộc phải được gán vào Đơn vị và Khu vực bỏ phiếu",
  path: ["areaId"], // Highlight lỗi ở trường areaId
});

type AccountFormValues = z.infer<ReturnType<typeof createAccountSchema>>;

export const AccountManagement: React.FC<AccountManagementProps> = ({ isLargeText }) => {
  // --- STATE ---
  const { user, profile } = useAuth(); // Lấy thông tin user hiện tại để tránh tự xóa/khóa
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<RoleType | 'all'>('all');
  const [filterDeleted, setFilterDeleted] = useState(false); // Filter soft-deleted items
  const [searchTerm, setSearchTerm] = useState('');

  // --- REACT HOOK FORM ---
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid, isSubmitting }
  } = useForm<any>({
    resolver: zodResolver(createAccountSchema(!!editModeId)),
    mode: 'onChange',
    defaultValues: {
      status: 'active',
      role: 'to_bau_cu',
      permissions: DEFAULT_PERMISSIONS.to_bau_cu,
      terms: false,
    }
  });

  // Watch values
  const watchedRole = watch('role');
  const watchedUnitId = watch('unitId');
  const watchedPermissions = watch('permissions');

  // --- FETCH DATA ---
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;

      if (data) {
        const sortedData = data.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        const mappedAccounts: Account[] = sortedData.map((item: any) => ({
          id: item.id,
          name: item.full_name || '',
          username: item.username || '',
          role: item.role as RoleType,
          unitId: item.unit_id,
          areaId: item.area_id,
          neighborhoodId: item.neighborhood_id,
          status: item.status,
          phone: item.phone,
          lastActive: item.last_active ? new Date(item.last_active).toLocaleString('vi-VN') : 'Chưa đăng nhập',
          permissions: item.permissions || DEFAULT_PERMISSIONS[item.role as RoleType] || {}
        }));
        setAccounts(mappedAccounts);
      }
    } catch (err: any) {
      console.error('Fetch Accounts Error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- MEMOIZED DATA ---
  const units = useMemo(() => AN_PHU_LOCATIONS.filter(l => l.type === 'unit'), []);
  const areas = useMemo(() => {
    if (!watchedUnitId) return [];
    return AN_PHU_LOCATIONS.filter(l => l.type === 'area' && l.parentId === watchedUnitId);
  }, [watchedUnitId]);

  // --- HANDLERS ---
  const handleOpenModal = (acc?: Account) => {
    if (acc) {
      setEditModeId(acc.id);
      reset({
        id: acc.id,
        name: acc.name,
        username: acc.username,
        role: acc.role,
        status: acc.status,
        phone: acc.phone || '',
        unitId: acc.unitId || '',
        areaId: acc.areaId || '',
        neighborhoodId: acc.neighborhoodId || '',
        permissions: acc.permissions || DEFAULT_PERMISSIONS[acc.role],
        password: '', // Password rỗng khi edit
        terms: false // Reset terms
      });
    } else {
      setEditModeId(null);
      reset({
        name: '',
        username: '',
        role: 'to_bau_cu',
        status: 'active', // Mặc định Active
        password: '',
        unitId: '',
        areaId: '',
        neighborhoodId: '',
        phone: '',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS.to_bau_cu)),
        terms: false
      });
    }
    setIsModalOpen(true);
  };


  const onSubmit = async (data: AccountFormValues) => {
    try {
      if (editModeId) {
        // UPDATE
        const { error } = await supabase.rpc('update_system_user', {
          p_user_id: editModeId,
          p_full_name: data.name,
          p_role: data.role,
          p_password: data.password || null,
          p_unit_id: data.unitId || null,
          p_area_id: data.areaId || null,
          p_neighborhood_id: data.neighborhoodId || null,
          p_phone: data.phone || null,
          p_permissions: data.permissions as any,
          p_status: data.status
        });
        if (error) throw error;
        alert('Cập nhật thông tin tài khoản thành công!');
      } else {
        // CREATE
        const autoEmail = `${data.username}@anphu.gov.vn`;
        const { error } = await supabase.rpc('create_system_user', {
          p_email: autoEmail,
          p_password: data.password,
          p_username: data.username,
          p_full_name: data.name,
          p_role: data.role,
          p_unit_id: data.unitId || null,
          p_area_id: data.areaId || null,
          p_neighborhood_id: data.neighborhoodId || null,
          p_phone: data.phone || null,
          p_permissions: data.permissions as any
        });
        if (error) throw error;
        alert(`Tạo tài khoản thành công!\n---------------------------\nTên đăng nhập: ${data.username}\nEmail: ${autoEmail}\nMật khẩu: ${data.password}\n---------------------------\nVui lòng lưu lại thông tin này.`);

        // LOGGING
        createLog({
          userName: profile?.fullName || profile?.role,
          action: 'TẠO TÀI KHOẢN',
          details: `Tạo tài khoản mới: ${data.username} (${data.role})`,
          status: 'success'
        });
      }
      setIsModalOpen(false);
      fetchAccounts();

      if (editModeId) {
        // LOGGING UPDATE
        createLog({
          userName: profile?.fullName || profile?.role,
          action: 'CẬP NHẬT TÀI KHOẢN',
          details: `Cập nhật tài khoản: ${data.username}`,
          status: 'success'
        });
      }
    } catch (err: any) {
      console.error('Submit Error:', err);
      const errorMsg = err.message || JSON.stringify(err);
      alert('Lỗi xử lý: ' + errorMsg);
    }
  };

  const handleRoleChange = (newRole: string) => {
    setValue('role', newRole);
    // Reset permissions to default for that role
    setValue('permissions', JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS[newRole as RoleType])));
  };

  const togglePermission = (module: string, action: ActionType) => {
    const currentPerms = watchedPermissions || {};
    const modulePerms = currentPerms[module] || [];
    let newModulePerms;
    if (modulePerms.includes(action)) {
      newModulePerms = modulePerms.filter(a => a !== action);
    } else {
      newModulePerms = [...modulePerms, action];
    }
    setValue(`permissions.${module}`, newModulePerms, { shouldDirty: true });
  };

  // --- DELETE & LOCK HANDLERS ---
  const handleToggleStatus = async (id: string, currentStatus: string) => {
    if (id === user?.id) {
      alert('Không thể tự khóa tài khoản của chính mình.');
      return;
    }
    const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
    if (window.confirm(`Xác nhận ${newStatus === 'locked' ? 'KHÓA' : 'MỞ KHÓA'} tài khoản này?\nNgười dùng sẽ ${newStatus === 'locked' ? 'không thể' : 'có thể'} đăng nhập.`)) {
      try {
        const { error } = await supabase.rpc('update_system_user', {
          p_user_id: id,
          p_full_name: accounts.find(a => a.id === id)?.name,
          p_role: accounts.find(a => a.id === id)?.role,
          p_status: newStatus
        });
        if (error) throw error;
        fetchAccounts();

        // LOGGING
        createLog({
          userName: profile?.fullName || profile?.role,
          action: newStatus === 'locked' ? 'KHÓA TÀI KHOẢN' : 'MỞ KHÓA TÀI KHOẢN',
          details: `${newStatus === 'locked' ? 'Khóa' : 'Mở khóa'} tài khoản: ${accounts.find(a => a.id === id)?.username}`,
          status: 'success'
        });
      } catch (err: any) {
        alert('Lỗi: ' + err.message);
      }
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (id === user?.id) {
      alert('Không thể tự xóa tài khoản của chính mình.');
      return;
    }
    if (window.confirm(`CẢNH BÁO: Xóa tài khoản "${name}"?\n\nTài khoản này sẽ bị vô hiệu hóa vĩnh viễn (Soft Delete) và không thể đăng nhập lại.`)) {
      try {
        const { error } = await supabase.rpc('delete_system_user', { p_user_id: id });
        if (error) throw error;
        alert('Đã xóa tài khoản thành công.');
        fetchAccounts();

        // LOGGING
        createLog({
          userName: profile?.fullName || profile?.role,
          action: 'XÓA TÀI KHOẢN',
          details: `Xóa (soft-delete) tài khoản: ${name}`,
          status: 'success'
        });
      } catch (err: any) {
        alert('Lỗi: ' + err.message);
      }
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchRole = filterRole === 'all' || acc.role === filterRole;
    const matchSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || acc.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDeleted = filterDeleted ? true : acc.status !== 'deleted'; // Hide deleted by default
    return matchRole && matchSearch && matchDeleted;
  });

  return (
    <div className={`space-y-8 pb-32 animate-in fade-in duration-300 ${isLargeText ? 'text-lg' : 'text-base'}`}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-primary pb-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
            Phân Quyền & Tài Khoản
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-2 uppercase tracking-widest">
            Quản trị truy cập hệ thống bầu cử Phường An Phú
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/30 hover:bg-blue-800 transition-all"
        >
          <span className="material-symbols-outlined text-xl">person_add</span>
          Thêm tài khoản mới
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tìm kiếm</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Nhập tên, username..."
              className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
        <div className="w-full md:w-64 space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lọc theo Vai trò</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="all">Tất cả vai trò</option>
            {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex items-center pb-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500 hover:text-primary transition-colors">
            <input
              type="checkbox"
              checked={filterDeleted}
              onChange={e => setFilterDeleted(e.target.checked)}
              className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Hiện tài khoản đã xóa
          </label>
        </div>
      </div>

      {/* ACCOUNT LIST TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-200 dark:border-slate-700">
                <th className="px-8 py-5">Thông tin tài khoản</th>
                <th className="px-8 py-5">Vai trò hệ thống</th>
                <th className="px-8 py-5">Phạm vi quản lý</th>
                <th className="px-8 py-5 text-center">Trạng thái</th>
                <th className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400"><span className="material-symbols-outlined text-4xl animate-spin">sync</span></td></tr>
              ) : filteredAccounts.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400">Chưa có dữ liệu</td></tr>
              ) : (
                filteredAccounts.map(acc => {
                  const roleInfo = ROLES.find(r => r.code === acc.role);
                  const unitName = AN_PHU_LOCATIONS.find(u => u.id === acc.unitId)?.name;
                  const areaName = AN_PHU_LOCATIONS.find(a => a.id === acc.areaId)?.name;
                  const isSelf = acc.id === user?.id;
                  const isDeleted = acc.status === 'deleted';

                  return (
                    <tr key={acc.id} className={`group transition-all ${isDeleted ? 'bg-slate-50 opacity-60 grayscale' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm text-white ${isDeleted ? 'bg-slate-400' : 'bg-primary'}`}>
                            {acc.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white uppercase leading-none">{acc.name}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">@{acc.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border ${roleInfo?.color}`}>
                          {roleInfo?.label || acc.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        {unitName ? (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{unitName}</p>
                            {areaName && <p className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 inline-block px-2 py-0.5 rounded">{areaName}</p>}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic">Toàn Phường</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                          acc.status === 'locked' ? 'bg-red-50 text-red-600' :
                            acc.status === 'deleted' ? 'bg-slate-200 text-slate-500' :
                              'bg-amber-50 text-amber-600'
                          }`}>
                          <span className={`size-2 rounded-full ${acc.status === 'active' ? 'bg-emerald-500' :
                            acc.status === 'locked' ? 'bg-red-500' :
                              acc.status === 'deleted' ? 'bg-slate-500' :
                                'bg-amber-500'
                            }`}></span>
                          {acc.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {!isDeleted && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(acc)}
                              className="size-9 rounded-lg border border-slate-200 text-slate-400 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                              title="Chỉnh sửa thông tin"
                            >
                              <span className="material-symbols-outlined text-lg">settings</span>
                            </button>
                            <button
                              disabled={isSelf}
                              onClick={() => handleToggleStatus(acc.id, acc.status)}
                              className={`size-9 rounded-lg border border-slate-200 flex items-center justify-center transition-all disabled:opacity-30 ${acc.status === 'locked' ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
                              title={acc.status === 'locked' ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            >
                              <span className="material-symbols-outlined text-lg">{acc.status === 'locked' ? 'lock_open' : 'lock'}</span>
                            </button>
                            <button
                              disabled={isSelf}
                              onClick={() => handleDeleteAccount(acc.id, acc.name)}
                              className="size-9 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center disabled:opacity-30"
                              title="Xóa tài khoản"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editModeId ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                  Thiết lập thông tin & Phân quyền chi tiết
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="size-10 rounded-xl bg-white dark:bg-slate-800 text-slate-400 hover:text-admin-red border border-slate-200 flex items-center justify-center transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
              {/* 1. THÔNG TIN CƠ BẢN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và Tên <span className="text-red-500">*</span></label>
                  <input
                    {...register('name')}
                    className={`w-full h-12 px-4 bg-slate-50 border rounded-xl text-sm font-bold uppercase outline-none transition-all ${errors.name ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-primary'}`}
                    placeholder="NGUYỄN VĂN A"
                  />
                  {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                  <input
                    {...register('username')}
                    disabled={!!editModeId}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-primary outline-none transition-all disabled:opacity-60"
                    placeholder="username"
                  />
                  {errors.username && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.username.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Mật khẩu {editModeId ? '(Để trống nếu giữ nguyên)' : <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type="password"
                      className={`w-full h-12 px-4 bg-slate-50 border rounded-xl text-sm font-bold outline-none transition-all ${errors.password ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-primary'}`}
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.password && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.password.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại</label>
                  <input
                    {...register('phone')}
                    className={`w-full h-12 px-4 bg-slate-50 border rounded-xl text-sm font-medium outline-none transition-all ${errors.phone ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-primary'}`}
                    placeholder="09xxxxxxxx"
                  />
                  {errors.phone && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.phone.message}</p>}
                </div>
              </div>

              {/* 2. VAI TRÒ & PHẠM VI DỮ LIỆU */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-4">
                  <div className="size-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">shield_person</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Vai trò & Phạm vi dữ liệu (Data Scope)</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vai trò <span className="text-red-500">*</span></label>
                    <select
                      {...register('role')}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-primary outline-none"
                    >
                      {ROLES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                      Đơn vị (Unit) {watchedRole === 'to_bau_cu' && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      {...register('unitId')}
                      disabled={watchedRole === 'super_admin' || watchedRole === 'ban_chi_dao'}
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-primary outline-none disabled:opacity-50"
                    >
                      <option value="">-- Toàn Phường --</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                      Khu vực bỏ phiếu (Area) {watchedRole === 'to_bau_cu' && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      {...register('areaId')}
                      disabled={!watchedUnitId || watchedRole === 'ban_chi_dao' || watchedRole === 'super_admin'}
                      className={`w-full h-12 px-4 bg-white border rounded-xl text-sm font-bold outline-none disabled:opacity-50 ${errors.areaId ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-primary'}`}
                    >
                      <option value="">-- Tất cả KV trong Đơn vị --</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.name.replace('KVBP', 'KV')} - {a.locationDetail}</option>)}
                    </select>
                    {errors.areaId && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.areaId.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khu phố (Neighborhood)</label>
                    <select
                      {...register('neighborhoodId')}
                      className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-primary outline-none"
                    >
                      <option value="">-- Không phân khu phố --</option>
                      {NEIGHBORHOODS.map(n => <option key={n.id} value={n.id}>{n.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. PERMISSION MATRIX */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">gavel</span>
                    Ma trận phân quyền chi tiết
                  </h3>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest w-40">Chức năng</th>
                        {ACTIONS.map(act => (
                          <th key={act.code} className="px-2 py-3 text-center">
                            <div className="flex flex-col items-center gap-1" title={act.label}>
                              <span className="material-symbols-outlined text-sm text-slate-400">{act.icon}</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">{act.label}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {MODULES.map(mod => (
                        <tr key={mod.code} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-xs text-slate-700 uppercase">{mod.label}</td>
                          {ACTIONS.map(act => {
                            const isChecked = watchedPermissions?.[mod.code]?.includes(act.code);
                            return (
                              <td key={act.code} className="px-2 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked || false}
                                  onChange={() => togglePermission(mod.code, act.code)}
                                  className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. TERMS CHECKBOX */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center h-5">
                  <input
                    id="terms-checkbox"
                    type="checkbox"
                    {...register('terms')}
                    className="size-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                <div className="ml-2 text-sm">
                  <label htmlFor="terms-checkbox" className="font-bold text-slate-900 block cursor-pointer">
                    Xác nhận thông tin & Điều khoản
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    Tôi cam kết thông tin tài khoản trên là chính xác và chịu trách nhiệm về quyền hạn được cấp.
                  </p>
                  {errors.terms && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.terms.message}</p>}
                </div>
              </div>
            </form>

            {/* Footer Actions */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-xl border border-slate-200 font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-white transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={!isValid || isSubmitting}
                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${isValid && !isSubmitting
                  ? 'bg-primary text-white hover:bg-blue-800'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                title={!isValid ? "Vui lòng điền đầy đủ thông tin và xác nhận điều khoản" : "Lưu lại"}
              >
                {isSubmitting ? <span className="material-symbols-outlined text-lg animate-spin">sync</span> : <span className="material-symbols-outlined text-lg">save</span>}
                Lưu thiết lập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
