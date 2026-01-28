
export type PageType = 'dashboard' | 'candidates' | 'voters' | 'voter-import' | 'data-entry' | 'calculation' | 'reports' | 'accounts' | 'logs' | 'design-system';

export type ResidenceStatus = 'thuong-tru' | 'tam-tru' | 'tam-vang' | 'lam-an-xa' | 'hoc-xa' | 'da-chuyen-di' | 'moi-chuyen-den' | 'khac';
export type VotingStatus = 'chua-bau' | 'da-bau' | 'khong-bau';

/**
 * LocationNode
 */
export interface LocationNode {
  id: string;
  name: string;
  parentId?: string;
  type: 'ward' | 'neighborhood' | 'unit' | 'area';
  locationDetail?: string;
  neighborhoodIds?: string[]; // Đã cập nhật để hỗ trợ nhiều khu phố
  groups?: string; // Optional: Danh sách các tổ dân phố (nếu có)
}

/**
 * Voter Entity
 */
export interface Voter {
  id: string;
  name: string;
  dob: string;
  gender: 'Nam' | 'Nữ';
  cccd: string;
  voterCardNumber: string;
  address: string;
  neighborhoodId: string;
  unitId: string;
  areaId: string;
  residenceStatus: ResidenceStatus;
  residenceNote?: string;
  votingStatus: VotingStatus;
  status: 'hop-le' | 'loi' | 'trung';
  ethnic?: string; // Thêm trường Dân tộc
}

export interface LogEntry {
  id: string;
  time: string;
  user: string;
  action: string;
  details: string;
  ip: string;
  status: 'success' | 'failure';
}

// DANH SÁCH 36 KHU PHỐ
export const NEIGHBORHOODS = Array.from({ length: 36 }, (_, i) => ({
  id: `kp_${i + 1}`,
  name: `Khu phố ${i + 1}`
}));

