
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AN_PHU_LOCATIONS, NEIGHBORHOODS } from '../types';

/**
 * COMPONENT: ResultCalculation
 * 
 * Mục đích: Tổng hợp kết quả bầu cử từ dữ liệu thô (Realtime) hoặc dữ liệu đã khóa sổ (Locked).
 * 
 * Logic tổng hợp:
 * - Hybrid Data Source: Kết hợp dữ liệu từ 2 nguồn:
 *   1. `voters` (Realtime Check-in): Dùng khi KVBP chưa khóa sổ.
 *   2. `area_stats` (Official Locked): Dùng khi KVBP đã xác nhận khóa sổ.
 * 
 * - View Modes: Hỗ trợ xem đa chiều (Toàn phường, Đơn vị, Khu phố, KVBP, Tổ).
 * - Drill-down: Click vào từng dòng để xem danh sách cử tri chi tiết.
 */

type ViewMode = 'ward' | 'unit' | 'neighborhood' | 'area' | 'group' | 'candidates';

interface AggregatedStat {
  id: string; // Display ID (e.g. "01", "1A")
  rawId: string; // Real ID for logic (e.g. "unit_1", "kp_1a")
  name: string;
  subLabel?: string;
  detail?: string; // Chi tiết text (nếu có)
  groups?: string[]; // Danh sách thành phần con (dùng để hiển thị tags)
  total: number;
  voted: number; // Đây là số cử tri đi bầu (Check-in) HOẶC số phiếu thu về (nếu đã khóa)
  percent: number;
  status: 'slow' | 'average' | 'good';
  isLocked: boolean; // Trạng thái đã khóa sổ hay chưa
  rawVoters?: any[];
}

interface CandidateResult {
  id: string;
  name: string;
  unitId: string;
  level: string; // Thêm trường level
  totalVotes: number;
  rank: number;
  percentage: number;
}

