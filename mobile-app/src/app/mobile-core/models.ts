export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string | null;
    organizationId?: number | null;
    clinicId?: number | null;
    clinics?: Array<{ id: number; name: string }> | null;
  };
}

export interface AuthSession {
  token: string;
  user: LoginResponse['user'];
}

export interface DashboardSummary {
  patients: number;
  appointments: number;
  totalIncome: number;
  balance: number;
  pendingComplaints: number;
}
