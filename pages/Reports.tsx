import React, { useState, useMemo, useEffect } from 'react';
import { AN_PHU_LOCATIONS, NEIGHBORHOODS, LocationNode } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportsProps {
  isLargeText?: boolean;
}

type ReportStatus = 'draft' | 'updating' | 'ready' | 'confirmed' | 'locked';
type FilterScope = 'ward' | 'neighborhood' | 'unit' | 'area';

interface ElectionReport {
  id: string;
  code: string;
  title: string;
  level: FilterScope;
  targetId: string; // ID của Unit hoặc Area (ví dụ: 'unit_1', 'kv01')
  status: ReportStatus;
  progress: number;
  lastUpdated: string;
  author: string;
  description: string;
  // Số liệu cử tri liên kết trực tiếp
  totalVoters: number;
  votedVoters: number;
  cutoffTime: string;
}

// Interface cho dữ liệu chi tiết khi xem báo cáo
interface ReportDetailData {
  stats: {
    totalVoters: number;
    issuedVotes: number;
    receivedVotes: number;
    validVotes: number;
    invalidVotes: number;
  };
  candidates: {
    id: string;
    name: string;
    votes: number;
    percentage: number;
  }[];
  isLocked: boolean; // Trạng thái khóa toàn cục của báo cáo này
}