// 8 Đơn vị bầu cử, 32 Khu vực bỏ phiếu
export const WARD_LOCATIONS: LocationNode[] = [
  // WEB ROOT
  { id: 'bc', name: 'Phường Bàn Cờ', type: 'ward' },

  // --- UNIT 1 (Khu phố 2, 3, 4, 5, 6, 7) ---
  { id: 'unit_1', name: 'Đơn vị số 1', parentId: 'bc', type: 'unit' },
  { id: 'kv01', name: 'Khu vực bỏ phiếu số 01', parentId: 'unit_1', type: 'area', neighborhoodIds: ['kp_2', 'kp_3'], locationDetail: '175/4-6 Nguyễn Thiện Thuật (Trạm Y tế phường 1 cũ)' },
  { id: 'kv02', name: 'Khu vực bỏ phiếu số 02', parentId: 'unit_1', type: 'area', neighborhoodIds: ['kp_4', 'kp_7'], locationDetail: 'Trường Mầm non 1 (611/10-12 Điện Biên Phủ)' },
  { id: 'kv03', name: 'Khu vực bỏ phiếu số 03', parentId: 'unit_1', type: 'area', neighborhoodIds: ['kp_5', 'kp_6'], locationDetail: 'Trường THCS Phan Sào Nam (số 657-659 Điện Biên Phủ)' },

  // --- UNIT 2 (Khu phố 1, 8, 9) ---
  { id: 'unit_2', name: 'Đơn vị số 2', parentId: 'bc', type: 'unit' },
  { id: 'kv04', name: 'Khu vực bỏ phiếu số 04', parentId: 'unit_2', type: 'area', neighborhoodIds: ['kp_1'], locationDetail: 'Trường Tiểu học Nguyễn Thiện Thuật - cơ sở 2 (175/49 Nguyễn Thiện Thuật)' },
  { id: 'kv05', name: 'Khu vực bỏ phiếu số 05', parentId: 'unit_2', type: 'area', neighborhoodIds: ['kp_8'], locationDetail: 'Trường THCS Thăng Long (482 Nguyễn Thị Minh Khai)' },
  { id: 'kv06', name: 'Khu vực bỏ phiếu số 06', parentId: 'unit_2', type: 'area', neighborhoodIds: ['kp_9'], locationDetail: 'Trường THCS Thăng Long (482 Nguyễn Thị Minh Khai)' },

  // --- UNIT 3 (Khu phố 10, 11, 12, 13) ---
  { id: 'unit_3', name: 'Đơn vị số 3', parentId: 'bc', type: 'unit' },
  { id: 'kv07', name: 'Khu vực bỏ phiếu số 07', parentId: 'unit_3', type: 'area', neighborhoodIds: ['kp_10'], locationDetail: 'Trường Tiểu học Phan Đình Phùng - Cơ sở 1 (491/7 Nguyễn Đình Chiểu)' },
  { id: 'kv08', name: 'Khu vực bỏ phiếu số 08', parentId: 'unit_3', type: 'area', neighborhoodIds: ['kp_11'], locationDetail: 'Trường THCS Thăng Long (482 Nguyễn Thị Minh Khai)' },
  { id: 'kv09', name: 'Khu vực bỏ phiếu số 09', parentId: 'unit_3', type: 'area', neighborhoodIds: ['kp_12'], locationDetail: 'Trường Tiểu học Phan Đình Phùng - Cơ sở 1 (491/7 Nguyễn Đình Chiểu)' },
  { id: 'kv10', name: 'Khu vực bỏ phiếu số 10', parentId: 'unit_3', type: 'area', neighborhoodIds: ['kp_13'], locationDetail: 'Trường Mầm non 2 (481-483 Nguyễn Đình Chiểu)' },

  // --- UNIT 4 (Khu phố 14, 15, 16, 17) ---
  { id: 'unit_4', name: 'Đơn vị số 4', parentId: 'bc', type: 'unit' },
  { id: 'kv11', name: 'Khu vực bỏ phiếu số 11', parentId: 'unit_4', type: 'area', neighborhoodIds: ['kp_14'], locationDetail: 'Trường Mầm non 3 - Cơ sở 2 (144A Nguyễn Thiện Thuật)' },
  { id: 'kv12', name: 'Khu vực bỏ phiếu số 12', parentId: 'unit_4', type: 'area', neighborhoodIds: ['kp_15'], locationDetail: 'Trường Tiểu học Nguyễn Sơn Hà (55A Cao Thắng)' },
  { id: 'kv13', name: 'Khu vực bỏ phiếu số 13', parentId: 'unit_4', type: 'area', neighborhoodIds: ['kp_16'], locationDetail: 'Trường Mầm non 3- Cơ sở 1 (202 Nguyễn Thiện Thuật)' },
  { id: 'kv14', name: 'Khu vực bỏ phiếu số 14', parentId: 'unit_4', type: 'area', neighborhoodIds: ['kp_17'], locationDetail: 'Trường Mầm non 3- Cơ sở 1 (202 Nguyễn Thiện Thuật)' },

  // --- UNIT 5 (Khu phố 18, 19, 20, 22, 23) ---
  { id: 'unit_5', name: 'Đơn vị số 5', parentId: 'bc', type: 'unit' },
  { id: 'kv15', name: 'Khu vực bỏ phiếu số 15', parentId: 'unit_5', type: 'area', neighborhoodIds: ['kp_18'], locationDetail: 'Trường Tiểu học Nguyễn Sơn Hà (55A Cao Thắng)' },
  { id: 'kv16', name: 'Khu vực bỏ phiếu số 16', parentId: 'unit_5', type: 'area', neighborhoodIds: ['kp_19'], locationDetail: 'Trường Tiểu học Lương Định Của - Cơ sở 1 (576 Nguyễn Đình Chiểu)' },
  { id: 'kv17', name: 'Khu vực bỏ phiếu số 17', parentId: 'unit_5', type: 'area', neighborhoodIds: ['kp_20'], locationDetail: 'Trường Mầm non 4 (84A Cao Thắng)' },
  { id: 'kv18', name: 'Khu vực bỏ phiếu số 18', parentId: 'unit_5', type: 'area', neighborhoodIds: ['kp_22'], locationDetail: 'Trường THCS Bàn Cờ, số 16 đường số 3, cư xá Đô Thành' },
  { id: 'kv19', name: 'Khu vực bỏ phiếu số 19', parentId: 'unit_5', type: 'area', neighborhoodIds: ['kp_23'], locationDetail: 'Trường THCS Bàn Cờ, số 16 đường số 3, cư xá Đô Thành' },

  // --- UNIT 6 (Khu phố 21, 25, 26, 27, 28) ---
  { id: 'unit_6', name: 'Đơn vị số 6', parentId: 'bc', type: 'unit' },
  { id: 'kv20', name: 'Khu vực bỏ phiếu số 20', parentId: 'unit_6', type: 'area', neighborhoodIds: ['kp_21'], locationDetail: 'Trường Tiểu học Lương Định Của - Cơ sở 1 (576 Nguyễn Đình Chiểu)' },
  { id: 'kv21', name: 'Khu vực bỏ phiếu số 21', parentId: 'unit_6', type: 'area', neighborhoodIds: ['kp_25', 'kp_26'], locationDetail: 'Hợp tác xã Cẩm Tú, số 441/39/43 Nguyễn Đình Chiểu' },
  { id: 'kv22', name: 'Khu vực bỏ phiếu số 22', parentId: 'unit_6', type: 'area', neighborhoodIds: ['kp_27'], locationDetail: '405 Võ Văn Tần (Công an Phường 5 cũ)' },
  { id: 'kv23', name: 'Khu vực bỏ phiếu số 23', parentId: 'unit_6', type: 'area', neighborhoodIds: ['kp_28'], locationDetail: 'Trường Mầm non 5 - Cơ sở 2 (số 2/25-27 Cao Thắng)' },

  // --- UNIT 7 (Khu phố 29, 30, 31, 32, 33) ---
  { id: 'unit_7', name: 'Đơn vị số 7', parentId: 'bc', type: 'unit' },
  { id: 'kv24', name: 'Khu vực bỏ phiếu số 24', parentId: 'unit_7', type: 'area', neighborhoodIds: ['kp_29'], locationDetail: 'Trường Tiểu học Phan Văn Hân (số 382/26 Nguyễn Thị Minh Khai)' },
  { id: 'kv25', name: 'Khu vực bỏ phiếu số 25', parentId: 'unit_7', type: 'area', neighborhoodIds: ['kp_30'], locationDetail: 'Trường THCS Kiến Thiết, số 223/4 Nguyễn Đình Chiểu' },
  { id: 'kv26', name: 'Khu vực bỏ phiếu số 26', parentId: 'unit_7', type: 'area', neighborhoodIds: ['kp_31'], locationDetail: 'Trường Tiểu học Phan Văn Hân (số 382/26 Nguyễn Thị Minh Khai)' },
  { id: 'kv27', name: 'Khu vực bỏ phiếu số 27', parentId: 'unit_7', type: 'area', neighborhoodIds: ['kp_32'], locationDetail: 'Trường THCS Kiến Thiết, số 223/4 Nguyễn Đình Chiểu' },
  { id: 'kv28', name: 'Khu vực bỏ phiếu số 28', parentId: 'unit_7', type: 'area', neighborhoodIds: ['kp_33'], locationDetail: 'Trung tâm Cung ứng dịch vụ Văn hóa - Thể thao phường Xuân Hòa (Cơ sở 185 Cách Mạng Tháng Tám)' },

  // --- UNIT 8 (Khu phố 24, 34, 35, 36) ---
  { id: 'unit_8', name: 'Đơn vị số 8', parentId: 'bc', type: 'unit' },
  { id: 'kv29', name: 'Khu vực bỏ phiếu số 29', parentId: 'unit_8', type: 'area', neighborhoodIds: ['kp_24'], locationDetail: 'Trường Tiểu học Lương Định Của (Cơ sở 2), số 132/9 Vườn Chuối' },
  { id: 'kv30', name: 'Khu vực bỏ phiếu số 30', parentId: 'unit_8', type: 'area', neighborhoodIds: ['kp_34'], locationDetail: 'Trung tâm Cung ứng dịch vụ Văn hóa - Thể thao phường Xuân Hòa (Cơ sở 185 Cách Mạng Tháng Tám)' },
  { id: 'kv31', name: 'Khu vực bỏ phiếu số 31', parentId: 'unit_8', type: 'area', neighborhoodIds: ['kp_35'], locationDetail: 'Trường Mầm non 4, số 317 Điện Biên Phủ' },
  { id: 'kv32', name: 'Khu vực bỏ phiếu số 32', parentId: 'unit_8', type: 'area', neighborhoodIds: ['kp_36'], locationDetail: 'Trường Mầm non 4, số 317 Điện Biên Phủ' },
];
