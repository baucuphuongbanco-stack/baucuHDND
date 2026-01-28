
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { WARD_LOCATIONS } from '../types';
import {
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   Cell,
   PieChart,
   Pie,
   Legend,
   AreaChart,
   Area
} from 'recharts';

/**
 * COMPONENT: Dashboard
 */

const UNIT_COLORS = [
   '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#6366f1',
];

const GENDER_COLORS = ['#3b82f6', '#f43f5e'];
const AGE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
   const [stats, setStats] = useState({ total: 0, voted: 0 });
   const [kvData, setKvData] = useState<any[]>([]);
   const [unitChartData, setUnitChartData] = useState<any[]>([]);
   const [genderData, setGenderData] = useState<any[]>([]);
   const [ageData, setAgeData] = useState<any[]>([]);
   const [ethnicData, setEthnicData] = useState<any[]>([]);
   const [trendData, setTrendData] = useState<any[]>([]);
   const [currentTime, setCurrentTime] = useState(new Date());

   const [allVoters, setAllVoters] = useState<any[]>([]);
   const [selectedKvId, setSelectedKvId] = useState<string | null>(null);

   useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      fetchRealtimeStats();
      fetchVotingTrend();

      const channel = supabase
         .channel('dashboard-realtime')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => {
            fetchRealtimeStats();
         })
         .on('postgres_changes', { event: '*', schema: 'public', table: 'system_logs' }, () => {
            fetchVotingTrend();
         })
         .subscribe();

      return () => {
         clearInterval(timer);
         supabase.removeChannel(channel);
      };
   }, []);

   const fetchRealtimeStats = async () => {
      try {
         const { data: votersData, error } = await supabase
            .from('voters')
            .select('*');

         if (error) throw error;

         if (votersData) {
            setAllVoters(votersData);

            const totalCount = votersData.length;
            const votedCount = votersData.filter(v => v.voting_status === 'da-bau').length;
            setStats({ total: totalCount, voted: votedCount });

            const units = WARD_LOCATIONS.filter(l => l.type === 'unit');
            const unitStats = units.map(unit => {
               const unitVoters = votersData.filter(v => v.unit_id === unit.id);
               const unitTotal = unitVoters.length;
               const unitVoted = unitVoters.filter(v => v.voting_status === 'da-bau').length;
               return {
                  name: unit.name.replace('Đơn vị số', 'ĐV'),
                  full_name: unit.name,
                  total: unitTotal,
                  voted: unitVoted,
                  remain: unitTotal - unitVoted,
                  percentage: unitTotal > 0 ? parseFloat(((unitVoted / unitTotal) * 100).toFixed(1)) : 0
               };
            });
            setUnitChartData(unitStats);

            const areaNodes = WARD_LOCATIONS.filter(l => l.type === 'area');
            const calculatedKV = areaNodes.map(area => {
               const areaVoters = votersData.filter(v => v.area_id === area.id);
               const t = areaVoters.length;
               const v = areaVoters.filter(v => v.voting_status === 'da-bau').length;
               return {
                  id: area.id,
                  name: area.name,
                  total: t,
                  voted: v,
                  remain: t - v,
                  percentage: t > 0 ? Math.round((v / t) * 100) : 0
               };
            });
            setKvData(calculatedKV);

            // Demographics
            const votedVoters = votersData.filter(v => v.voting_status === 'da-bau');
            setGenderData([
               { name: 'Nam', value: votedVoters.filter(v => v.gender === 'Nam').length },
               { name: 'Nữ', value: votedVoters.filter(v => v.gender === 'Nữ').length }
            ]);

            const currentYear = new Date().getFullYear();
            const ageGroups = { '18-30': 0, '31-45': 0, '46-60': 0, 'Trên 60': 0 };
            votedVoters.forEach(v => {
               if (v.dob) {
                  const birthYear = parseInt(v.dob.split('/').pop() || v.dob.split('-').shift() || '0');
                  if (birthYear > 1000) {
                     const age = currentYear - birthYear;
                     if (age <= 30) ageGroups['18-30']++;
                     else if (age <= 45) ageGroups['31-45']++;
                     else if (age <= 60) ageGroups['46-60']++;
                     else ageGroups['Trên 60']++;
                  }
               }
            });
            setAgeData(Object.entries(ageGroups).map(([name, value]) => ({ name, value })));

            const ethnicMap: Record<string, number> = {};
            votedVoters.forEach(v => {
               const e = v.ethnic || 'Kinh';
               ethnicMap[e] = (ethnicMap[e] || 0) + 1;
            });
            setEthnicData(Object.entries(ethnicMap).map(([name, value]) => ({ name, value })));
         }
      } catch (err) {
         console.error("Dashboard error:", err);
      }
   };

   const fetchVotingTrend = async () => {
      try {
         const { data: logs } = await supabase
            .from('system_logs')
            .select('created_at')
            .eq('action', 'CẬP NHẬT TRẠNG THÁI BẦU')
            .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true });

         if (logs) {
            const intervals: Record<string, number> = {};
            logs.forEach(log => {
               const k = new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }).slice(0, 4) + '0';
               intervals[k] = (intervals[k] || 0) + 1;
            });
            setTrendData(Object.entries(intervals).map(([time, value]) => ({ time, value })));
         }
      } catch (err) { /* silent */ }
   };

   const overallPercentage = stats.total > 0 ? ((stats.voted / stats.total) * 100).toFixed(2) : "0.00";

   const selectedKvVoters = useMemo(() => {
      if (!selectedKvId) return [];
      return allVoters
         .filter(v => v.area_id === selectedKvId)
         .sort((a, b) => {
            if (a.voting_status === 'da-bau' && b.voting_status !== 'da-bau') return 1;
            if (a.voting_status !== 'da-bau' && b.voting_status === 'da-bau') return -1;
            return a.name.localeCompare(b.name);
         });
   }, [selectedKvId, allVoters]);

   const selectedKvInfo = useMemo(() => {
      if (!selectedKvId) return null;
      return WARD_LOCATIONS.find(l => l.id === selectedKvId);
   }, [selectedKvId]);

   const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
         const data = payload[0].payload;
         return (
            <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl z-50">
               <p className="font-black text-slate-900 uppercase mb-2">{data.full_name}</p>
               <p className="text-xs font-bold text-emerald-600">Đã bầu: {data.voted.toLocaleString()}</p>
               <p className="text-xs font-bold text-slate-400">Chưa bầu: {data.remain.toLocaleString()}</p>
               <div className="w-full h-px bg-slate-100 my-2"></div>
               <p className="text-sm font-black text-primary">Tiến độ: {data.percentage}%</p>
            </div>
         );
      }
      return null;
   };

   return (
      <div className="space-y-8 pb-20 overflow-x-hidden animate-in fade-in duration-500 relative">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-primary pb-8">
            <div className="space-y-3">
               <div className="flex items-center gap-4">
                  <div className="px-5 py-2 bg-admin-red text-white text-[10px] font-black rounded-full shadow-xl flex items-center gap-2 uppercase tracking-widest animate-pulse">
                     <span className="w-2 h-2 bg-white rounded-full"></span> Live Data
                  </div>
                  <h1 className={`font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none ${isLargeText ? 'text-4xl' : 'text-3xl'}`}>Giám sát Bàn Cờ 2026</h1>
               </div>
               <p className="text-slate-600 font-bold text-lg flex items-center gap-2 uppercase tracking-wide">Dữ liệu thực tế từ Cơ sở dữ liệu Phường</p>
            </div>
            <div className="text-right">
               <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums tracking-tight">{currentTime.toLocaleTimeString('vi-VN')}</p>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border-2 border-slate-200 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-6">
               <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-2">TIẾN ĐỘ TỔNG THỂ TOÀN PHƯỜNG</p>
                  <h2 className={`font-black text-slate-900 dark:text-white tracking-tighter ${isLargeText ? 'text-8xl' : 'text-7xl'} leading-none`}>{overallPercentage}%</h2>
               </div>
               <div className="text-right">
                  <p className={`font-black text-emerald-700 uppercase ${isLargeText ? 'text-3xl' : 'text-2xl'}`}>{stats.voted.toLocaleString()} <span className="text-slate-300">/</span> {stats.total.toLocaleString()}</p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cử tri đã đi bầu</p>
               </div>
            </div>
            <div className="h-14 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border-4 border-slate-200 p-1.5 shadow-inner">
               <div className="h-full bg-gradient-to-r from-admin-red via-primary to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${overallPercentage}%` }} />
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 shadow-xl h-[450px] flex flex-col">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-primary">bar_chart</span> Tiến độ theo Đơn vị
               </h3>
               <div className="flex-1 w-full min-h-[300px] relative">
                  <ResponsiveContainer width="100%" height={290} debounce={100}>
                     <BarChart data={unitChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="voted" stackId="a">
                           {unitChartData.map((e, i) => <Cell key={i} fill={UNIT_COLORS[i % UNIT_COLORS.length]} />)}
                        </Bar>
                        <Bar dataKey="remain" stackId="a" fill="#e2e8f0" />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 shadow-xl h-[450px] flex flex-col">
               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-admin-red">timeline</span> Tốc độ bầu cử
               </h3>
               <div className="flex-1 w-full min-h-[300px] relative">
                  <ResponsiveContainer width="100%" height={290} debounce={100}>
                     <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={3} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 shadow-lg h-[350px] flex flex-col">
               <h4 className="text-sm font-black text-slate-900 uppercase mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">pie_chart</span> Giới tính</h4>
               <div className="flex-1 min-h-[220px] relative">
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                     <PieChart>
                        <Pie data={genderData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                           {genderData.map((e, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 shadow-lg h-[350px] flex flex-col">
               <h4 className="text-sm font-black text-slate-900 uppercase mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">analytics</span> Độ tuổi</h4>
               <div className="flex-1 min-h-[220px] relative">
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                     <BarChart data={ageData}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                        <Bar dataKey="value">
                           {ageData.map((e, i) => <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 shadow-lg h-[350px] flex flex-col">
               <h4 className="text-sm font-black text-slate-900 uppercase mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">folder_shared</span> Dân tộc</h4>
               <div className="flex-1 min-h-[220px] relative">
                  <ResponsiveContainer width="100%" height={220} debounce={100}>
                     <BarChart data={ethnicData} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} /><Tooltip />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-900 uppercase px-2 flex items-center gap-2">
               <span className="material-symbols-outlined text-primary">grid_view</span> Chi tiết 45 KVBP
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
               {kvData.map((kv) => (
                  <div key={kv.id} onClick={() => setSelectedKvId(kv.id)} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 text-center shadow-sm hover:scale-105 hover:border-primary transition-all cursor-pointer">
                     <p className="text-[10px] font-black uppercase text-slate-400">{kv.id.replace('kv', 'KV ')}</p>
                     <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{kv.percentage}%</p>
                     <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${kv.percentage >= 90 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${kv.percentage}%` }} />
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {selectedKvId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50 border-b flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">{selectedKvInfo?.name}</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase mt-1">{selectedKvInfo?.locationDetail}</p>
                     </div>
                     <button onClick={() => setSelectedKvId(null)} className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-red-500 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                     </button>
                  </div>
                  <div className="grid grid-cols-3 border-b text-center divide-x">
                     <div className="p-4"><p className="text-[10px] uppercase font-black text-slate-400">Tổng</p><p className="text-2xl font-black">{selectedKvVoters.length}</p></div>
                     <div className="p-4 bg-emerald-50"><p className="text-[10px] uppercase font-black text-emerald-600">Đã bầu</p><p className="text-2xl font-black text-emerald-600">{selectedKvVoters.filter(v => v.voting_status === 'da-bau').length}</p></div>
                     <div className="p-4 bg-red-50"><p className="text-[10px] uppercase font-black text-red-600">Chưa bầu</p><p className="text-2xl font-black text-red-600">{selectedKvVoters.filter(v => v.voting_status !== 'da-bau').length}</p></div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 font-black text-[10px] uppercase text-slate-500">
                           <tr><th className="px-6 py-4">STT</th><th className="px-6 py-4">Họ tên</th><th className="px-6 py-4">Định danh</th><th className="px-6 py-4">Trạng thái</th></tr>
                        </thead>
                        <tbody>
                           {selectedKvVoters.map((v, i) => (
                              <tr key={v.id} className="border-b hover:bg-slate-50">
                                 <td className="px-6 py-4 text-xs font-bold text-slate-400">{i + 1}</td>
                                 <td className="px-6 py-4 font-black uppercase text-sm">{v.name}</td>
                                 <td className="px-6 py-4 text-xs font-mono">{v.cccd}</td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${v.voting_status === 'da-bau' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{v.voting_status === 'da-bau' ? 'Đã bầu' : 'Chưa bầu'}</span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
