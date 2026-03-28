export interface ClinicRef {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  organizationId?: number | null;
  createdAt?: string | null;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string | null;
    organizationId?: number | null;
    clinicId?: number | null;
    clinics?: ClinicRef[] | null;
  };
}

