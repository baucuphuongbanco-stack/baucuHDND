
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createLog } from '../lib/logger';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let loginEmail = email.trim().toLowerCase();
      // Nếu nhập username không có @, tự động thêm domain công vụ
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@anphu.gov.vn`;
      }

      // 1. Authenticate with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authError) {
        throw authError;
      }

      // 2. Check Profile Status in 'profiles' table
      if (data.session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('status, role, full_name')
          .eq('id', data.session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          // Sign out immediately if we can't verify status to be safe
          await supabase.auth.signOut();
          throw new Error('Lỗi hệ thống: Không thể truy xuất thông tin hồ sơ (Schema Error). Vui lòng thử lại sau.');
        }

        if (profile) {
          if (profile.status === 'locked') {
            await supabase.auth.signOut();
            throw new Error('Tài khoản đã bị KHÓA. Vui lòng liên hệ Admin Phường.');
          }
          if (profile.status === 'deleted') {
            await supabase.auth.signOut();
            throw new Error('Tài khoản không tồn tại hoặc đã bị xóa.');
          }

          // --- AUDIT LOGGING ---
          createLog({
            userName: profile.full_name || loginEmail,
            action: 'ĐĂNG NHẬP',
            details: `Tài khoản ${loginEmail} đăng nhập thành công. Vai trò: ${profile.role}`,
            status: 'success'
          });

          // 3. Trigger UI transition
          onLogin();
        }
      }

    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.message.includes('Invalid login credentials')) {
        setError('Sai tên đăng nhập hoặc mật khẩu.');
      } else if (err.message.includes('KHÓA') || err.message.includes('xóa')) {
        setError(err.message);
      } else {
        setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f0f2f5] dark:bg-slate-950 p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-admin-red via-primary to-admin-red opacity-80"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 bg-admin-red/5 rounded-full blur-3xl"></div>

      <div className="w-full max-w-[420px] relative animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center size-20 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 mb-2">
            <span className="material-symbols-outlined text-5xl text-admin-red font-variation-fill">policy</span>
          </div>
          <div>
            <h3 className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em]">Hệ thống quản lý</h3>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mt-1">Bầu Cử Số Phường An Phú</h1>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1 italic">Kỳ bầu cử nhiệm kỳ 2026 - 2031</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-200/50 dark:border-slate-800">
          <div className="p-10">
            <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight mb-8 flex items-center gap-3">
              <span className="w-1.5 h-5 bg-admin-red rounded-full"></span>
              Đăng nhập hệ thống
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 items-center animate-in slide-in-from-top-2">
                  <span className="material-symbols-outlined text-admin-red text-xl">error</span>
                  <p className="text-[11px] font-bold text-admin-red uppercase leading-tight">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email / Tài khoản</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl transition-colors group-focus-within:text-primary">mail</span>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin"
                      className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl transition-colors group-focus-within:text-primary">lock</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Đăng nhập ngay</span>
                    <span className="material-symbols-outlined text-2xl">login</span>
                  </>
                )}
              </button>
            </form>
          </div>
          <div className="px-10 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-xs">verified_user</span>
              Powered by Supabase Auth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