// --- SUB-COMPONENT: DETAIL MODAL ---
const DetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  voters: any[];
  mode: 'list' | 'progress';
}> = ({ isOpen, onClose, title, subtitle, voters, mode }) => {
  const [filter, setFilter] = useState<'all' | 'voted' | 'not-voted'>('not-voted');

  if (!isOpen) return null;

  const filteredVoters = voters.filter(v => {
    if (filter === 'voted') return v.voting_status === 'da-bau';
    if (filter === 'not-voted') return v.voting_status !== 'da-bau';
    return true;
  });

  const stats = {
    total: voters.length,
    voted: voters.filter(v => v.voting_status === 'da-bau').length,
    notVoted: voters.filter(v => v.voting_status !== 'da-bau').length,
  };
  const percent = stats.total > 0 ? ((stats.voted / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">

        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">{subtitle}</p>
          </div>
          <button onClick={onClose} className="size-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-admin-red hover:border-red-200 flex items-center justify-center transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-white border-b border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng cử tri</p>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Đã bầu (Check-in)</p>
            <p className="text-2xl font-black text-emerald-700">{stats.voted} <span className="text-sm">({percent}%)</span></p>
          </div>
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-center">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Chưa bầu</p>
            <p className="text-2xl font-black text-red-700">{stats.notVoted}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 flex gap-2 border-b border-slate-100">
          <button
            onClick={() => setFilter('not-voted')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'not-voted' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Chưa bầu ({stats.notVoted})
          </button>
          <button
            onClick={() => setFilter('voted')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'voted' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Đã bầu ({stats.voted})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            Tất cả ({stats.total})
          </button>
        </div>

        {/* Voter List Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Họ và Tên</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Thông tin định danh</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVoters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-8 py-10 text-center text-slate-400 text-sm font-bold italic">
                    Không có cử tri nào trong danh sách này.
                  </td>
                </tr>
              ) : (
                filteredVoters.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4">
                      <p className="text-sm font-black text-slate-900 uppercase">{v.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{v.group_name || 'Tổ --'} • {v.neighborhood_id?.replace('kp_', 'KP ').toUpperCase()}</p>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs font-bold text-slate-600">{v.cccd || 'CCCD: --'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Mã thẻ: {v.voter_card_number || '--'}</p>
                    </td>
                    <td className="px-8 py-4 text-center">
                      {v.voting_status === 'da-bau' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">
                          <span className="material-symbols-outlined text-[10px]">check</span> Đã bầu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase">
                          <span className="material-symbols-outlined text-[10px]">pending</span> Chưa bầu
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


export const ResultCalculation: React.FC<{ isLargeText?: boolean }> = ({ isLargeText }) => {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('area');

  // Data States
  const [voters, setVoters] = useState<any[]>([]);
  const [areaStats, setAreaStats] = useState<any[]>([]); // Lưu trữ dữ liệu từ bảng area_stats (Đã khóa)
  const [candidateResults, setCandidateResults] = useState<CandidateResult[]>([]);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ title: string; subtitle: string; voters: any[]; mode: 'list' | 'progress' }>({
    title: '', subtitle: '', voters: [], mode: 'list'
  });

  // Summary Data
  const [summary, setSummary] = useState({
    total: 0,
    voted: 0,
    notVoted: 0,
    completedAreas: 0,
    lockedAreas: 0, // Số KVBP đã khóa sổ
    totalAreas: 45
  });

  useEffect(() => {
    fetchRealtimeData();

    // Subscribe to both voters (check-in) and area_stats (official lock)
    const voterSub = supabase.channel('calc-voters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => fetchRealtimeData())
      .subscribe();

    const statsSub = supabase.channel('calc-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'area_stats' }, () => fetchRealtimeData())
      .subscribe();

    const resultSub = supabase.channel('calc-results-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voting_results' }, () => fetchRealtimeData())
      .subscribe();

    return () => {
      supabase.removeChannel(voterSub);
      supabase.removeChannel(statsSub);
      supabase.removeChannel(resultSub);
    };
  }, []);

  const fetchRealtimeData = async () => {
    try {
      // 1. Fetch Voters (Lightweight)
      const { data: vData } = await supabase
        .from('voters')
        .select('id, name, cccd, voter_card_number, area_id, voting_status, unit_id, neighborhood_id, group_name, residence_status');

      // 2. Fetch Area Stats (Official locked data)
      const { data: sData } = await supabase.from('area_stats').select('*');

      // Create a Map for quick lookup of stats
      const statsMap = new Map();
      if (sData) {
        sData.forEach(s => statsMap.set(s.area_id, s));
        setAreaStats(sData);
      }

      if (vData) {
        setVoters(vData);

        // Calc Summary Logic: Mix of Realtime & Locked Data
        let grandTotal = 0;
        let grandVoted = 0;
        let lockedCount = 0;
        const areas = AN_PHU_LOCATIONS.filter(l => l.type === 'area');
        let completedCount = 0;

        areas.forEach(area => {
          const stat = statsMap.get(area.id);
          const areaVoters = vData.filter(v => v.area_id === area.id);
          const realtimeVoted = areaVoters.filter(v => v.voting_status === 'da-bau').length;

          if (stat && stat.is_locked) {
            // Nếu đã khóa, dùng số liệu chính thức
            grandTotal += stat.total_voters;
            grandVoted += stat.received_votes; // Số phiếu thu về coi như số người đã bầu
            lockedCount++;
            if ((stat.received_votes / stat.total_voters) >= 0.9) completedCount++;
          } else {
            // Nếu chưa khóa, dùng số liệu realtime check-in
            grandTotal += areaVoters.length;
            grandVoted += realtimeVoted;
            if (areaVoters.length > 0 && (realtimeVoted / areaVoters.length) >= 0.9) completedCount++;
          }
        });

        setSummary({
          total: grandTotal,
          voted: grandVoted,
          notVoted: grandTotal - grandVoted,
          completedAreas: completedCount,
          lockedAreas: lockedCount,
          totalAreas: areas.length
        });
      }

      // 3. Fetch Candidates Results
      const { data: resData } = await supabase.from('voting_results').select('*');
      const { data: candData } = await supabase.from('candidates').select('*');

      if (resData && candData) {
        const votesByCandidate: Record<string, number> = {};
        resData.forEach(r => {
          votesByCandidate[r.candidate_id] = (votesByCandidate[r.candidate_id] || 0) + r.votes;
        });

        // Nhóm ứng cử viên theo Đơn vị để tính toán nội bộ
        const units = Array.from(new Set(candData.map(c => c.unit_id)));
        const allCalculatedCandidates: CandidateResult[] = [];

        units.forEach(uid => {
          const unitCandidates = candData.filter(c => c.unit_id === uid);
          const votesByUnitCandidate: Record<string, number> = {};
          let unitTotalVotes = 0;

          unitCandidates.forEach(c => {
            const v = votesByCandidate[c.id] || 0;
            votesByUnitCandidate[c.id] = v;
            unitTotalVotes += v;
          });

          const unitResults: CandidateResult[] = unitCandidates.map(c => {
            const v = votesByUnitCandidate[c.id];
            return {
              id: c.id,
              name: c.name,
              unitId: c.unit_id,
              level: c.level,
              totalVotes: v,
              rank: 0,
              percentage: unitTotalVotes > 0 ? parseFloat(((v / unitTotalVotes) * 100).toFixed(2)) : 0
            };
          });

          // Sắp xếp và đánh số thứ hạng trong nội bộ đơn vị
          unitResults.sort((a, b) => b.totalVotes - a.totalVotes);
          unitResults.forEach((c, idx) => c.rank = idx + 1);

          allCalculatedCandidates.push(...unitResults);
        });

        setCandidateResults(allCalculatedCandidates);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // --- ACTIONS HANDLERS ---
  const handleOpenDetail = (item: AggregatedStat, mode: 'list' | 'progress') => {
    let title = '';
    if (viewMode === 'area') title = `Khu vực bỏ phiếu ${item.name}`;
    else if (viewMode === 'group') title = `Tổ dân phố ${item.name}`;
    else title = item.name;

    const subtitle = item.subLabel || 'Chi tiết danh sách cử tri';

    setModalData({
      title,
      subtitle,
      voters: item.rawVoters || [],
      mode
    });
    setModalOpen(true);
  };

  // --- AGGREGATION LOGIC ---
  const aggregatedData = useMemo(() => {
    if (!voters.length) return [];

    // Helper: Tính toán stats cho một tập hợp cử tri
    const calculateStat = (filteredVoters: any[], targetAreaIds: string[] = []): Omit<AggregatedStat, 'id' | 'name' | 'rawId'> => {
      let total = 0;
      let voted = 0;
      let lockedCount = 0;

      // Tạo Map để gom nhóm cử tri theo Area ID cho dễ xử lý
      const votersByArea: Record<string, any[]> = {};
      filteredVoters.forEach(v => {
        if (!votersByArea[v.area_id]) votersByArea[v.area_id] = [];
        votersByArea[v.area_id].push(v);
      });

      // Duyệt qua tất cả các Area liên quan
      const areaIdsToCheck = targetAreaIds.length > 0 ? targetAreaIds : Object.keys(votersByArea);

      areaIdsToCheck.forEach(aid => {
        const stat = areaStats.find(s => s.area_id === aid);
        const areaVoters = votersByArea[aid] || [];

        if (stat && stat.is_locked) {
          // Nếu area này đã khóa -> Dùng số liệu chốt
          total += stat.total_voters;
          voted += stat.received_votes;
          lockedCount++;
        } else {
          // Nếu chưa khóa -> Dùng số liệu realtime
          total += areaVoters.length;
          voted += areaVoters.filter((v: any) => v.voting_status === 'da-bau').length;
        }
      });

      const percent = total > 0 ? parseFloat(((voted / total) * 100).toFixed(1)) : 0;
      let status: 'slow' | 'average' | 'good' = 'slow';
      if (percent >= 90) status = 'good';
      else if (percent >= 75) status = 'average';

      // Determine lock status for the row
      const isLocked = targetAreaIds.length > 0 && lockedCount === targetAreaIds.length;

      return {
        total, voted, percent, status, isLocked,
        rawVoters: filteredVoters // Raw voters vẫn truyền full để xem chi tiết danh sách
      };
    };

    switch (viewMode) {
      case 'ward':
        const allAreaIds = AN_PHU_LOCATIONS.filter(l => l.type === 'area').map(l => l.id);
        // Với chế độ "Toàn phường", ta trả về một danh sách các "đối tượng" tổng quát
        // Để giống giao diện Area, ta coi "Toàn phường" là một dòng, "Thường trú" là một dòng...
        const wardStat = calculateStat(voters, allAreaIds);
        const permanentVoters = voters.filter(v => !v.residence_status || v.residence_status === 'thuong-tru');
        const tempVoters = voters.filter(v => v.residence_status === 'tam-tru');

        return [
          {
            id: 'ALL',
            rawId: 'ward_all',
            name: 'TOÀN PHƯỜNG AN PHÚ',
            subLabel: 'Tổng hợp chung',
            detail: '09 Đơn vị, 45 KVBP',
            groups: ['09 Đơn vị', '45 KVBP', '80+ Tổ'],
            ...wardStat
          },
          {
            id: 'KT1/2',
            rawId: 'ward_perm',
            name: 'THƯỜNG TRÚ',
            subLabel: 'Cử tri KT1 / KT2',
            detail: 'Cử tri có hộ khẩu',
            groups: [],
            ...calculateStat(permanentVoters)
          },
          {
            id: 'KT3/4',
            rawId: 'ward_temp',
            name: 'TẠM TRÚ',
            subLabel: 'Cử tri KT3 / KT4',
            detail: 'Cử tri tạm trú',
            groups: [],
            ...calculateStat(tempVoters)
          },
        ];

      case 'unit':
        // Filter only 9 units
        return AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(u => {
          const unitVoters = voters.filter(v => v.unit_id === u.id);
          const childAreas = AN_PHU_LOCATIONS.filter(a => a.parentId === u.id && a.type === 'area');
          const childAreaIds = childAreas.map(a => a.id);

          // Tạo list tên các KVBP con để hiển thị ở cột Chi tiết
          const areaNames = childAreas.map(a => a.name.replace('KVBP', 'KV').replace('số ', ''));

          return {
            id: u.id.replace('unit_', '0'), // Normalized ID: 01, 02
            rawId: u.id,
            name: u.name.toUpperCase(),
            subLabel: 'Ban Bầu Cử Đơn Vị',
            detail: `Gồm ${childAreas.length} Khu vực bỏ phiếu`,
            groups: areaNames, // Truyền vào đây để render dạng tags giống Groups của Area
            ...calculateStat(unitVoters, childAreaIds)
          };
        });

      case 'neighborhood':
        return NEIGHBORHOODS.map(n => {
          const nbVoters = voters.filter(v => v.neighborhood_id === n.id);
          // Tìm các Area có liên quan đến khu phố này
          const relatedAreaIds = Array.from(new Set(nbVoters.map(v => v.area_id))).filter(Boolean) as string[];
          const relatedAreas = AN_PHU_LOCATIONS.filter(a => relatedAreaIds.includes(a.id));
          const areaNames = relatedAreas.map(a => a.name.replace('KVBP', 'KV').replace('số ', ''));

          // Normalized ID for Neighborhood (e.g., KP_1A -> 1A)
          const displayId = n.id.replace('kp_', '').toUpperCase().replace('BP', 'BP ');

          return {
            id: displayId,
            rawId: n.id,
            name: n.name.toUpperCase(),
            subLabel: 'Ban Điều Hành Khu Phố',
            detail: `${relatedAreas.length} Khu vực bỏ phiếu`,
            groups: areaNames,
            ...calculateStat(nbVoters, relatedAreaIds)
          };
        });

      case 'area':
        return AN_PHU_LOCATIONS.filter(l => l.type === 'area').map(a => {
          const areaVoters = voters.filter(v => v.area_id === a.id);
          const unit = AN_PHU_LOCATIONS.find(u => u.id === a.parentId);
          const groups = a.groups ? a.groups.split(',').map(g => g.trim()) : [];

          // Logic riêng cho Area: Check thẳng vào stats
          const stat = areaStats.find(s => s.area_id === a.id);
          const isLocked = stat?.is_locked || false;

          let total = areaVoters.length;
          let voted = areaVoters.filter(v => v.voting_status === 'da-bau').length;

          if (isLocked) {
            total = stat.total_voters;
            voted = stat.received_votes;
          }

          const percent = total > 0 ? parseFloat(((voted / total) * 100).toFixed(1)) : 0;
          let status: 'slow' | 'average' | 'good' = 'slow';
          if (percent >= 90) status = 'good';
          else if (percent >= 75) status = 'average';

          return {
            id: a.id.replace('kv', ''), // Normalized ID: 01
            rawId: a.id,
            name: a.name.toUpperCase(),
            subLabel: unit?.name.replace('Đơn vị số', 'ĐV') || '',
            detail: AN_PHU_LOCATIONS.find(n => n.id === a.neighborhoodId)?.name,
            groups: groups,
            total, voted, percent, status, isLocked,
            rawVoters: areaVoters
          };
        });

      case 'group':
        const groupsMap: Record<string, {
          id: string, name: string, neighborhoodId: string, unitId: string, areaIds: Set<string>, voters: any[]
        }> = {};

        voters.forEach(v => {
          if (!v.group_name) return;
          const normGroup = v.group_name.trim().toUpperCase();
          const compositeKey = `${v.neighborhood_id || 'unknown'}__${normGroup}`;

          if (!groupsMap[compositeKey]) {
            groupsMap[compositeKey] = {
              id: compositeKey, name: normGroup, neighborhoodId: v.neighborhood_id, unitId: v.unit_id, areaIds: new Set(), voters: []
            };
          }
          groupsMap[compositeKey].voters.push(v);
          if (v.area_id) groupsMap[compositeKey].areaIds.add(v.area_id);
        });

        return Object.values(groupsMap).map(g => {
          const neighborhoodName = NEIGHBORHOODS.find(n => n.id === g.neighborhoodId)?.name.toUpperCase() || 'KP KHÁC';
          const unitName = AN_PHU_LOCATIONS.find(u => u.id === g.unitId)?.name.replace('Đơn vị số', 'ĐV') || '';
          const areaList = Array.from(g.areaIds).map(aid => aid.toUpperCase().replace('KV', 'KV')).sort();

          const total = g.voters.length;
          const voted = g.voters.filter(v => v.voting_status === 'da-bau').length;
          const percent = total > 0 ? parseFloat(((voted / total) * 100).toFixed(1)) : 0;
          let status: 'slow' | 'average' | 'good' = 'slow';
          if (percent >= 90) status = 'good';
          else if (percent >= 75) status = 'average';

          return {
            id: g.name.replace(/^TỔ\s+/i, ''),
            rawId: g.id,
            name: g.name.replace(/^TỔ\s+/i, 'TỔ '),
            subLabel: neighborhoodName,
            detail: unitName,
            groups: areaList, // Liệt kê các KVBP chứa tổ này
            total, voted, percent, status, isLocked: false,
            rawVoters: g.voters
          };
        }).sort((a, b) => a.subLabel.localeCompare(b.subLabel) || a.name.localeCompare(b.name, undefined, { numeric: true }));

      default:
        return [];
    }
  }, [viewMode, voters, areaStats]);

  // Helpers UI
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-emerald-500';
      case 'average': return 'bg-amber-500';
      default: return 'bg-admin-red';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'quoc-hoi': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase border border-amber-200 whitespace-nowrap">ĐB Quốc hội</span>;
      case 'thanh-pho': return <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-[9px] font-black uppercase border border-indigo-200 whitespace-nowrap">HĐND Thành phố</span>;
      default: return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black uppercase border border-emerald-200 whitespace-nowrap">HĐND Phường</span>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span></div>;

  return (
    <div className={`space-y-8 pb-32 animate-in fade-in duration-500 ${isLargeText ? 'text-lg' : 'text-base'}`}>

      {/* HEADER SECTION WITH TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b-2 border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl text-primary">bar_chart_4_bars</span>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Tổng hợp kết quả bầu cử</h1>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Dữ liệu được tổng hợp Real-time từ {summary.totalAreas} Điểm cầu KVBP.</p>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          {[
            { id: 'ward', label: 'Toàn phường' },
            { id: 'unit', label: 'Theo Đơn vị' },
            { id: 'neighborhood', label: 'Theo Khu phố' },
            { id: 'area', label: 'Theo KV Bỏ phiếu' },
            { id: 'group', label: 'Theo Tổ' },
            { id: 'candidates', label: 'Kết quả trúng cử' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng cử tri niêm yết</p>
            <span className="material-symbols-outlined text-primary">groups</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.total.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Dữ liệu gốc từ bảng tuyển quân</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cử tri đã đi bầu</p>
            <span className="material-symbols-outlined text-emerald-500">how_to_vote</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.voted.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-emerald-600 uppercase mt-1">Tiến độ: {summary.total > 0 ? ((summary.voted / summary.total) * 100).toFixed(2) : 0}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KVBP Đã Khóa Sổ</p>
            <span className="material-symbols-outlined text-admin-red">lock</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.lockedAreas}<span className="text-2xl text-slate-300">/{summary.totalAreas}</span></p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Số liệu đã chốt chính thức</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KVBP Hoàn thành</p>
            <span className="material-symbols-outlined text-blue-500">verified</span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-slate-900 tracking-tight">{summary.completedAreas}<span className="text-2xl text-slate-300">/{summary.totalAreas}</span></p>
            <p className="text-[9px] font-bold text-blue-600 uppercase mt-1">Đạt chỉ tiêu &gt; 90%</p>
          </div>
        </div>
      </div>

      {/* CONTENT: SPECIFIC AGGREGATED VIEWS */}
      {viewMode === 'candidates' ? (
        // CANDIDATE VIEW - GROUPED BY UNIT
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {AN_PHU_LOCATIONS.filter(l => l.type === 'unit').map(unit => {
            const unitResults = candidateResults.filter(c => c.unitId === unit.id);
            if (unitResults.length === 0) return null;

            return (
              <div key={unit.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="material-symbols-outlined text-2xl">stars</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{unit.name}</h2>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">Kết quả tổng hợp nội bộ đơn vị</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đại biểu ứng cử</p>
                    <p className="text-2xl font-black text-slate-900">{unitResults.length}</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {unitResults.map(c => (
                    <div key={c.id} className={`grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-slate-50 ${c.rank <= 3 ? 'bg-yellow-50/20' : ''}`}>
                      <div className="col-span-1 text-center flex flex-col items-center">
                        <span className={`size-8 rounded-full flex items-center justify-center font-black text-sm ${c.rank === 1 ? 'bg-yellow-400 text-yellow-900 shadow-sm' :
                            c.rank === 2 ? 'bg-slate-300 text-slate-700' :
                              c.rank === 3 ? 'bg-amber-600 text-white' : 'text-slate-400'
                          }`}>
                          {c.rank}
                        </span>
                      </div>
                      <div className="col-span-4">
                        <p className="text-lg font-black uppercase text-slate-900">{c.name}</p>
                        <div className="mt-1 flex gap-2">
                          {getLevelBadge(c.level)}
                        </div>
                      </div>
                      <div className="col-span-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex justify-between w-full max-w-[160px] mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Tỷ lệ phiếu</span>
                            <span className="text-[10px] font-black text-primary">{c.percentage}%</span>
                          </div>
                          <div className="h-2 w-full max-w-[160px] bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div className="h-full bg-primary shadow-sm" style={{ width: `${c.percentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="text-3xl font-black text-slate-900 leading-none">{c.totalVotes.toLocaleString()}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">PHIẾU BẦU HỢP LỆ</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {candidateResults.length === 0 && (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-sm">
              <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">analytics</span>
              <p className="text-slate-400 font-black uppercase tracking-widest">Chưa có dữ liệu kiểm phiếu từ các KVBP</p>
            </div>
          )}
        </div>
      ) : (
        // AGGREGATED LIST VIEW (UNIFIED DESIGN FOR ALL VIEW MODES)
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">

          {/* Header of Table */}
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">layers</span>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                {viewMode === 'area' ? 'CHI TIẾT KẾT QUẢ THEO KV BỎ PHIẾU (KVBP)' :
                  viewMode === 'unit' ? 'CHI TIẾT TIẾN ĐỘ THEO ĐƠN VỊ BẦU CỬ' :
                    viewMode === 'neighborhood' ? 'CHI TIẾT TIẾN ĐỘ THEO KHU PHỐ' :
                      viewMode === 'group' ? 'CHI TIẾT TIẾN ĐỘ THEO TỔ DÂN PHỐ' :
                        'TỔNG HỢP TOÀN PHƯỜNG'}
              </h3>
            </div>
            {/* Legend */}
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-red-50 text-admin-red border border-red-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-admin-red"></span> Chậm (&lt;75%)</div>
              <div className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"></span> TB (75-90%)</div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span> Đạt (&gt;90%)</div>
              <div className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-black uppercase flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">lock</span> Đã khóa</div>
            </div>
          </div>

          {/* UNIFIED Column Headers */}
          <div className="grid grid-cols-12 gap-4 px-8 py-4 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="col-span-1">Mã/STT</div>
            <div className="col-span-2">Tên đối tượng</div>
            <div className="col-span-3">Chi tiết / Thành phần</div>
            <div className="col-span-2 text-center">Chức năng</div>
            <div className="col-span-2 text-center">Số liệu bầu cử</div>
            <div className="col-span-2 text-right">Trạng thái & Tiến độ</div>
          </div>

          {/* List Rows */}
          <div className="divide-y divide-slate-100">
            {aggregatedData.map(item => (
              <div key={item.rawId} className={`grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-slate-50/50 transition-colors group ${item.isLocked ? 'bg-slate-50/80' : ''}`}>

                {/* ID Column */}
                <div className="col-span-1 relative">
                  <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm truncate block text-center ${item.isLocked ? 'bg-admin-red text-white' : 'bg-slate-900 text-white'}`}>
                    {viewMode === 'unit' ? `ĐV ${item.id}` :
                      viewMode === 'neighborhood' ? `KP ${item.id}` :
                        viewMode === 'area' ? `KV ${item.id}` :
                          viewMode === 'group' ? item.id :
                            item.id}
                  </span>
                  {item.isLocked && (
                    <div className="absolute -top-2 -right-2 text-admin-red bg-white rounded-full p-0.5 shadow-sm border border-red-100" title="Đã khóa sổ">
                      <span className="material-symbols-outlined text-xs">lock</span>
                    </div>
                  )}
                </div>

                {/* Name/SubLabel Column */}
                <div className="col-span-2">
                  <p className="text-sm font-black text-slate-900 uppercase leading-none">
                    {item.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                    {item.subLabel}
                  </p>
                </div>

                {/* Detail / Groups Column */}
                <div className="col-span-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{item.detail}</p>
                  {item.groups && item.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.groups.slice(0, 6).map((g, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase whitespace-nowrap">
                          {g}
                        </span>
                      ))}
                      {item.groups.length > 6 && <span className="text-[9px] text-slate-400">...</span>}
                    </div>
                  )}
                </div>

                {/* Actions Column (Buttons) */}
                <div className="col-span-2 flex flex-col gap-2 items-center">
                  <button
                    onClick={() => handleOpenDetail(item as any, 'list')}
                    className="w-full py-1.5 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-500 uppercase hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">groups</span> Danh sách cử tri
                  </button>
                  <button
                    onClick={() => handleOpenDetail(item as any, 'progress')}
                    className="w-full py-1.5 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black text-slate-500 uppercase hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">bar_chart</span> Xem tiến độ
                  </button>
                </div>

                {/* Stats Column */}
                <div className="col-span-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-emerald-600 uppercase">{item.isLocked ? 'Thu về:' : 'Đã bầu:'}</span>
                    <span className="font-black text-slate-900">{item.voted.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-admin-red uppercase">Chưa bầu:</span>
                    <span className="font-black text-slate-900">{(item.total - item.voted).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-px bg-slate-200 my-1"></div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-black text-slate-500 uppercase">Tổng:</span>
                    <span className="font-black text-slate-900">{item.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Progress Bar Column */}
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.status === 'good' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'average' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {item.status === 'good' ? 'ĐẠT' : item.status === 'average' ? 'TRUNG BÌNH' : 'CHẬM'}
                    </span>
                    <span className="text-sm font-black text-slate-900">{item.percent}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100 relative">
                    <div className={`h-full rounded-full transition-all duration-1000 ${getStatusColor(item.status)}`} style={{ width: `${item.percent}%` }}></div>
                    {item.isLocked && (
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMiIvPgo8cGF0aCBkPSJNNCAwTDAgNE0wIDBMNCA0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS1vcGFjaXR5PSIwLjEiLz4KPC9zdmc+')] opacity-50"></div>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAIL MODAL RENDER */}
      <DetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalData.title}
        subtitle={modalData.subtitle}
        voters={modalData.voters}
        mode={modalData.mode}
      />
    </div>
  );
};