export const Reports: React.FC<ReportsProps> = ({ isLargeText }) => {
  const { showNotification } = useNotification();
  // --- STATE ---
  const [filterScope, setFilterScope] = useState<FilterScope | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');

  const [viewingReport, setViewingReport] = useState<ElectionReport | null>(null);
  const [reportDetailData, setReportDetailData] = useState<ReportDetailData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Quick Stats Realtime State
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [areaStatusMap, setAreaStatusMap] = useState<Record<string, 'done' | 'voting' | 'empty'>>({});

  // --- STATE MODAL KHỞI TẠO MỚI ---
  const [isCreating, setIsCreating] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newReportData, setNewReportData] = useState({
    template: '',
    neighborhood: '',
    unit: '',
    area: '',
  });

  const reportTemplates = [
    { code: 'Mẫu 15-BC', title: 'Biên bản kết quả kiểm phiếu tại Tổ bầu cử', desc: 'Dành cho 45 Khu vực bỏ phiếu (KVBP).', levelScope: 'area' },
    { code: 'Mẫu 16-BC', title: 'Biên bản xác định kết quả tại Đơn vị bầu cử', desc: 'Dành cho 09 Ban bầu cử Đơn vị.', levelScope: 'unit' },
    { code: 'Mẫu 18-BC', title: 'Báo cáo tiến độ cử tri đi bầu', desc: 'Cập nhật định kỳ toàn phường.', levelScope: 'ward' },
  ];

  // --- DANH SÁCH MẪU BIỂU (Tự động sinh dựa trên Master Data để Demo) ---
  const [reports, setReports] = useState<ElectionReport[]>([]);

  useEffect(() => {
    // Giả lập việc lấy danh sách báo cáo từ hệ thống. 
    // Trong thực tế, ta có thể lưu metadata báo cáo vào bảng 'reports'. 
    // Ở đây ta generate sẵn một số báo cáo điển hình dựa trên Master Data.
    const generatedReports: ElectionReport[] = [
      // Báo cáo toàn phường
      {
        id: 'rp_ward', code: 'Mẫu 18-BC', title: 'Báo cáo tiến độ cử tri đi bầu (Toàn phường)',
        level: 'ward', targetId: 'ap', status: 'updating', progress: 0, lastUpdated: 'Real-time',
        author: 'UBBC Phường', description: 'Tổng hợp số liệu từ 45 KVBP',
        totalVoters: 0, votedVoters: 0, cutoffTime: 'Hiện tại'
      },
      // Báo cáo mẫu cho Đơn vị 1
      {
        id: 'rp_unit_1', code: 'Mẫu 16-BC', title: 'Biên bản kết quả Đơn vị số 1',
        level: 'unit', targetId: 'unit_1', status: 'updating', progress: 0, lastUpdated: 'Real-time',
        author: 'Ban Bầu cử ĐV1', description: 'Tổng hợp KV01 - KV06',
        totalVoters: 0, votedVoters: 0, cutoffTime: 'Hiện tại'
      },
      // Báo cáo mẫu cho KV01
      {
        id: 'rp_kv01', code: 'Mẫu 15-BC', title: 'Biên bản kiểm phiếu KVBP số 01',
        level: 'area', targetId: 'kv01', status: 'draft', progress: 0, lastUpdated: 'Real-time',
        author: 'Tổ trưởng KV01', description: 'Trường Tiểu học An Phú 3',
        totalVoters: 0, votedVoters: 0, cutoffTime: 'Hiện tại'
      }
    ];
    setReports(generatedReports);
  }, []);

  // --- REAL-TIME QUICK STATS LOGIC ---
  useEffect(() => {
    if (showQuickStats) {
      fetchQuickStats();

      // Subscribe to changes in both voters and area_stats
      const channel = supabase.channel('reports-quick-stats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voters' }, () => fetchQuickStats())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'area_stats' }, () => fetchQuickStats())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [showQuickStats]);

  const fetchQuickStats = async () => {
    try {
      // 1. Get Lock Status from area_stats
      const { data: lockedData } = await supabase.from('area_stats').select('area_id, is_locked');
      const lockedSet = new Set(lockedData?.filter(s => s.is_locked).map(s => s.area_id));

      // 2. Get Voting Activity from voters (lightweight query)
      // Chỉ lấy những người đã bầu để giảm tải
      const { data: votedData } = await supabase.from('voters').select('area_id').eq('voting_status', 'da-bau');
      const activeAreasSet = new Set(votedData?.map(v => v.area_id));

      const newStatusMap: Record<string, 'done' | 'voting' | 'empty'> = {};

      AN_PHU_LOCATIONS.filter(l => l.type === 'area').forEach(area => {
        if (lockedSet.has(area.id)) {
          newStatusMap[area.id] = 'done';
        } else if (activeAreasSet.has(area.id)) {
          newStatusMap[area.id] = 'voting';
        } else {
          newStatusMap[area.id] = 'empty';
        }
      });

      setAreaStatusMap(newStatusMap);
    } catch (err) {
      console.error("Error fetching quick stats:", err);
    }
  };


  // --- FETCH REAL-TIME DATA KHI XEM BÁO CÁO CHI TIẾT ---
  useEffect(() => {
    if (viewingReport) {
      fetchReportDetails(viewingReport);
    }
  }, [viewingReport]);

  const fetchReportDetails = async (report: ElectionReport) => {
    setLoadingDetails(true);
    try {
      let targetAreaIds: string[] = [];

      // 1. Xác định danh sách KVBP cần tổng hợp
      if (report.level === 'area') {
        targetAreaIds = [report.targetId];
      } else if (report.level === 'unit') {
        targetAreaIds = AN_PHU_LOCATIONS
          .filter(l => l.type === 'area' && l.parentId === report.targetId)
          .map(l => l.id);
      } else if (report.level === 'ward') {
        targetAreaIds = AN_PHU_LOCATIONS
          .filter(l => l.type === 'area')
          .map(l => l.id);
      }

      // 2. Lấy thống kê chung (Area Stats) - Nơi chứa thông tin khóa sổ
      const { data: statsData } = await supabase
        .from('area_stats')
        .select('*')
        .in('area_id', targetAreaIds);

      // 3. Lấy kết quả phiếu bầu (Voting Results)
      const { data: resultsData } = await supabase
        .from('voting_results')
        .select('candidate_id, votes')
        .in('area_id', targetAreaIds);

      // 4. Lấy danh sách ứng viên (để map tên)
      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('id, name, unit_id');

      // --- TỔNG HỢP SỐ LIỆU ---
      const aggStats = {
        totalVoters: 0,
        issuedVotes: 0,
        receivedVotes: 0,
        validVotes: 0,
        invalidVotes: 0
      };

      // Logic check khóa sổ: Nếu TẤT CẢ các area con đều đã khóa -> Báo cáo này coi như đã khóa
      let lockedCount = 0;

      if (statsData && statsData.length > 0) {
        statsData.forEach(s => {
          aggStats.totalVoters += (s.total_voters || 0);
          aggStats.issuedVotes += (s.issued_votes || 0);
          aggStats.receivedVotes += (s.received_votes || 0);
          aggStats.validVotes += (s.valid_votes || 0);
          aggStats.invalidVotes += (s.invalid_votes || 0);
          if (s.is_locked) lockedCount++;
        });
      }

      // Fallback: Nếu chưa có stats (chưa nhập liệu), đếm từ bảng voters cho totalVoters
      if (aggStats.totalVoters === 0) {
        const { count } = await supabase
          .from('voters')
          .select('*', { count: 'exact', head: true })
          .in('area_id', targetAreaIds);
        aggStats.totalVoters = count || 0;
      }

      // Quyết định trạng thái khóa của báo cáo
      const isReportLocked = targetAreaIds.length > 0 && lockedCount === targetAreaIds.length;

      // --- TỔNG HỢP ỨNG VIÊN ---
      const candidateMap: Record<string, number> = {};
      if (resultsData) {
        resultsData.forEach(r => {
          candidateMap[r.candidate_id] = (candidateMap[r.candidate_id] || 0) + r.votes;
        });
      }

      // Filter candidates
      let relevantCandidates = candidatesData || [];
      if (report.level === 'unit') {
        relevantCandidates = relevantCandidates.filter(c => c.unit_id === report.targetId);
      } else if (report.level === 'area') {
        const areaNode = AN_PHU_LOCATIONS.find(l => l.id === report.targetId);
        if (areaNode && areaNode.parentId) {
          relevantCandidates = relevantCandidates.filter(c => c.unit_id === areaNode.parentId);
        }
      }

      const finalCandidates = relevantCandidates.map(c => ({
        id: c.id,
        name: c.name,
        votes: candidateMap[c.id] || 0,
        percentage: aggStats.validVotes > 0 ? ((candidateMap[c.id] || 0) / aggStats.validVotes * 100) : 0
      })).sort((a, b) => b.votes - a.votes);

      setReportDetailData({
        stats: aggStats,
        candidates: finalCandidates,
        isLocked: isReportLocked
      });

      // Cập nhật lại thông tin hiển thị trên ViewingReport để khớp số liệu mới nhất
      setViewingReport(prev => prev ? {
        ...prev,
        totalVoters: aggStats.totalVoters,
        votedVoters: aggStats.receivedVotes,
        // Nếu phát hiện đã khóa, cập nhật trạng thái UI
        status: isReportLocked ? 'locked' : prev.status === 'locked' ? 'confirmed' : prev.status
      } : null);

    } catch (error) {
      console.error("Error fetching report details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportDetailData || !viewingReport) return;

    // 1. Prepare Stats Sheet
    const statsData = [
      ['HỘI ĐỒNG BẦU CỬ QUỐC GIA'],
      ['ỦY BAN BẦU CỬ PHƯỜNG AN PHÚ'],
      [''],
      [viewingReport.title.toUpperCase()],
      ['Kỳ bầu cử khóa 2026 - 2031'],
      [''],
      ['I. SỐ LIỆU CỬ TRI VÀ PHIẾU BẦU'],
      ['Tổng số cử tri niêm yết', reportDetailData.stats.totalVoters],
      ['Số phiếu phát ra', reportDetailData.stats.issuedVotes],
      ['Số phiếu thu về', reportDetailData.stats.receivedVotes],
      ['Số phiếu hợp lệ', reportDetailData.stats.validVotes],
      ['Số phiếu không hợp lệ', reportDetailData.stats.invalidVotes],
      [''],
      ['II. KẾT QUẢ KIỂM PHIẾU ỨNG CỬ VIÊN'],
      ['STT', 'Họ tên ứng cử viên', 'Số phiếu', 'Tỷ lệ (%)']
    ];

    reportDetailData.candidates.forEach((c, idx) => {
      statsData.push([idx + 1, c.name, c.votes, c.percentage.toFixed(2) + '%']);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Ket Qua');
    XLSX.writeFile(wb, `${viewingReport.code}_${viewingReport.targetId}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!reportDetailData || !viewingReport) return;

    const doc = new jsPDF();

    // Note: Default jspdf doesn't support Vietnamese without custom font.
    // Using ASCII for demo, encouraging browser print for full formatting.

    doc.setFontSize(10);
    doc.text('HOI DONG BAU CU QUOC GIA', 20, 20);
    doc.text('UY BAN BAU CU PHUONG AN PHU', 20, 25);
    doc.text('---------------------', 20, 28);

    doc.setFontSize(14);
    doc.text(viewingReport.title.toUpperCase(), 105, 50, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Ky bau cu khoa 2026 - 2031', 105, 58, { align: 'center' });

    doc.text('I. SO LIEU CU TRI VA PHIEU BAU', 20, 75);
    const statsRows = [
      ['Tong so cu tri niem yet', reportDetailData.stats.totalVoters.toLocaleString()],
      ['So phieu phat ra', reportDetailData.stats.issuedVotes.toLocaleString()],
      ['So phieu thu ve', reportDetailData.stats.receivedVotes.toLocaleString()],
      ['So phieu hop le', reportDetailData.stats.validVotes.toLocaleString()],
      ['So phieu khong hop le', reportDetailData.stats.invalidVotes.toLocaleString()],
    ];

    autoTable(doc, {
      startY: 80,
      head: [['Hang muc', 'Gia tri']],
      body: statsRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 51, 51] }
    });

    doc.text('II. KET QUA KIEM PHIEU UNG CU VIEN', 20, (doc as any).lastAutoTable.finalY + 15);

    const candidateRows = reportDetailData.candidates.map((c, idx) => [
      idx + 1,
      c.name,
      c.votes.toLocaleString(),
      c.percentage.toFixed(2) + '%'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['STT', 'Ho va ten', 'So phieu', 'Ty le (%)']],
      body: candidateRows,
      theme: 'striped'
    });

    doc.save(`${viewingReport.code}_${viewingReport.targetId}.pdf`);
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesScope = filterScope === 'all' || r.level === filterScope;
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchesScope && matchesStatus;
    });
  }, [filterScope, filterStatus, reports]);

  // --- HELPERS ---
  const getStatusBadge = (status: ReportStatus) => {
    const configs = {
      ready: { label: 'Sẵn sàng', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
      updating: { label: 'Đang cập nhật', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
      confirmed: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-600' },
      draft: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-400' },
      locked: { label: 'Bị khóa / Quá hạn', color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-600' },
    };
    const s = configs[status];
    return (
      <span className={`px-2.5 py-1.5 rounded-lg border font-black uppercase text-[10px] tracking-widest inline-flex items-center gap-2 ${s.color}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'updating' ? 'animate-pulse' : ''}`}></span>
        {s.label}
      </span>
    );
  };

  const getScopeLabel = (level: FilterScope) => {
    const map = { ward: 'Phường', neighborhood: 'Khu phố', unit: 'Đơn vị', area: 'KVBC' };
    return map[level];
  };

  const neighborhoods = NEIGHBORHOODS;
  const availableUnits = useMemo(() => {
    if (!newReportData.neighborhood) return [];
    // Filter units that have areas in the selected neighborhood
    const relevantUnitIds = AN_PHU_LOCATIONS
      .filter(l => l.type === 'area' && l.neighborhoodId === newReportData.neighborhood)
      .map(l => l.parentId);
    return AN_PHU_LOCATIONS.filter(l => l.type === 'unit' && relevantUnitIds.includes(l.id));
  }, [newReportData.neighborhood]);
  const availableAreas = useMemo(() => {
    if (!newReportData.unit) return [];
    // Filter areas belonging to both selected unit and selected neighborhood
    return AN_PHU_LOCATIONS.filter(l =>
      l.type === 'area' &&
      l.parentId === newReportData.unit &&
      (newReportData.neighborhood ? l.neighborhoodId === newReportData.neighborhood : true)
    );
  }, [newReportData.unit, newReportData.neighborhood]);

  const isStepValid = () => {
    if (createStep === 1) return !!newReportData.template;
    if (createStep === 2) {
      const t = reportTemplates.find(x => x.code === newReportData.template);
      if (!newReportData.neighborhood && t?.levelScope !== 'ward') return false; // Basic cascade start

      if (t?.levelScope === 'unit' && !newReportData.unit) return false;
      if (t?.levelScope === 'area' && (!newReportData.unit || !newReportData.area)) return false;

      return true;
    }
    return true;
  };

  const handleCreateDraft = () => {
    const template = reportTemplates.find(t => t.code === newReportData.template);
    if (!template) return;

    let targetId = '';
    let level: FilterScope = 'ward';
    let titleDetail = '';

    if (template.levelScope === 'area') {
      if (!newReportData.area) { showNotification('Vui lòng chọn Khu vực bỏ phiếu'); return; }
      targetId = newReportData.area;
      level = 'area';
      titleDetail = AN_PHU_LOCATIONS.find(l => l.id === targetId)?.name || targetId;
    } else if (template.levelScope === 'unit') {
      if (!newReportData.unit) { showNotification('Vui lòng chọn Đơn vị bầu cử'); return; }
      targetId = newReportData.unit;
      level = 'unit';
      titleDetail = AN_PHU_LOCATIONS.find(l => l.id === targetId)?.name || targetId;
    } else {
      targetId = 'ap';
      level = 'ward';
      titleDetail = 'Toàn Phường';
    }

    const newReport: ElectionReport = {
      id: Date.now().toString(),
      code: newReportData.template,
      title: `${template.title} (${titleDetail})`,
      level: level,
      targetId: targetId,
      status: 'draft',
      progress: 0,
      lastUpdated: 'Vừa tạo',
      author: 'Admin',
      description: `Báo cáo khởi tạo thủ công cho ${titleDetail}`,
      totalVoters: 0, // Sẽ được tính khi view
      votedVoters: 0,
      cutoffTime: new Date().toLocaleTimeString('vi-VN') + ' - ' + new Date().toLocaleDateString('vi-VN')
    };
    setReports(prev => [newReport, ...prev]);
    setIsCreating(false);
    setCreateStep(1);
    setNewReportData({ template: '', neighborhood: '', unit: '', area: '' });
  };

  return (
    <div className={`space-y-8 pb-32 animate-in fade-in duration-500 ${isLargeText ? 'text-lg' : 'text-base'}`}>

      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-primary pb-6">
        <div>
          <h1 className={`${isLargeText ? 'text-4xl' : 'text-3xl'} font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none`}>Hồ sơ, Mẫu biểu & Biên bản</h1>
          <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-admin-red animate-pulse"></span>
            Hệ thống Quản trị Bầu cử GovTech An Phú 2026
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickStats(!showQuickStats)}
            className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-primary">analytics</span>
            Xem nhanh tiến độ KVBP
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-2xl">post_add</span>
            + Khởi tạo báo cáo
          </button>
        </div>
      </div>

      {/* QUICK STATS PANEL (45 KVBP) */}
      {showQuickStats && (
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border-4 border-primary/30 shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
            <h3 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">speed</span>
              Trạng thái hoàn thành thực tế 45 Khu vực bỏ phiếu (KVBP)
            </h3>
            <button onClick={() => setShowQuickStats(false)} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-15 gap-2">
            {AN_PHU_LOCATIONS.filter(l => l.type === 'area').map((area) => {
              // Real-time status logic
              const status = areaStatusMap[area.id] || 'empty';

              return (
                <div key={area.id} className={`p-2 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' :
                  status === 'empty' ? 'bg-slate-800 border-slate-700 text-slate-600' :
                    'bg-amber-500/20 border-amber-500 text-amber-500'
                  }`} title={area.name}>
                  <p className="text-[9px] font-black">{area.id.toUpperCase().replace('KV', '')}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-2 text-emerald-500"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Đã khóa sổ (Hoàn tất)</div>
            <div className="flex items-center gap-2 text-amber-500"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Đang bầu (Chưa khóa)</div>
            <div className="flex items-center gap-2 text-slate-500"><span className="w-3 h-3 rounded-full bg-slate-500"></span> Chưa bắt đầu</div>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border-2 border-slate-100 dark:border-slate-800 shadow-xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phạm vi văn bản:</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'ward', 'neighborhood', 'unit', 'area'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterScope(s as any)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 transition-all ${filterScope === s ? 'bg-primary text-white border-primary shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {s === 'all' ? 'Tất cả' : getScopeLabel(s as any)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái hồ sơ:</label>
            <div className="flex flex-wrap gap-2">
              {['all', 'ready', 'updating', 'confirmed', 'draft', 'locked'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s as any)}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border-2 transition-all ${filterStatus === s ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {s === 'all' ? 'Tất cả' : s === 'ready' ? 'Sẵn sàng' : s === 'updating' ? 'Cập nhật' : s === 'confirmed' ? 'Xác nhận' : s === 'draft' ? 'Nháp' : 'Khóa'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BẢNG BÁO CÁO */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] border-b-4 border-primary">
                <th className="px-6 py-6 w-24 border-r border-slate-800 text-center">Mã mẫu</th>
                <th className="px-8 py-6 min-w-[320px]">Tên văn bản / báo cáo</th>
                <th className="px-6 py-6 text-center">Phạm vi</th>
                <th className="px-6 py-6 text-center">Trạng thái</th>
                <th className="px-6 py-6 text-center w-40">Cập nhật</th>
                <th className="px-6 py-6 text-center">Phụ trách</th>
                <th className="px-6 py-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100 dark:divide-slate-800">
              {filteredReports.map((report) => (
                <tr key={report.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                  <td className="px-6 py-8 border-r border-slate-50 dark:border-slate-800 text-center">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">{report.code}</span>
                  </td>
                  <td className="px-8 py-8">
                    <p className={`font-black text-slate-900 dark:text-white uppercase leading-tight tracking-tight group-hover:text-primary transition-colors ${isLargeText ? 'text-lg' : 'text-sm'}`}>{report.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase italic tracking-wide">{report.description}</p>
                      <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">schedule</span> Chốt: {report.cutoffTime}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{getScopeLabel(report.level)}</span>
                  </td>
                  <td className="px-6 py-8 text-center whitespace-nowrap">
                    {getStatusBadge(report.status)}
                  </td>
                  <td className="px-6 py-8 text-center whitespace-nowrap">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{report.lastUpdated}</p>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{report.author}</p>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setViewingReport(report)} className="size-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-primary hover:text-white transition-all border border-slate-200" title="👁 Xem chi tiết & Số liệu">
                        <span className="material-symbols-outlined text-xl">visibility</span>
                      </button>
                      <button disabled={report.status === 'locked'} className="size-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all border border-slate-200 disabled:opacity-30" title="✏️ Soạn thảo">
                        <span className="material-symbols-outlined text-xl">edit_square</span>
                      </button>
                      <button className="size-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100" title="📄 Xuất Word (Chuẩn NĐ30)">
                        <span className="material-symbols-outlined text-xl">description</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <div className="p-10 text-center text-slate-400 italic">Chưa có báo cáo nào được tạo.</div>
          )}
        </div>
      </div>

      {/* MODAL KHỞI TẠO BÁO CÁO MỚI (4 BƯỚC) */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl border-4 border-primary overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header Modal */}
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center border-b-4 border-primary">
              <div className="flex items-center gap-5">
                <div className="size-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-4xl">post_add</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Khởi tạo biên bản bầu cử</h2>
                  <p className="text-primary text-[10px] font-black uppercase tracking-widest mt-1">Hệ thống gán dữ liệu cử tri tự động</p>
                </div>
              </div>
              <button onClick={() => { setIsCreating(false); setCreateStep(1); }} className="size-12 rounded-xl bg-white/10 hover:bg-admin-red flex items-center justify-center transition-all group">
                <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">close</span>
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="px-10 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm border-2 transition-all ${createStep === s ? 'bg-primary border-primary text-white shadow-lg scale-110' : createStep > s ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                    {createStep > s ? <span className="material-symbols-outlined">check</span> : s}
                  </div>
                  {s < 4 && <div className={`w-12 h-1 rounded-full transition-all ${createStep > s ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>}
                </div>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-10 flex-1 overflow-y-auto min-h-[400px] custom-scrollbar">
              {/* B1. CHỌN LOẠI MẪU */}
              {createStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-l-4 border-primary pl-3">B1. Chọn loại mẫu mẫu văn bản công vụ:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportTemplates.map((t) => (
                      <button
                        key={t.code}
                        onClick={() => setNewReportData({ ...newReportData, template: t.code })}
                        className={`p-6 rounded-2xl border-4 text-left transition-all ${newReportData.template === t.code ? 'bg-primary/5 border-primary shadow-xl' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                      >
                        <p className={`font-black uppercase tracking-tight ${newReportData.template === t.code ? 'text-primary' : 'text-slate-900'}`}>{t.code}</p>
                        <p className="text-sm font-bold text-slate-500 mt-2 leading-snug">{t.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* B2. CHỌN ĐỊA GIỚI */}
              {createStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-primary pl-3">B2. Xác định phạm vi áp dụng (Khu phố/Tổ/KVBC):</h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Khu phố:</label>
                        <select
                          value={newReportData.neighborhood}
                          onChange={(e) => setNewReportData({ ...newReportData, neighborhood: e.target.value, unit: '', area: '' })}
                          className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:border-primary transition-all"
                        >
                          <option value="">-- Chọn Khu phố --</option>
                          {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tổ bầu cử (Đơn vị):</label>
                        <select
                          disabled={!newReportData.neighborhood}
                          value={newReportData.unit}
                          onChange={(e) => setNewReportData({ ...newReportData, unit: e.target.value, area: '' })}
                          className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:border-primary transition-all disabled:opacity-30"
                        >
                          <option value="">-- Chọn Tổ bầu cử --</option>
                          {availableUnits.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Khu vực bầu cử (KVBP):</label>
                      <select
                        disabled={!newReportData.unit}
                        value={newReportData.area}
                        onChange={(e) => setNewReportData({ ...newReportData, area: e.target.value })}
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:border-primary transition-all disabled:opacity-30"
                      >
                        <option value="">-- Chọn Khu vực bỏ phiếu --</option>
                        {availableAreas.map(a => <option key={a.id} value={a.id}>{a.id.toUpperCase()} - {a.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* B3. TỰ ĐỘNG GÁN DỮ LIỆU */}
              {createStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-primary pl-3">B3. Hệ thống tự động gán dữ liệu đối soát:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] space-y-3 shadow-sm animate-in zoom-in-95 duration-500">
                      <span className="material-symbols-outlined text-4xl text-blue-600">groups</span>
                      <p className="text-3xl font-black text-blue-900 leading-none">AUTO</p>
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-2">Cử tri khớp nối</p>
                    </div>
                    <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-[2rem] space-y-3 shadow-sm animate-in zoom-in-95 duration-500 delay-100">
                      <span className="material-symbols-outlined text-4xl text-amber-600">person_check</span>
                      <p className="text-3xl font-black text-amber-900 leading-none">AUTO</p>
                      <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-2">Ứng cử viên gán sẵn</p>
                    </div>
                    <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] space-y-3 shadow-sm animate-in zoom-in-95 duration-500 delay-200">
                      <span className="material-symbols-outlined text-4xl text-emerald-600">database</span>
                      <p className="text-3xl font-black text-emerald-900 leading-none">SYNC</p>
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-2">Số liệu theo tổ OK</p>
                    </div>
                  </div>
                </div>
              )}

              {/* B4. TẠO BẢN NHÁP */}
              {createStep === 4 && (
                <div className="text-center py-10 space-y-8 animate-in fade-in zoom-in-95">
                  <div className="size-32 bg-emerald-100 text-emerald-600 rounded-[3rem] border-4 border-emerald-200 flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                    <span className="material-symbols-outlined text-7xl font-black">verified</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Sẵn sàng khởi tạo bản nháp</h3>
                    <p className="text-sm font-bold text-slate-500 max-w-md mx-auto leading-relaxed">Hồ sơ sẽ được lưu vào hệ thống ở trạng thái "Bản nháp". Bạn có thể truy cập để cập nhật số liệu và chốt biên bản sau khi kiểm phiếu.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="bg-slate-50 p-8 border-t-2 border-slate-100 flex justify-between gap-4">
              <button
                onClick={() => setCreateStep(Math.max(1, createStep - 1))}
                className={`px-8 py-4 border-2 border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-white transition-all ${createStep === 1 ? 'invisible' : ''}`}
              >Quay lại</button>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-8 py-4 border-2 border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-white transition-all"
                >Hủy bỏ</button>

                {createStep < 4 ? (
                  <button
                    disabled={!isStepValid()}
                    onClick={() => setCreateStep(createStep + 1)}
                    className="px-12 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-30 disabled:grayscale"
                  >
                    Tiếp tục
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCreateDraft}
                    className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-black/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-2xl">save</span>
                    Khởi tạo bản nháp ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL - REAL TIME AGGREGATION */}
      {viewingReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[94vh] rounded-[3rem] shadow-2xl border-4 border-primary overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            {/* Header Modal */}
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-5">
                <div className="size-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-4xl">description</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Xem trước văn bản công vụ</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-primary text-[11px] font-black uppercase tracking-widest">Mã hiệu: {viewingReport.code} | {getScopeLabel(viewingReport.level)}</p>
                    {reportDetailData?.isLocked && (
                      <span className="px-2 py-0.5 bg-admin-red text-white text-[9px] font-black uppercase rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">lock</span> Đã khóa sổ
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingReport(null)} className="size-16 rounded-2xl bg-white/10 hover:bg-admin-red flex items-center justify-center transition-all border border-white/10 group shadow-inner">
                <span className="material-symbols-outlined text-4xl group-hover:rotate-90 transition-transform">close</span>
              </button>
            </div>

            {/* Document Body */}
            <div className="flex-1 overflow-y-auto bg-slate-200 p-16 flex justify-center custom-scrollbar">
              <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[30mm] shadow-2xl relative text-slate-900 font-sans leading-normal select-none">

                {loadingDetails ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                      <span className="material-symbols-outlined text-6xl text-slate-300 animate-spin">sync</span>
                      <p className="font-bold text-slate-400 uppercase">Đang tổng hợp số liệu thực tế...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Administrative Header */}
                    <div className="flex justify-between items-start mb-10">
                      <div className="text-center w-5/12">
                        <p className="text-sm font-extrabold uppercase leading-tight">HỘI ĐỒNG BẦU CỬ QUỐC GIA</p>
                        <p className="text-sm font-extrabold uppercase leading-tight">ỦY BAN BẦU CỬ PHƯỜNG AN PHÚ</p>
                        <div className="w-24 h-[1px] bg-slate-900 mx-auto mt-2"></div>
                      </div>
                      <div className="text-center w-6/12">
                        <p className="text-sm font-extrabold uppercase leading-tight">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p className="text-sm font-bold leading-tight">Độc lập - Tự do - Hạnh phúc</p>
                        <div className="w-40 h-[1px] bg-slate-900 mx-auto mt-2"></div>
                        <p className="text-xs italic mt-6">An Phú, ngày ... tháng 05 năm 2026</p>
                      </div>
                    </div>

                    <div className="text-center space-y-4 mb-10">
                      <h2 className="text-2xl font-black uppercase tracking-tight leading-snug">{viewingReport.title.toUpperCase()}</h2>
                      <p className="text-base font-bold italic text-slate-500">Kỳ bầu cử khóa 2026 - 2031</p>
                    </div>

                    <div className="space-y-4 text-base text-justify font-sans mb-8">
                      <p>Căn cứ Luật Bầu cử đại biểu Quốc hội và đại biểu Hội đồng nhân dân số 85/2015/QH13;</p>
                      <p>Hôm nay, vào hồi ..... giờ ..... phút, ngày .... tháng .... năm 2026, tại địa điểm {viewingReport.level === 'area' ? 'Khu vực bỏ phiếu ' + viewingReport.targetId.toUpperCase() : 'Phường An Phú'}.</p>
                      <p>Chúng tôi gồm: ..................................................................................................</p>
                    </div>

                    {/* PART 1: Voter Stats */}
                    <div className="mb-8">
                      <h3 className="text-lg font-black uppercase border-b-2 border-slate-900 mb-4 pb-1">I. Số liệu cử tri và phiếu bầu</h3>
                      <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
                        <p className="font-medium">1. Tổng số cử tri niêm yết:</p> <p className="text-right font-black">{reportDetailData?.stats.totalVoters.toLocaleString()}</p>
                        <p className="font-medium">2. Số phiếu phát ra:</p> <p className="text-right font-black">{reportDetailData?.stats.issuedVotes.toLocaleString()}</p>
                        <p className="font-medium">3. Số phiếu thu về:</p> <p className="text-right font-black">{reportDetailData?.stats.receivedVotes.toLocaleString()}</p>
                        <p className="font-medium">4. Số phiếu hợp lệ:</p> <p className="text-right font-black text-emerald-700">{reportDetailData?.stats.validVotes.toLocaleString()}</p>
                        <p className="font-medium">5. Số phiếu không hợp lệ:</p> <p className="text-right font-black text-admin-red">{reportDetailData?.stats.invalidVotes.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* PART 2: Candidate Results */}
                    <div className="mb-8">
                      <h3 className="text-lg font-black uppercase border-b-2 border-slate-900 mb-4 pb-1">II. Kết quả kiểm phiếu ứng cử viên</h3>
                      <table className="w-full text-sm border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-300 p-2 text-center w-12">STT</th>
                            <th className="border border-slate-300 p-2 text-left">Họ và tên người ứng cử</th>
                            <th className="border border-slate-300 p-2 text-center">Số phiếu</th>
                            <th className="border border-slate-300 p-2 text-center">Tỷ lệ (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportDetailData?.candidates.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center italic">Chưa có dữ liệu kiểm phiếu</td></tr>
                          ) : (
                            reportDetailData?.candidates.map((c, idx) => (
                              <tr key={c.id}>
                                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 p-2 font-bold uppercase">{c.name}</td>
                                <td className="border border-slate-300 p-2 text-center font-bold">{c.votes.toLocaleString()}</td>
                                <td className="border border-slate-300 p-2 text-center">{c.percentage.toFixed(2)}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-16 grid grid-cols-2 gap-10 font-sans">
                      <div className="text-center space-y-24">
                        <p className="font-black uppercase text-sm">THƯ KÝ</p>
                        <p className="font-extrabold text-slate-300 italic">(Ký, ghi rõ họ tên)</p>
                      </div>
                      <div className="text-center space-y-24">
                        <p className="font-black uppercase text-sm">TỔ TRƯỞNG TỔ BẦU CỬ</p>
                        <p className="font-extrabold text-slate-300 italic">(Ký, ghi rõ họ tên)</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div className="bg-slate-50 p-10 border-t-2 border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-xl flex items-center justify-center ${reportDetailData?.isLocked ? 'bg-admin-red' : 'bg-primary'} text-white shadow-lg`}>
                  <span className="material-symbols-outlined text-primary-content">print_connect</span>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">Cổng xuất bản:</p>
                  <p className={`text-sm font-black uppercase mt-1 ${reportDetailData?.isLocked ? 'text-admin-red' : 'text-primary'}`}>Máy in văn phòng (An Phú Hub)</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleExportExcel} className="px-6 py-5 border-2 border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined">table_chart</span>
                  Excel
                </button>
                <button onClick={handleExportPDF} className="px-6 py-5 border-2 border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-red-600 hover:bg-red-50 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  PDF (Draft)
                </button>
                <button onClick={() => window.print()} className={`px-12 py-5 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 ${reportDetailData?.isLocked ? 'bg-admin-red shadow-red-500/30' : 'bg-primary shadow-primary/30'}`}>
                  <span className="material-symbols-outlined text-2xl">print</span>
                  Xác nhận & In văn bản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};