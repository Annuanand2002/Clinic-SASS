import { Component, HostListener, OnInit } from '@angular/core';
import { AuthSessionService, SELECTED_CLINIC_ALL } from '../../auth/application/auth-session.service';
import { Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, of, firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast.service';
import { InventoryApiService } from '../../../shared/inventory/inventory-api.service';
import { BillingApiService } from '../../../shared/inventory/billing-api.service';

interface SidebarItem {
  key: string;
  label: string;
  iconText: string;
  children?: SidebarItem[];
  expanded?: boolean;
}

type NotificationSection = 'email' | 'message';
type NotificationMedium = 'push' | 'email' | 'sms';

interface OrganisationSettings {
  code: string;
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  addSeal: boolean;
  logo: string;
  headerImage: string;
  footerImage: string;
  sealImage: string;
}

interface DoctorRow {
  id: number;
  userId: number;
  userAccountActive?: boolean;
  username: string;
  email: string;
  specialization: string;
  experience: number | null;
  qualification: string;
  consultationFee: number | null;
  availableTime: string;
  profileImage?: string;
}

type StaffType = 'office_staff' | 'counter_staff' | 'billing_staff' | 'security' | 'assistant' | 'other';

interface StaffRow {
  id: number;
  userId: number;
  userAccountActive?: boolean;
  username: string;
  email: string;
  staffType: StaffType;
  department: string;
  canLogin: boolean;
  isActive: boolean;
  joiningDate: string;
  salary: number | null;
  notes: string;
  profileImage?: string;
}

interface ClinicRow {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  organizationId: number | null;
  createdAt: string | null;
  doctorCount?: number;
  patientCount?: number;
}

interface PatientRow {
  id: number;
  userId: number;
  userAccountActive?: boolean;
  username: string;
  email: string;
  bloodGroup: string;
  allergies: string;
  emergencyContact: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  alternateMobile: string;
  patientEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  medicalHistory: string;
  profileImage?: string;
}

interface AppointmentRow {
  id: number;
  patientId: number;
  doctorId: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  title: string;
  description: string;
  color: string;
}

interface AttachmentMetaRow {
  id: number;
  fileName: string;
  fileType: string;
  createdDate: string | null;
  patientId: number | null;
  entityType: string | null;
  entityId: number | null;
  documentType: string | null;
  title: string | null;
  description: string | null;
  appointmentId?: number | null;
}

type InventoryCategory = 'consumable' | 'medicine' | 'equipment';

interface InventoryItemDto {
  id: number;
  name: string;
  category: InventoryCategory;
  description?: string;
  unit: string;
  minStock: number;
  isActive: boolean;
  totalQuantity?: number;
}

interface InventorySummaryRow {
  itemId: number;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  totalQuantity: number;
  isLowStock: boolean;
}

interface ComplaintClinicRef {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface ComplaintListRow {
  id: number;
  clinicId: number;
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  createdBy: number;
  assignedTo?: number | null;
  rejectionReason?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  clinic?: ComplaintClinicRef;
  assignedToUser?: { userId: number; username: string; email: string } | null;
}

interface ComplaintUpdateDto {
  id: number;
  status: string;
  message: string | null;
  createdAt: string | null;
  updatedBy: { id: number; username: string; email: string };
}

interface ComplaintAttachmentMeta {
  id: number;
  fileName: string;
  fileType: string;
  createdDate: string | null;
}

interface ComplaintDetailDto {
  id: number;
  clinicId: number;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  createdBy: number;
  assignedTo: number | null;
  rejectionReason: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  clinic?: ComplaintClinicRef;
  createdByStaff?: {
    user: { id: number; username: string; email: string };
    staff: { id: number; staffType: string; department: string | null; joiningDate: string | null } | null;
  };
  assignedToUser?: { userId: number; username: string; email: string } | null;
  updates: ComplaintUpdateDto[];
  attachments: ComplaintAttachmentMeta[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    trigger('pageEnter', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('260ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('cardStagger', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        // End with transform:none so ancestors do not establish a fixed-position containing block
        // (translateY(0) still counts as transform and breaks fixed overlays/modals inside the section).
        animate('420ms cubic-bezier(.2,.9,.2,1)', style({ opacity: 1, transform: 'none' }))
      ])
    ])
  ]
})
export class HomeComponent implements OnInit {
  private readonly defaultTabTitle = 'Dental Clinic';
  private readonly defaultFaviconPath = 'favicon.ico';
  private readonly organisationApiUrl = `${environment.apiUrl}/api/organisation`;
  private readonly doctorApiUrl = `${environment.apiUrl}/api/doctors`;
  private readonly patientApiUrl = `${environment.apiUrl}/api/patients`;
  private readonly appointmentApiUrl = `${environment.apiUrl}/api/appointments`;
  private readonly staffApiUrl = `${environment.apiUrl}/api/staff`;
  private readonly inventoryApiUrl = `${environment.apiUrl}/api/inventory`;
  private readonly financialApiUrl = `${environment.apiUrl}/api/financial`;
  private readonly attachmentApiUrl = `${environment.apiUrl}/api/attachments`;
  private readonly usersApiUrl = `${environment.apiUrl}/api/users`;
  private readonly clinicsApiUrl = `${environment.apiUrl}/api/clinics`;
  private readonly complaintsApiUrl = `${environment.apiUrl}/api/complaints`;

  /** Set while PATCH /users/:id/active is in flight for that user. */
  userAccountToggleUserId: number | null = null;

  sidebarCollapsed = false;
  active: string = 'dashboard';
  theme: 'light' | 'dark' = 'light';
  user: any = {};
  profilePic: string = '';
  activeSettingsTab: 'profile' | 'appearance' | 'notifications' | 'organisation' = 'profile';
  notificationSettings = {
    email: { push: true, email: false, sms: false },
    message: { push: true, email: false, sms: false }
  };

  organisation: OrganisationSettings = {
    code: 'DENTAL_CLINIC',
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    addSeal: false,
    logo: '',
    headerImage: '',
    footerImage: '',
    sealImage: ''
  };
  showDownloadDropdown: 'table' | 'row' | null = null;
  activeRowForDownload: Record<string, any> | null = null;
  columnFilters: Record<string, string> = {};
  inventoryFilters = { item: '', cost: '', qty: '', status: '' };
  registerPage = 1;
  registerPageSize = 10;
  registerPageInput = 1;
  registerSearch = '';
  private registerSearchDebounce: any = null;
  inventoryPage = 1;
  inventoryPageSize = 4;
  inventoryPageInput = 1;
  doctorPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  patientPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  staffPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  appointmentPagination = { page: 1, limit: 30, total: 0, totalPages: 1 };
  appointmentPageInput = 1;
  appointmentSearch = '';
  appointmentDateFilter = '';
  appointmentMonthFilter = '';
  private appointmentSearchDebounce: any = null;
  private appointmentColumnFilterDebounce: any = null;
  appointmentColumnFilters = {
    date: '',
    time: '',
    patient: '',
    doctor: '',
    status: '',
    title: ''
  };

  /** Month grid (YYYY-MM) for Appointment → All appointments. */
  allAppointmentsCalendarMonth = '';
  allAppointmentsCalendarRows: AppointmentRow[] = [];
  allAppointmentsCalendarLoading = false;
  allAppointmentsCalendarTotal = 0;
  selectedAllCalendarDate: string | null = null;
  orgSaving = false;
  orgLoading = false;
  orgSaveMessage = '';
  orgSaveError = '';
  doctorRows: DoctorRow[] = [];
  doctorRegisterSelectedId: number | null = null;
  patientRegisterSelectedId: number | null = null;
  /** Doctors with `users.is_active = 1` for selects (dashboard, appointments, reports, documents). */
  activeDoctorRows: DoctorRow[] = [];
  doctorFormOpen = false;
  doctorSubmitting = false;
  editingDoctorId: number | null = null;
  doctorFormError = '';
  doctorForm: {
    username: string;
    email: string;
    specialization: string;
    experience: number | null;
    qualification: string;
    consultationFee: number | null;
    availableTime: string;
    profileImage: string;
  } = this.getEmptyDoctorForm();
  readonly doctorTimeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'];
  staffRows: StaffRow[] = [];
  staffFormOpen = false;
  staffSubmitting = false;
  editingStaffId: number | null = null;
  staffFormError = '';
  staffForm: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    staffType: StaffType;
    department: string;
    canLogin: boolean;
    isActive: boolean;
    joiningDate: string;
    salary: number | null;
    notes: string;
    profileImage: string;
  } = this.getEmptyStaffForm();
  readonly staffTypeOptions: { value: StaffType; label: string }[] = [
    { value: 'office_staff', label: 'Office staff' },
    { value: 'counter_staff', label: 'Counter staff' },
    { value: 'billing_staff', label: 'Billing staff' },
    { value: 'security', label: 'Security' },
    { value: 'assistant', label: 'Assistant' },
    { value: 'other', label: 'Other' }
  ];
  clinicRows: ClinicRow[] = [];
  clinicLoading = false;
  clinicFormOpen = false;
  clinicSubmitting = false;
  editingClinicId: number | null = null;
  clinicFormError = '';
  clinicForm: {
    name: string;
    address: string;
    phone: string;
    email: string;
  } = this.getEmptyClinicForm();
  patientRows: PatientRow[] = [];
  patientDetailRow: PatientRow | null = null;
  patientDetailLoading = false;
  patientDetailError = '';
  patientDetailAppointments: AppointmentRow[] = [];
  patientDetailBills: Array<{
    id: number;
    patientName: string;
    finalAmount: number;
    paidAmount: number;
    status: string;
    billDate: string;
  }> = [];
  patientDetailDocuments: AttachmentMetaRow[] = [];
  patientDetailTab: 'history' | 'plan' | 'documents' | 'billing' | 'xrays' = 'history';
  patientFormOpen = false;
  patientSubmitting = false;
  editingPatientId: number | null = null;
  patientFormError = '';
  patientForm: {
    username: string;
    email: string;
    bloodGroup: string;
    allergies: string;
    emergencyContact: string;
    gender: string;
    dateOfBirth: string;
    mobile: string;
    alternateMobile: string;
    patientEmail: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
    medicalHistory: string;
    profileImage: string;
  } = this.getEmptyPatientForm();
  appointmentRows: AppointmentRow[] = [];
  appointmentFormOpen = false;
  appointmentSubmitting = false;
  editingAppointmentId: number | null = null;
  appointmentFormError = '';
  appointmentForm: {
    patientId: number | null;
    doctorId: number | null;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
    title: string;
    description: string;
  } = this.getEmptyAppointmentForm();
  appointmentStatusUpdatingId: number | null = null;

  readonly mainDashboardKpiSkeletonSlots = [1, 2, 3, 4, 5, 6];

  readonly inventoryCategoryOptions: { value: '' | InventoryCategory; label: string }[] = [
    { value: '', label: 'All categories' },
    { value: 'consumable', label: 'Consumable' },
    { value: 'medicine', label: 'Medicine' },
    { value: 'equipment', label: 'Equipment' }
  ];
  inventoryRegisterItems: InventoryItemDto[] = [];
  inventoryRegisterPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  inventoryRegisterPageInput = 1;
  inventoryRegisterSearch = '';
  private inventoryRegisterSearchDebounce: any = null;
  inventoryCategoryFilter: '' | InventoryCategory = '';
  inventoryItemFormOpen = false;
  inventoryEditingItemId: number | null = null;
  inventoryItemSubmitting = false;
  inventoryItemError = '';
  inventoryItemForm: {
    name: string;
    category: InventoryCategory;
    unit: string;
    minStock: number;
    description: string;
  } = this.getEmptyInventoryItemForm();
  inventoryItemSelectOptions: { id: number; name: string }[] = [];
  purchaseForm = {
    itemId: null as number | null,
    quantity: 1,
    purchaseDate: '',
    supplierName: '',
    purchasePrice: null as number | null,
    expiryDate: '',
    batchNumber: ''
  };
  purchaseSubmitting = false;
  purchaseError = '';
  useForm = { itemId: null as number | null, quantity: 1 };
  useAvailableQty = 0;
  useSubmitting = false;
  useError = '';
  stockViewSummary: InventorySummaryRow[] = [];
  stockViewExpandedId: number | null = null;
  stockViewBatches: Record<
    number,
    Array<{
      id: number;
      quantity: number;
      expiryDate: string | null;
      batchNumber: string;
      purchaseDate: string | null;
    }>
  > = {};
  movementRows: Array<{
    id: number;
    itemId: number;
    itemName: string;
    type: string;
    quantity: number;
    referenceType: string;
    referenceId: number | null;
    notes: string;
    createdAt: string;
  }> = [];
  movementPagination = { page: 1, limit: 15, total: 0, totalPages: 1 };
  movementPageInput = 1;
  movementFilters = { itemId: '', fromDate: '', toDate: '' };
  inventoryReportData: {
    items: InventorySummaryRow[];
    lowStockItems: InventorySummaryRow[];
    expiringBatches: Array<{
      stockId: number;
      itemId: number;
      itemName: string;
      quantity: number;
      batchNumber: string;
      expiryDate: string | null;
      purchaseDate: string | null;
    }>;
    expiringWithinDays: number;
  } | null = null;
  inventoryReportLoading = false;
  inventoryHelpOpen = false;

  maintenanceRaiseForm: {
    title: string;
    description: string;
    category: 'equipment' | 'electric' | 'software' | 'other';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    initialMessage: string;
    file: File | null;
  } = {
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    initialMessage: '',
    file: null
  };
  maintenanceRaiseSubmitting = false;
  maintenanceRaiseError = '';
  maintenanceMyRows: ComplaintListRow[] = [];
  maintenanceMyLoading = false;
  maintenanceAllRows: ComplaintListRow[] = [];
  maintenanceAllLoading = false;
  maintenanceAllPagination = { page: 1, limit: 20, total: 0, totalPages: 1 };
  maintenanceAllPageInput = 1;
  maintenanceAllFilterClinicId: number | '' = '';
  maintenanceAllFilterStatus = '';
  maintenanceAllFilterPriority = '';
  complaintDetailId: number | null = null;
  complaintDetailReturnKey = 'maintenance-my';
  complaintDetail: ComplaintDetailDto | null = null;
  complaintDetailLoading = false;
  maintenanceStatusForm: { status: string; message: string; rejectionReason: string } = {
    status: '',
    message: '',
    rejectionReason: ''
  };
  maintenanceStatusSubmitting = false;
  maintenanceCommentText = '';
  maintenanceCommentSubmitting = false;
  maintenanceAssignUserId: number | '' = '';
  maintenanceAssignSubmitting = false;
  maintenanceAssignStaffOptions: Array<{ userId: number; username: string; email: string }> = [];
  maintenanceDeleteSubmitting = false;
  attachmentPreviewUrl: string | null = null;
  attachmentPreviewName = '';
  sanitizedAttachmentPreview: SafeResourceUrl | null = null;

  financialDashboard: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    pendingPayments: number;
    chart: Array<{ month: string; income: number; expense: number; net: number }>;
    incomeByPaymentMethod: Array<{ method: string; amount: number }>;
    expenseByCategory: Array<{ category: string; amount: number }>;
    period?: { fromDate: string; toDate: string };
  } | null = null;
  financialDashboardLoading = false;
  financialDashboardFilters: {
    preset: '6m' | '12m' | 'ytd' | 'custom';
    fromDate: string;
    toDate: string;
  } = { preset: '6m', fromDate: '', toDate: '' };

  /** Home dashboard: separate from Transactions › Dashboard filters/state */
  mainDashboardLoading = false;
  mainDashboardFilters: {
    preset: '30d' | '6m' | '12m' | 'ytd' | 'custom';
    fromDate: string;
    toDate: string;
    doctorId: number | null;
    inventoryCategory: '' | InventoryCategory;
  } = { preset: '30d', fromDate: '', toDate: '', doctorId: null, inventoryCategory: '' };
  mainDashboardFinance: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    pendingPayments: number;
    chart: Array<{ month: string; income: number; expense: number; net: number }>;
    incomeByPaymentMethod: Array<{ method: string; amount: number }>;
    expenseByCategory: Array<{ category: string; amount: number }>;
    period?: { fromDate: string; toDate: string };
  } | null = null;
  mainDashboardPatientTotal = 0;
  mainDashboardDocumentTotal = 0;
  mainDashboardAppointmentsRaw: AppointmentRow[] = [];
  mainDashboardInventoryFull: {
    items: InventorySummaryRow[];
    lowStockItems: InventorySummaryRow[];
    expiringBatches: Array<{
      stockId: number;
      itemId: number;
      itemName: string;
      quantity: number;
      batchNumber: string;
      expiryDate: string | null;
      purchaseDate: string | null;
    }>;
    expiringWithinDays: number;
  } | null = null;
  finDashTooltip: { show: boolean; text: string; x: number; y: number } = {
    show: false,
    text: '',
    x: 0,
    y: 0
  };
  finDashActiveMonth: string | null = null;
  hbarTooltip: { show: boolean; text: string; x: number; y: number } = {
    show: false,
    text: '',
    x: 0,
    y: 0
  };
  transactionsHelpOpen = false;
  transactionsHelpSection: 'dashboard' | 'billing' | 'payments' | 'expenses' | 'ledger' = 'dashboard';
  financialPatients: Array<{ id: number; name: string }> = [];
  financialAppointments: AppointmentRow[] = [];
  billingList: Array<{
    id: number;
    patientName: string;
    finalAmount: number;
    paidAmount: number;
    status: string;
    billDate: string;
  }> = [];
  billingPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  billingPageInput = 1;
  billForm: {
    patientId: number | null;
    appointmentId: number | null;
    billDate: string;
    discount: number;
    items: Array<{
      itemName: string;
      quantity: number;
      price: number;
      inventoryItemId: number | null;
      availableQty: number | null;
      stockHint: string;
      stockError: string;
    }>;
  } = {
    patientId: null,
    appointmentId: null,
    billDate: '',
    discount: 0,
    items: [
      {
        itemName: '',
        quantity: 1,
        price: 0,
        inventoryItemId: null,
        availableQty: null,
        stockHint: '',
        stockError: ''
      }
    ]
  };

  billInventoryItemOptions: Array<{ id: number; name: string }> = [];
  billSubmitting = false;
  billError = '';
  paymentList: Array<{
    id: number;
    billingId: number;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    patientName: string;
  }> = [];
  paymentPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  paymentPageInput = 1;
  paymentForm = {
    billingId: null as number | null,
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'card' | 'upi' | 'bank',
    paymentDate: ''
  };
  paymentSubmitting = false;
  paymentError = '';
  expenseList: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    paymentMethod: string;
    expenseDate: string;
    referenceType: string;
    referenceId: number | null;
  }> = [];
  expensePagination = { page: 1, limit: 10, total: 0, totalPages: 1 };
  expensePageInput = 1;
  expenseForm = {
    title: '',
    amount: 0,
    category: 'general',
    paymentMethod: 'cash' as 'cash' | 'card' | 'upi' | 'bank',
    expenseDate: '',
    description: '',
    linkInventory: false,
    inventoryItemId: null as number | null,
    invQty: 1,
    invPurchasePrice: 0,
    invPurchaseDate: '',
    invSupplier: '',
    invExpiry: '',
    invBatch: ''
  };
  expenseSubmitting = false;
  expenseError = '';
  inventoryItemsForExpense: Array<{ id: number; name: string }> = [];
  ledgerEntries: Array<{
    id: number;
    type: string;
    amount: number;
    category: string;
    referenceType: string;
    referenceId: number | null;
    paymentMethod: string;
    transactionDate: string;
  }> = [];
  ledgerPagination = { page: 1, limit: 15, total: 0, totalPages: 1 };
  ledgerPageInput = 1;
  ledgerFilters = { type: '', category: '', fromDate: '', toDate: '' };

  readonly docEntityTypeOptions = [
    { value: '', label: 'Any' },
    { value: 'patient', label: 'Patient' },
    { value: 'medical_record', label: 'Medical record' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'appointment', label: 'Appointment' },
    { value: 'billing', label: 'Billing' },
    { value: 'inventory', label: 'Inventory' }
  ];

  docPatients: Array<{ id: number; name: string }> = [];
  docDoctors: Array<{ id: number; name: string }> = [];
  docAppointments: AppointmentRow[] = [];
  docBillsSelect: Array<{ id: number; label: string }> = [];
  /** Last X-Clinic-Id header value (or '') used to load doc dropdown data; mismatch → reload. */
  private docReferenceDataClinicKey: string | null = null;

  docPatientSearch = '';
  docPatientDocumentSearch = '';
  docPatientCategoryFilter: 'all' | 'prescriptions' | 'xrays' | 'labs' | 'consents' | 'plans' = 'all';
  docPatientUploadExpanded = false;
  headerSearchQuery = '';
  zoomPercent = 93;
  readonly minZoomPercent = 80;
  readonly maxZoomPercent = 110;
  docPatientId: number | null = null;
  docPatientAttachments: AttachmentMetaRow[] = [];
  docPatientLoading = false;
  docPatientUpload = {
    documentType: '',
    title: '',
    description: '',
    file: null as File | null
  };

  docMedPatientId: number | null = null;
  docMedAppointmentId: number | null = null;
  docMedAttachments: AttachmentMetaRow[] = [];
  docMedLoading = false;
  docMedUpload = {
    documentType: 'clinical',
    title: '',
    description: '',
    appointmentId: null as number | null,
    file: null as File | null
  };

  docBillId: number | null = null;
  docBillingAttachments: AttachmentMetaRow[] = [];
  docBillingLoading = false;
  docBillingUpload = {
    documentType: 'receipt',
    title: '',
    description: '',
    file: null as File | null
  };

  docDoctorId: number | null = null;
  docDoctorAttachments: AttachmentMetaRow[] = [];
  docDoctorLoading = false;
  docDoctorUpload = {
    documentType: 'certificate',
    title: '',
    description: '',
    file: null as File | null
  };

  docBrowseFilters = {
    entityType: '',
    entityId: '',
    documentType: '',
    fromDate: '',
    toDate: '',
    appointmentId: '',
    page: 1
  };
  docBrowseAttachments: AttachmentMetaRow[] = [];
  docBrowseLoading = false;
  docBrowsePagination = { page: 1, limit: 25, total: 0, totalPages: 1 };

  docMgmtPreview: AttachmentMetaRow | null = null;
  docMgmtPreviewData: { data: string; fileType: string; fileName: string } | null = null;
  docMgmtPreviewUrl: SafeResourceUrl | null = null;

  docMgmtEditOpen = false;
  docMgmtEditId: number | null = null;
  docMgmtEditSaving = false;
  docMgmtEditForm: {
    documentType: string;
    title: string;
    description: string;
    entityType: 'patient' | 'medical_record' | 'doctor' | 'appointment' | 'billing' | 'inventory';
    entityId: string;
    appointmentId: string;
    replaceFile: File | null;
  } = {
    documentType: '',
    title: '',
    description: '',
    entityType: 'patient',
    entityId: '',
    appointmentId: '',
    replaceFile: null
  };

  sidebarSearchQuery = '';

  /** Submodule keys (e.g. `doctor-register`), most recent first. Persisted per user. */
  sidebarFavoriteKeys: string[] = [];

  /** Appointment analytics (report page) */
  reportAnalyticsAppointments: AppointmentRow[] = [];
  reportAnalyticsLoading = false;
  reportDoctorId: number | null = null;

  /** Patient report: medical_record attachments + patient names */
  patientsReportRows: Array<AttachmentMetaRow & { patientName?: string }> = [];
  patientsReportLoading = false;

  /** Bound to topbar clinic dropdown (Super Admin / Admin). */
  selectedClinicIdUi: number | typeof SELECTED_CLINIC_ALL | null = null;

  readonly SELECTED_CLINIC_ALL = SELECTED_CLINIC_ALL;

  ngOnInit(): void {
    this.theme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    this.user = this.authSession.getUser() || {};
    this.profilePic = localStorage.getItem('profilePic') || '';
    this.initZoom();
    this.applyBranding();
    const savedNotifications = localStorage.getItem('notificationSettings');
    if (savedNotifications) {
      this.notificationSettings = this.normalizeNotificationSettings(JSON.parse(savedNotifications));
    }

    const token = this.authSession.getToken();
    const finishBootstrap = () => {
      this.user = this.authSession.getUser() || {};
      this.authSession.ensureDefaultSelectedClinic();
      this.syncSelectedClinicUiFromSession();
      this.applyStaffSidebarRestrictions();
      this.applyMaintenanceNav();
      this.loadSidebarFavorites();
      this.loadOrganisation();
      this.loadActiveDoctorsForDropdowns();
      this.applyMainDashboardPreset('30d');
      this.loadMainDashboard();
    };

    if (!token) {
      finishBootstrap();
      return;
    }

    this.http
      .get<{
        user: {
          id: number;
          organizationId: number | null;
          clinicId: number | null;
          role: string | null;
          clinics: Array<{ id: number; name: string }> | null;
        } | null;
      }>(`${environment.apiUrl}/api/auth/me`)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res?.user) {
          this.authSession.patchUser({
            organizationId: res.user.organizationId,
            clinicId: res.user.clinicId,
            clinics: res.user.clinics
          });
        }
        finishBootstrap();
      });
  }

  get clinicSwitcherOptions(): Array<{ id: number; name: string }> {
    const list = this.user?.clinics;
    if (!Array.isArray(list) || !list.length) return [];
    return list.map((c) => ({
      id: c.id,
      name: (c.name && String(c.name).trim()) || `Clinic #${c.id}`
    }));
  }

  get showClinicSwitcher(): boolean {
    return this.canManageUserAccounts && this.clinicSwitcherOptions.length > 0;
  }

  get isAllClinicsScope(): boolean {
    return this.authSession.isAllClinicsScopeSelected();
  }

  get selectedClinicLabel(): string {
    const selected = this.selectedClinicIdUi;
    if (selected === SELECTED_CLINIC_ALL) return 'All clinics';
    const n = typeof selected === 'string' ? Number(selected) : selected;
    if (!Number.isFinite(n as number)) return '';
    const found = this.clinicSwitcherOptions.find((c) => c.id === n);
    return found?.name || '';
  }

  /** Shown under the switcher when “All clinics” is selected. */
  get clinicAllScopeSummary(): string {
    const list = this.clinicSwitcherOptions;
    if (!list.length) return '';
    const names = list.map((c) => c.name).join(' · ');
    return `${list.length} clinic${list.length === 1 ? '' : 's'}: ${names}`;
  }

  /** Full hint line when “All clinics” is selected (create-only restriction). */
  get clinicAllScopeBanner(): string {
    const s = this.clinicAllScopeSummary;
    const tail =
      'Pick one clinic above only when adding new records. Combined view shows all details; you can still update or delete existing items.';
    return s ? `${s}. ${tail}` : tail;
  }

  private readonly clinicCreateBlockedMessage =
    'Select a single clinic to create this record. Choose one clinic in the switcher (not “All clinics”).';

  /** Use only for POST/create flows; updates and deletes work in org-wide scope on the backend. */
  private requireSingleClinicForCreate(): boolean {
    if (!this.authSession.isAllClinicsScopeSelected()) return true;
    this.toast.error(this.clinicCreateBlockedMessage);
    return false;
  }

  syncSelectedClinicUiFromSession(): void {
    this.selectedClinicIdUi = this.authSession.getElevatedClinicSelection();
  }

  onClinicSwitcherChange(value: number | typeof SELECTED_CLINIC_ALL | string | null): void {
    if (value === SELECTED_CLINIC_ALL || value === 'all') {
      this.authSession.setSelectedClinic(SELECTED_CLINIC_ALL);
      this.selectedClinicIdUi = SELECTED_CLINIC_ALL;
      this.registerPage = 1;
      this.loadDataForActiveKey(this.active);
      this.toast.success('Showing all clinics (combined view)');
      return;
    }
    const n = typeof value === 'string' ? Number(value) : value;
    if (n == null || !Number.isFinite(n)) return;
    this.authSession.setSelectedClinic(n);
    this.selectedClinicIdUi = n;
    this.registerPage = 1;
    this.loadDataForActiveKey(this.active);
    this.toast.success('Active clinic updated');
  }

  getSidebarSectionLabel(key: string | undefined): string {
    if (!key) return '';
    if (key === 'dashboard') return 'Overview';
    if (['doctor', 'patients', 'appointment', 'clinic', 'inventory', 'staff'].includes(key)) return 'Clinical';
    if (['maintenance', 'transactions', 'documents'].includes(key)) return 'Operations';
    return 'System';
  }

  sidebarItems: SidebarItem[] = [
    { key: 'dashboard', label: 'Dashboard', iconText: 'D' },
    { 
      key: 'doctor', 
      label: 'Doctor', 
      iconText: 'DR',
      expanded: false,
      children: [
        { key: 'doctor-register', label: 'Register', iconText: 'R' },
        { key: 'doctor-report', label: 'Report', iconText: 'RP' }
      ]
    },
    { 
      key: 'patients', 
      label: 'Patients', 
      iconText: 'P',
      expanded: false,
      children: [
        { key: 'patients-register', label: 'Register', iconText: 'R' },
        { key: 'patients-create', label: 'Create', iconText: '+' },
        { key: 'patients-report', label: 'Report', iconText: 'RP' }
      ]
    },
    {
      key: 'appointment',
      label: 'Appointment',
      iconText: 'A',
      expanded: false,
      children: [
        { key: 'appointment-register', label: 'Calendar', iconText: 'C' },
        { key: 'appointment-all', label: 'All appointments', iconText: 'AA' },
        { key: 'appointment-report', label: 'Report', iconText: 'RP' }
      ]
    },
    { 
      key: 'staff', 
      label: 'Staff', 
      iconText: 'S',
      expanded: false,
      children: [
        { key: 'staff-register', label: 'Register', iconText: 'R' }
      ]
    },
    {
      key: 'clinic',
      label: 'Clinic',
      iconText: 'CL',
      expanded: false,
      children: [
        { key: 'clinic-manage', label: 'Manage clinics', iconText: 'M' }
      ]
    },
    { 
      key: 'inventory', 
      label: 'Inventory', 
      iconText: 'I',
      expanded: false,
      children: [
        { key: 'inventory-items', label: 'Items', iconText: 'I' },
        { key: 'inventory-stock', label: 'Stock (Batches)', iconText: 'S' },
        { key: 'inventory-report-expiring', label: 'Reports · Expiring', iconText: 'E' },
        { key: 'inventory-report-expired', label: 'Reports · Expired', iconText: 'X' },
        { key: 'inventory-report-low', label: 'Reports · Low stock', iconText: 'L' }
      ]
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      iconText: 'MT',
      expanded: false,
      children: [
        { key: 'maintenance-raise', label: 'Raise Complaint', iconText: '+' },
        { key: 'maintenance-my', label: 'My Complaints', iconText: 'MC' },
        { key: 'maintenance-all', label: 'All Complaints', iconText: 'AC' }
      ]
    },
    {
      key: 'transactions',
      label: 'Transactions',
      iconText: 'TX',
      expanded: false,
      children: [
        { key: 'transactions-dashboard', label: 'Dashboard', iconText: 'D' },
        { key: 'transactions-billing', label: 'Billing', iconText: 'B' },
        { key: 'transactions-payments', label: 'Payments', iconText: 'P' },
        { key: 'transactions-expenses', label: 'Expenses', iconText: 'E' },
        { key: 'transactions-ledger', label: 'Transactions Log', iconText: 'L' }
      ]
    },
    {
      key: 'documents',
      label: 'Document Management',
      iconText: 'DM',
      expanded: false,
      children: [
        { key: 'documents-patient', label: 'Patient Documents', iconText: 'P' },
        { key: 'documents-medical', label: 'Medical Records', iconText: 'M' },
        { key: 'documents-billing', label: 'Billing Documents', iconText: 'B' },
        { key: 'documents-doctor', label: 'Doctor Documents', iconText: 'D' },
        { key: 'documents-all', label: 'All Documents', iconText: 'A' }
      ]
    },
    {
      key: 'settings',
      label: 'Settings',
      iconText: 'ST',
      expanded: false,
      children: [
        { key: 'settings', label: 'General', iconText: 'G' }
      ]
    }
  ];

  get activeLabel(): string {
    if (this.active === 'maintenance-detail') {
      return 'Complaint details';
    }
    if (this.active === 'patients-detail') {
      return 'Patient details';
    }
    const item = this.findItemByKey(this.sidebarItems, this.active);
    return item ? item.label : 'Module';
  }

  get isMaintenanceModule(): boolean {
    return this.active.startsWith('maintenance-');
  }

  get isConfigurationModule(): boolean {
    return false;
  }

  get isTransactionsModule(): boolean {
    return this.active.startsWith('transactions-');
  }

  get isInventoryModule(): boolean {
    return (
      this.active === 'inventory-items' ||
      this.active === 'inventory-stock' ||
      this.active.startsWith('inventory-report-')
    );
  }

  get isDocumentsModule(): boolean {
    return this.active.startsWith('documents-');
  }

  /** Patient / doctor / bill dropdowns are loaded per clinic; empty while “All clinics” is selected. */
  get docMgmtDropdownsNeedSingleClinic(): boolean {
    return this.authSession.isAllClinicsScopeSelected();
  }

  /** Flatten sidebar for search: "Parent › Child" and top-level items. */
  get sidebarNavFlat(): Array<{ key: string; pathLabel: string; searchText: string }> {
    const out: Array<{ key: string; pathLabel: string; searchText: string }> = [];
    for (const item of this.sidebarItems) {
      if (!item.children?.length) {
        out.push({
          key: item.key,
          pathLabel: item.label,
          searchText: `${item.label}`.toLowerCase()
        });
      } else {
        for (const child of item.children) {
          const pathLabel = `${item.label} › ${child.label}`;
          out.push({
            key: child.key,
            pathLabel,
            searchText: `${item.label} ${child.label} ${pathLabel}`.toLowerCase()
          });
        }
      }
    }
    return out;
  }

  get sidebarSearchMatches(): Array<{ key: string; pathLabel: string; searchText: string }> {
    const q = this.sidebarSearchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    const tokens = q.split(/[\s.,]+/).filter(Boolean);
    if (!tokens.length) return [];
    return this.sidebarNavFlat
      .filter((e) => tokens.every((t) => e.searchText.includes(t)))
      .slice(0, 14);
  }

  navigateSidebarSearch(entry: { key: string }): void {
    this.sidebarSearchQuery = '';
    for (const item of this.sidebarItems) {
      if (item.children?.some((c) => c.key === entry.key)) {
        item.expanded = true;
        break;
      }
    }
    this.setActive(entry.key);
  }

  private sidebarFavoritesStorageKey(): string {
    const id = this.user?.id != null ? String(this.user.id) : 'guest';
    return `dentalclinic_sidebar_favorites_${id}`;
  }

  private loadSidebarFavorites(): void {
    try {
      const raw = localStorage.getItem(this.sidebarFavoritesStorageKey());
      if (!raw) {
        this.sidebarFavoriteKeys = [];
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      this.sidebarFavoriteKeys = Array.isArray(parsed)
        ? parsed.filter((k): k is string => typeof k === 'string' && !k.endsWith('-about'))
        : [];
    } catch {
      this.sidebarFavoriteKeys = [];
    }
  }

  private persistSidebarFavorites(): void {
    localStorage.setItem(this.sidebarFavoritesStorageKey(), JSON.stringify(this.sidebarFavoriteKeys));
  }

  /**
   * Resolves favorited submodule keys to labels/icons still present in the current sidebar (after role filters).
   */
  get sidebarFavoriteEntries(): Array<{ key: string; pathLabel: string; iconText: string }> {
    const flat = new Map(this.sidebarNavFlat.map((e) => [e.key, e]));
    const iconByChildKey = new Map<string, string>();
    for (const item of this.sidebarItems) {
      if (!item.children?.length) continue;
      for (const ch of item.children) {
        iconByChildKey.set(ch.key, ch.iconText);
      }
    }
    const out: Array<{ key: string; pathLabel: string; iconText: string }> = [];
    for (const key of this.sidebarFavoriteKeys) {
      if (!iconByChildKey.has(key)) continue;
      const row = flat.get(key);
      if (!row) continue;
      out.push({
        key,
        pathLabel: row.pathLabel,
        iconText: iconByChildKey.get(key) || '•'
      });
    }
    return out;
  }

  isSidebarFavorite(key: string): boolean {
    return this.sidebarFavoriteKeys.includes(key);
  }

  toggleSidebarFavorite(key: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.sidebarFavoriteKeys.includes(key)) {
      this.sidebarFavoriteKeys = this.sidebarFavoriteKeys.filter((k) => k !== key);
    } else {
      this.sidebarFavoriteKeys = [key, ...this.sidebarFavoriteKeys.filter((k) => k !== key)];
    }
    this.persistSidebarFavorites();
  }

  navigateSidebarFavorite(entry: { key: string }): void {
    this.navigateSidebarSearch(entry);
  }

  isSidebarParentActive(item: SidebarItem): boolean {
    return (
      this.active === item.key ||
      (!!item.children && item.children.some((c) => c.key === this.active))
    );
  }

  private findItemByKey(items: SidebarItem[], key: string): SidebarItem | null {
    for (const item of items) {
      if (item.key === key) return item;
      if (item.children) {
        const found = this.findItemByKey(item.children, key);
        if (found) return found;
      }
    }
    return null;
  }

  /** Dashboard snapshot rows (from GET /api/inventory/summary). */
  inventoryRows: { item: string; qty: number; status: string; cost: string }[] = [];

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer,
    private readonly toast: ToastService,
    private readonly inventoryApi: InventoryApiService,
    private readonly billingApi: BillingApiService
  ) {}

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  get canManageUserAccounts(): boolean {
    const r = this.user?.role;
    return r === 'Super Admin' || r === 'Admin';
  }

  /** Inventory edits (items, add stock). Doctors are view-only here. */
  get canManageInventory(): boolean {
    const r = this.user?.role;
    if (r === 'Doctor') return false;
    return r === 'Super Admin' || r === 'Admin' || r === 'Staff';
  }

  private applyStaffSidebarRestrictions(): void {
    if (!this.canManageUserAccounts) {
      this.sidebarItems = this.sidebarItems.filter((item) => item.key !== 'clinic');
    }
    if (this.user?.role !== 'Staff') return;
    this.sidebarItems = this.sidebarItems.filter(
      (item) => item.key !== 'settings' && item.key !== 'staff'
    );
    const tx = this.sidebarItems.find((i) => i.key === 'transactions');
    if (tx?.children?.length) {
      tx.children = tx.children.filter((c) => c.key !== 'transactions-dashboard');
    }
  }

  private applyMaintenanceNav(): void {
    const idx = this.sidebarItems.findIndex((i) => i.key === 'maintenance');
    if (idx < 0) return;
    const allChildren: SidebarItem[] = [
      { key: 'maintenance-raise', label: 'Raise Complaint', iconText: '+' },
      { key: 'maintenance-my', label: 'My Complaints', iconText: 'MC' },
      { key: 'maintenance-all', label: 'All Complaints', iconText: 'AC' }
    ];
    const role = this.user?.role;
    let children: SidebarItem[] = [];
    if (this.canManageUserAccounts) {
      children = allChildren.filter((c) => c.key === 'maintenance-all');
    } else if (role === 'Staff') {
      children = allChildren.filter(
        (c) => c.key === 'maintenance-raise' || c.key === 'maintenance-my'
      );
    } else if (role === 'Doctor') {
      children = allChildren.filter((c) => c.key === 'maintenance-my');
    }
    if (!children.length) {
      this.sidebarItems = this.sidebarItems.filter((i) => i.key !== 'maintenance');
      return;
    }
    const prev = this.sidebarItems[idx];
    this.sidebarItems[idx] = {
      ...prev,
      children,
      expanded: prev.expanded ?? false
    };
  }

  onUserAccountActiveChange(row: { userId?: number; userAccountActive?: boolean }, enabled: boolean): void {
    if (!this.canManageUserAccounts) return;
    const userId = row.userId != null ? Number(row.userId) : NaN;
    if (!Number.isFinite(userId)) return;
    this.userAccountToggleUserId = userId;
    this.http.patch<{ isActive: boolean }>(`${this.usersApiUrl}/${userId}/active`, { isActive: enabled }).subscribe({
      next: () => {
        this.userAccountToggleUserId = null;
        row.userAccountActive = enabled;
        this.toast.success(
          enabled ? 'User account is now active.' : 'User account has been blocked.'
        );
        this.reloadRegisterListAfterUserToggle();
      },
      error: (err) => {
        this.userAccountToggleUserId = null;
        this.toast.error(err?.error?.message || 'Could not update account status.');
        this.reloadRegisterListAfterUserToggle();
      }
    });
  }

  private reloadRegisterListAfterUserToggle(): void {
    const k = this.activeRegisterKey;
    if (k === 'doctor') {
      this.loadDoctors(this.registerPage, this.registerPageSize);
      this.loadActiveDoctorsForDropdowns();
    } else if (k === 'patients') this.loadPatients(this.registerPage, this.registerPageSize);
    else if (k === 'staff') this.loadStaff(this.registerPage, this.registerPageSize);
  }

  loadActiveDoctorsForDropdowns(): void {
    this.http
      .get<{
        doctors: DoctorRow[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }>(this.doctorApiUrl, { params: { page: 1, limit: 500, activeOnly: '1' } })
      .subscribe({
        next: (res) => {
          this.activeDoctorRows = (res?.doctors || []).map((doctor) => ({
            ...doctor,
            consultationFee:
              doctor.consultationFee !== null && doctor.consultationFee !== undefined
                ? Number(doctor.consultationFee)
                : null
          }));
          if (this.active === 'doctor-report' && this.reportDoctorId == null && this.activeDoctorRows.length) {
            this.reportDoctorId = this.activeDoctorRows[0].id;
          }
        },
        error: () => {
          this.activeDoctorRows = [];
        }
      });
  }

  setActive(key: string): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (key.endsWith('-about') || key === 'config-about') {
      key = 'dashboard';
    }
    if (!this.canManageUserAccounts && key.startsWith('clinic-')) {
      key = 'dashboard';
    }
    if (this.user?.role === 'Staff') {
      if (key === 'settings' || key === 'staff' || key.startsWith('staff-')) {
        key = 'dashboard';
      } else if (key === 'transactions-dashboard') {
        key = 'transactions-billing';
      }
    }
    if (key === 'maintenance-raise' && this.user?.role !== 'Staff') {
      key = 'dashboard';
    }
    if (
      key === 'maintenance-my' &&
      this.user?.role !== 'Staff' &&
      this.user?.role !== 'Doctor'
    ) {
      key = this.canManageUserAccounts ? 'maintenance-all' : 'dashboard';
    }
    if (key === 'maintenance-all' && !this.canManageUserAccounts) {
      key = 'dashboard';
    }
    if (key.startsWith('maintenance-')) {
      const m = this.sidebarItems.find((i) => i.key === 'maintenance');
      if (m) {
        m.expanded = true;
      }
    }
    this.active = key;
    this.columnFilters = {}; // Clear filters when switching pages
    this.registerPage = 1;
    this.loadDataForActiveKey(key);
  }

  private loadDataForActiveKey(key: string): void {
    if (key === 'doctor-register') {
      this.loadDoctors(1, this.registerPageSize);
    }
    if (key === 'patients-register') {
      this.loadPatients(1, this.registerPageSize);
    }
    if (key === 'patients-detail' && this.patientDetailRow?.id) {
      this.loadPatientDetailData(this.patientDetailRow.id);
    }
    if (key === 'staff-register') {
      this.loadStaff(1, this.registerPageSize);
    }
    if (key === 'clinic-manage') {
      this.loadClinics();
    }
    if (key === 'patients-edit') {
      this.patientFormOpen = true;
    }
    if (key === 'patients-create') {
      this.openCreatePatient();
    }
    if (key === 'doctor-report') {
      this.reportDoctorId = null;
      this.loadActiveDoctorsForDropdowns();
      this.loadReportAppointmentsAll();
    }
    if (key === 'patients-report') {
      this.loadPatientsReport();
    }
    if (key === 'appointment-report') {
      this.loadReportAppointmentsAll();
    }
    if (key === 'appointment-register') {
      this.clearAppointmentFilters();
      this.appointmentColumnFilters = {
        date: '',
        time: '',
        patient: '',
        doctor: '',
        status: '',
        title: ''
      };
      this.loadActiveDoctorsForDropdowns();
      this.loadPatients(1, 100);
      this.loadAppointments(1);
    }
    if (key === 'appointment-all') {
      this.appointmentColumnFilters = {
        date: '',
        time: '',
        patient: '',
        doctor: '',
        status: '',
        title: ''
      };
      this.ensureAllAppointmentsCalendarMonth();
      this.loadActiveDoctorsForDropdowns();
      this.loadPatients(1, 100);
      this.loadAllAppointmentsCalendar();
    }
    if (key === 'dashboard') {
      this.loadActiveDoctorsForDropdowns();
      this.loadMainDashboard();
    }
    if (key === 'inventory-items' || key === 'inventory-stock' || key.startsWith('inventory-report-')) {
      /* Child pages load their own data */
    }
    if (key === 'transactions-dashboard') {
      this.loadFinancialDashboard();
    }
    if (key === 'transactions-billing') {
      this.loadFinancialBillingPage();
    }
    if (key === 'transactions-payments') {
      this.loadFinancialPaymentsPage();
    }
    if (key === 'transactions-expenses') {
      this.loadFinancialExpensesPage();
    }
    if (key === 'transactions-ledger') {
      this.loadFinancialLedgerPage();
    }
    if (key.startsWith('documents-')) {
      this.ensureDocReferenceData();
      if (key === 'documents-patient') {
        this.loadDocumentsPatientList();
      } else if (key === 'documents-medical') {
        this.loadDocumentsMedicalList();
      } else if (key === 'documents-billing') {
        this.loadDocumentsBillingList();
      } else if (key === 'documents-doctor') {
        this.loadDocumentsDoctorList();
      } else if (key === 'documents-all') {
        this.loadDocumentsBrowse();
      }
    }
    if (key === 'maintenance-my') {
      this.loadMaintenanceMyComplaints();
    }
    if (key === 'maintenance-all') {
      this.loadMaintenanceAllComplaints(1);
    }
    if (key === 'maintenance-raise') {
      this.resetMaintenanceRaiseForm();
    }
  }

  toggleExpanded(item: SidebarItem): void {
    item.expanded = !item.expanded;
  }

  toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
  }

  private initZoom(): void {
    const raw = Number(localStorage.getItem('app_zoom_pct') || 93);
    const safe = Number.isFinite(raw) ? Math.max(this.minZoomPercent, Math.min(this.maxZoomPercent, raw)) : 93;
    this.applyZoom(safe);
  }

  private applyZoom(value: number): void {
    const clamped = Math.max(this.minZoomPercent, Math.min(this.maxZoomPercent, Math.round(value)));
    this.zoomPercent = clamped;
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('zoom', `${clamped}%`);
    }
    localStorage.setItem('app_zoom_pct', String(clamped));
  }

  increaseZoom(): void {
    this.applyZoom(this.zoomPercent + 5);
  }

  decreaseZoom(): void {
    this.applyZoom(this.zoomPercent - 5);
  }

  resetZoom(): void {
    this.applyZoom(93);
  }

  get headerProfileInitials(): string {
    const raw = String(this.user?.username || this.user?.email || 'DR').trim();
    if (!raw) return 'DR';
    const parts = raw.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }

  onHeaderSearchSubmit(): void {
    const q = this.headerSearchQuery.trim().toLowerCase();
    if (!q) return;
    const tokens = q.split(/[\s.,]+/).filter(Boolean);
    const hit = this.sidebarNavFlat.find((e) => tokens.every((t) => e.searchText.includes(t)));
    if (!hit) return;
    this.setActive(hit.key);
    this.headerSearchQuery = '';
  }

  openSettingsFromHeader(): void {
    this.setActive('settings');
  }

  setSettingsTab(tab: 'profile' | 'appearance' | 'notifications' | 'organisation'): void {
    this.activeSettingsTab = tab;
  }

  onOrganisationImageSelected(field: 'logo'|'headerImage'|'footerImage'|'sealImage', event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const value = e.target?.result as string;
      this.organisation[field] = value;
      if (field === 'logo') this.applyBranding();
    };
    reader.readAsDataURL(file);
  }

  saveOrganisation(): void {
    this.orgSaving = true;
    this.orgSaveMessage = '';
    this.orgSaveError = '';
    this.http.put<{ organisation: OrganisationSettings }>(this.organisationApiUrl, this.organisation).subscribe({
      next: (res) => {
        if (res && res.organisation) {
          this.organisation = { ...this.organisation, ...res.organisation };
        }
        localStorage.setItem('organisation', JSON.stringify(this.organisation));
        this.applyBranding();
        this.orgSaving = false;
        this.orgSaveMessage = 'Organisation settings saved to backend.';
      },
      error: (err) => {
        this.orgSaving = false;
        this.orgSaveError = err?.error?.message || 'Unable to save organisation settings.';
      }
    });
  }

  loadInventoryDashboard(): void {
    this.http
      .get<{
        items: Array<{ name: string; totalQuantity: number; isLowStock: boolean }>;
      }>(`${this.inventoryApiUrl}/summary`)
      .subscribe({
        next: (res) => {
          const items = res?.items || [];
          this.inventoryRows = items.map((i) => ({
            item: i.name,
            qty: i.totalQuantity,
            cost: '—',
            status:
              i.totalQuantity === 0 ? 'Out of Stock' : i.isLowStock ? 'Restock' : 'In Stock'
          }));
          this.inventoryPage = 1;
          this.inventoryPageInput = 1;
        },
        error: () => {
          this.inventoryRows = [];
        }
      });
  }

  ensureMainDashboardDates(): void {
    if (!this.mainDashboardFilters.fromDate || !this.mainDashboardFilters.toDate) {
      this.applyMainDashboardPreset('30d');
    }
  }

  applyMainDashboardPreset(preset: '30d' | '6m' | '12m' | 'ytd' | 'custom'): void {
    if (preset === 'custom') return;
    const today = new Date();
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let from: Date;
    if (preset === '30d') {
      from = new Date(to);
      from.setDate(from.getDate() - 29);
    } else if (preset === '6m') {
      from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    } else if (preset === '12m') {
      from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
    }
    this.mainDashboardFilters.preset = preset;
    this.mainDashboardFilters.fromDate = this.toYmdLocal(from);
    this.mainDashboardFilters.toDate = this.toYmdLocal(to);
  }

  onMainDashboardPresetChange(): void {
    if (this.mainDashboardFilters.preset !== 'custom') {
      this.applyMainDashboardPreset(this.mainDashboardFilters.preset);
    }
    this.loadMainDashboard();
  }

  onMainDashboardDateEdited(): void {
    this.mainDashboardFilters.preset = 'custom';
  }

  onMainDashboardFilterApply(): void {
    this.loadMainDashboard();
  }

  refreshMainDashboard(): void {
    this.loadMainDashboard({ minLoadingMs: 2000 });
  }

  loadMainDashboard(opts?: { minLoadingMs?: number }): void {
    const minLoadingMs = opts?.minLoadingMs ?? 0;
    const loadStartedAt = Date.now();
    const endMainDashboardLoading = (): void => {
      const elapsed = Date.now() - loadStartedAt;
      const wait = Math.max(0, minLoadingMs - elapsed);
      setTimeout(() => {
        this.mainDashboardLoading = false;
      }, wait);
    };

    this.ensureMainDashboardDates();
    this.mainDashboardLoading = true;

    const { fromDate, toDate } = this.mainDashboardFilters;
    const finParams = { fromDate, toDate };

    forkJoin({
      fin: this.http
        .get<{
          totalIncome: number;
          totalExpense: number;
          balance: number;
          pendingPayments: number;
          chart: Array<{ month: string; income: number; expense: number; net: number }>;
          incomeByPaymentMethod: Array<{ method: string; amount: number }>;
          expenseByCategory: Array<{ category: string; amount: number }>;
          period?: { fromDate: string; toDate: string };
        }>(`${this.financialApiUrl}/dashboard`, { params: finParams })
        .pipe(catchError(() => of(null))),
      inv: this.http
        .get<{
          items: InventorySummaryRow[];
          lowStockItems: InventorySummaryRow[];
          expiringBatches: Array<{
            stockId: number;
            itemId: number;
            itemName: string;
            quantity: number;
            batchNumber: string;
            expiryDate: string | null;
            purchaseDate: string | null;
          }>;
          expiringWithinDays: number;
        }>(`${this.inventoryApiUrl}/summary`)
        .pipe(catchError(() => of(null))),
      pat: this.http
        .get<{ pagination?: { total: number } }>(this.patientApiUrl, {
          params: { page: 1, limit: 1, q: '' }
        })
        .pipe(
          map((r) => r?.pagination?.total ?? 0),
          catchError(() => of(0))
        ),
      doc: this.http
        .get<{ pagination: { total: number } }>(`${this.attachmentApiUrl}/browse`, {
          params: { page: 1, limit: 1 }
        })
        .pipe(
          map((r) => r?.pagination?.total ?? 0),
          catchError(() => of(0))
        )
    }).subscribe({
      next: (res) => {
        if (res.fin) {
          const r = res.fin;
          this.mainDashboardFinance = {
            ...r,
            chart: (r.chart || []).map((c) => ({
              ...c,
              net: c.net != null ? Number(c.net) : Number(c.income || 0) - Number(c.expense || 0)
            })),
            incomeByPaymentMethod: r.incomeByPaymentMethod || [],
            expenseByCategory: r.expenseByCategory || []
          };
        } else {
          this.mainDashboardFinance = null;
        }

        if (res.inv) {
          this.mainDashboardInventoryFull = res.inv;
          const items = res.inv.items || [];
          this.inventoryRows = items.map((i) => ({
            item: i.name,
            qty: i.totalQuantity,
            cost: '—',
            status: i.totalQuantity === 0 ? 'Out of Stock' : i.isLowStock ? 'Restock' : 'In Stock'
          }));
          this.inventoryPage = 1;
          this.inventoryPageInput = 1;
        } else {
          this.mainDashboardInventoryFull = null;
        }

        this.mainDashboardPatientTotal = res.pat;
        this.mainDashboardDocumentTotal = res.doc;

        this.loadMainDashboardAppointmentsAll(endMainDashboardLoading);
      }
    });
  }

  private loadMainDashboardAppointmentsAll(done: () => void): void {
    const limit = 100;
    const acc: AppointmentRow[] = [];
    const fetchPage = (page: number) => {
      this.http
        .get<{
          appointments: AppointmentRow[];
          pagination?: { page: number; totalPages: number };
        }>(this.appointmentApiUrl, { params: { page, limit } })
        .subscribe({
          next: (res) => {
            const batch = (res?.appointments || []).map((x) => this.mapReportAppointment(x));
            acc.push(...batch);
            const pg = res?.pagination;
            const totalPages = pg?.totalPages ?? 1;
            const cur = pg?.page ?? page;
            if (cur < totalPages) fetchPage(cur + 1);
            else {
              this.mainDashboardAppointmentsRaw = acc;
              done();
            }
          },
          error: () => {
            this.mainDashboardAppointmentsRaw = [];
            done();
          }
        });
    };
    fetchPage(1);
  }

  get mainDashTodayYmd(): string {
    return this.toYmdLocal(new Date());
  }

  get mainDashTodayAppointments(): AppointmentRow[] {
    const today = this.mainDashTodayYmd;
    const docId = this.mainDashboardFilters.doctorId;
    return this.mainDashboardAppointmentsRaw
      .filter((a) => {
        if (String(a.appointmentDate).slice(0, 10) !== today) return false;
        if (docId != null && a.doctorId !== docId) return false;
        return true;
      })
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  }

  get mainDashUpcomingAppointments(): AppointmentRow[] {
    const today = this.mainDashTodayYmd;
    const to = this.mainDashboardFilters.toDate;
    const docId = this.mainDashboardFilters.doctorId;
    return this.mainDashboardAppointmentsRaw
      .filter((a) => {
        const ad = String(a.appointmentDate).slice(0, 10);
        if (ad <= today || ad > to) return false;
        if (docId != null && a.doctorId !== docId) return false;
        return true;
      })
      .sort((a, b) => {
        const c = String(a.appointmentDate).localeCompare(String(b.appointmentDate));
        return c !== 0 ? c : String(a.startTime).localeCompare(String(b.startTime));
      })
      .slice(0, 30);
  }

  get mainDashInventoryLowStockFiltered(): InventorySummaryRow[] {
    const rows = this.mainDashboardInventoryFull?.lowStockItems || [];
    const cat = this.mainDashboardFilters.inventoryCategory;
    if (!cat) return rows.slice(0, 12);
    return rows.filter((r) => r.category === cat).slice(0, 12);
  }

  get mainDashInventoryExpiringFiltered(): Array<{
    stockId: number;
    itemId: number;
    itemName: string;
    quantity: number;
    batchNumber: string;
    expiryDate: string | null;
    purchaseDate: string | null;
  }> {
    const rows = this.mainDashboardInventoryFull?.expiringBatches || [];
    const cat = this.mainDashboardFilters.inventoryCategory;
    if (!cat) return rows.slice(0, 10);
    const itemIds = new Set(
      (this.mainDashboardInventoryFull?.items || []).filter((i) => i.category === cat).map((i) => i.itemId)
    );
    return rows.filter((b) => itemIds.has(b.itemId)).slice(0, 10);
  }

  get mainDashboardPeriodLabel(): string {
    const p = this.mainDashboardFilters;
    if (!p.fromDate || !p.toDate) return '';
    return `${p.fromDate} → ${p.toDate}`;
  }

  private getEmptyInventoryItemForm() {
    return {
      name: '',
      category: 'consumable' as InventoryCategory,
      unit: '',
      minStock: 0,
      description: ''
    };
  }

  loadInventoryRegisterPage(): void {
    this.inventoryRegisterPageInput = 1;
    this.movementFilters = { itemId: '', fromDate: '', toDate: '' };
    this.loadInventoryRegisterItems(1);
    this.loadInventoryItemSelectOptions();
    this.loadStockViewData();
    this.loadInventoryMovements(1);
  }

  loadInventoryRegisterItems(page = this.inventoryRegisterPagination.page): void {
    const params: Record<string, string | number> = {
      page,
      limit: this.inventoryRegisterPagination.limit,
      q: this.inventoryRegisterSearch.trim()
    };
    if (this.inventoryCategoryFilter) {
      params['category'] = this.inventoryCategoryFilter;
    }
    this.http
      .get<{ items: InventoryItemDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        `${this.inventoryApiUrl}/items`,
        { params }
      )
      .subscribe({
        next: (res) => {
          this.inventoryRegisterItems = res?.items || [];
          const pg = res?.pagination;
          this.inventoryRegisterPagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.inventoryRegisterPagination.limit,
            total: pg?.total ?? this.inventoryRegisterItems.length,
            totalPages: pg?.totalPages || 1
          };
          this.inventoryRegisterPageInput = this.inventoryRegisterPagination.page;
        },
        error: () => {
          this.inventoryRegisterItems = [];
        }
      });
  }

  onInventoryRegisterSearchInput(): void {
    if (this.inventoryRegisterSearchDebounce) clearTimeout(this.inventoryRegisterSearchDebounce);
    this.inventoryRegisterSearchDebounce = setTimeout(() => {
      this.loadInventoryRegisterItems(1);
    }, 300);
  }

  applyInventoryCategoryFilter(): void {
    this.loadInventoryRegisterItems(1);
  }

  changeInventoryRegisterPage(direction: 'prev' | 'next'): void {
    const next =
      direction === 'next' ? this.inventoryRegisterPagination.page + 1 : this.inventoryRegisterPagination.page - 1;
    if (next < 1 || next > this.inventoryRegisterPagination.totalPages) return;
    this.loadInventoryRegisterItems(next);
  }

  jumpInventoryRegisterPage(): void {
    const target = Math.max(
      1,
      Math.min(this.inventoryRegisterPagination.totalPages, Number(this.inventoryRegisterPageInput) || 1)
    );
    this.loadInventoryRegisterItems(target);
  }

  loadInventoryItemSelectOptions(): void {
    this.http
      .get<{ items: InventoryItemDto[] }>(`${this.inventoryApiUrl}/items`, {
        params: { page: 1, limit: 500, q: '' }
      })
      .subscribe({
        next: (res) => {
          this.inventoryItemSelectOptions = (res?.items || []).map((i) => ({ id: i.id, name: i.name }));
        },
        error: () => {
          this.inventoryItemSelectOptions = [];
        }
      });
  }

  openCreateInventoryItem(): void {
    this.inventoryEditingItemId = null;
    this.inventoryItemForm = this.getEmptyInventoryItemForm();
    this.inventoryItemFormOpen = true;
    this.inventoryItemError = '';
  }

  openEditInventoryItem(row: InventoryItemDto): void {
    this.inventoryEditingItemId = row.id;
    this.inventoryItemForm = {
      name: row.name,
      category: row.category,
      unit: row.unit || '',
      minStock: row.minStock != null ? Number(row.minStock) : 0,
      description: row.description || ''
    };
    this.inventoryItemFormOpen = true;
    this.inventoryItemError = '';
  }

  closeInventoryItemForm(): void {
    this.inventoryItemFormOpen = false;
    this.inventoryEditingItemId = null;
    this.inventoryItemSubmitting = false;
    this.inventoryItemError = '';
  }

  saveInventoryItem(): void {
    if (this.inventoryEditingItemId === null && !this.requireSingleClinicForCreate()) return;
    const name = this.inventoryItemForm.name.trim();
    if (!name) {
      this.inventoryItemError = 'Name is required.';
      return;
    }
    const payload: any = {
      name,
      category: this.inventoryItemForm.category,
      unit: this.inventoryItemForm.unit.trim() || null,
      minStock: this.inventoryItemForm.minStock,
      description: this.inventoryItemForm.description.trim() || null
    };
    this.inventoryItemSubmitting = true;
    this.inventoryItemError = '';
    const req$ =
      this.inventoryEditingItemId !== null
        ? this.http.put<{ item: InventoryItemDto }>(`${this.inventoryApiUrl}/items/${this.inventoryEditingItemId}`, payload)
        : this.http.post<{ item: InventoryItemDto }>(`${this.inventoryApiUrl}/items`, payload);
    req$.subscribe({
      next: () => {
        this.inventoryItemSubmitting = false;
        this.closeInventoryItemForm();
        this.loadInventoryRegisterItems(this.inventoryRegisterPagination.page);
        this.loadInventoryItemSelectOptions();
        this.loadStockViewData();
        this.loadInventoryDashboard();
      },
      error: (err) => {
        this.inventoryItemSubmitting = false;
        this.inventoryItemError = err?.error?.message || 'Unable to save item.';
      }
    });
  }

  deleteInventoryItem(row: InventoryItemDto): void {
    const confirmed = window.confirm(`Delete item "${row.name}"? This removes stock and movement history.`);
    if (!confirmed) return;
    this.http.delete(`${this.inventoryApiUrl}/items/${row.id}`).subscribe({
      next: () => {
        this.loadInventoryRegisterItems(this.inventoryRegisterPagination.page);
        this.loadInventoryItemSelectOptions();
        this.loadStockViewData();
        this.loadInventoryMovements(this.movementPagination.page);
        this.loadInventoryDashboard();
      },
      error: (err) => {
        window.alert(err?.error?.message || 'Unable to delete item.');
      }
    });
  }

  submitPurchase(): void {
    const itemId = this.purchaseForm.itemId;
    const qty = Number(this.purchaseForm.quantity);
    if (!itemId || !qty || qty < 1 || !Number.isInteger(qty)) {
      this.purchaseError = 'Select an item and enter a valid quantity.';
      return;
    }
    this.purchaseSubmitting = true;
    this.purchaseError = '';
    const body: any = {
      itemId,
      quantity: qty,
      purchaseDate: this.purchaseForm.purchaseDate || null,
      supplierName: this.purchaseForm.supplierName.trim() || null,
      purchasePrice: this.purchaseForm.purchasePrice,
      expiryDate: this.purchaseForm.expiryDate || null,
      batchNumber: this.purchaseForm.batchNumber.trim() || null,
      referenceType: 'purchase'
    };
    this.http.post(`${this.inventoryApiUrl}/purchase`, body).subscribe({
      next: () => {
        this.purchaseSubmitting = false;
        this.purchaseForm = {
          itemId: this.purchaseForm.itemId,
          quantity: 1,
          purchaseDate: '',
          supplierName: '',
          purchasePrice: null,
          expiryDate: '',
          batchNumber: ''
        };
        this.purchaseError = '';
        this.refreshAfterStockChange();
      },
      error: (err) => {
        this.purchaseSubmitting = false;
        this.purchaseError = err?.error?.message || 'Unable to add stock.';
      }
    });
  }

  onUseItemSelectChange(): void {
    const id = this.useForm.itemId;
    this.useError = '';
    this.useAvailableQty = 0;
    if (!id) return;
    this.http.get<{ item: InventoryItemDto & { totalQuantity?: number } }>(`${this.inventoryApiUrl}/items/${id}`).subscribe({
      next: (res) => {
        this.useAvailableQty = res?.item?.totalQuantity != null ? Number(res.item.totalQuantity) : 0;
      },
      error: () => {
        this.useAvailableQty = 0;
      }
    });
  }

  get useStockSubmitDisabled(): boolean {
    if (!this.useForm.itemId) return true;
    const q = Number(this.useForm.quantity);
    if (!Number.isInteger(q) || q < 1) return true;
    return q > this.useAvailableQty;
  }

  submitUseStock(): void {
    if (this.useStockSubmitDisabled) return;
    const itemId = this.useForm.itemId!;
    const qty = Number(this.useForm.quantity);
    this.useSubmitting = true;
    this.useError = '';
    this.http
      .post(`${this.inventoryApiUrl}/use`, { itemId, quantity: qty, referenceType: 'manual' })
      .subscribe({
        next: () => {
          this.useSubmitting = false;
          this.useForm.quantity = 1;
          this.onUseItemSelectChange();
          this.refreshAfterStockChange();
        },
        error: (err) => {
          this.useSubmitting = false;
          this.useError = err?.error?.message || 'Unable to use stock.';
          if (err?.error?.available != null) {
            this.useAvailableQty = Number(err.error.available);
          }
        }
      });
  }

  private refreshAfterStockChange(): void {
    this.loadInventoryRegisterItems(this.inventoryRegisterPagination.page);
    this.loadStockViewData();
    this.loadInventoryMovements(this.movementPagination.page);
    this.loadInventoryItemSelectOptions();
    this.loadInventoryDashboard();
  }

  loadStockViewData(): void {
    this.http
      .get<{ items: InventorySummaryRow[] }>(`${this.inventoryApiUrl}/summary`)
      .subscribe({
        next: (res) => {
          this.stockViewSummary = res?.items || [];
          this.stockViewBatches = {};
          this.stockViewExpandedId = null;
        },
        error: () => {
          this.stockViewSummary = [];
        }
      });
  }

  toggleStockBatches(itemId: number): void {
    if (this.stockViewExpandedId === itemId) {
      this.stockViewExpandedId = null;
      return;
    }
    this.stockViewExpandedId = itemId;
    if (this.stockViewBatches[itemId]) return;
    this.http.get<{ batches: any[] }>(`${this.inventoryApiUrl}/items/${itemId}/batches`).subscribe({
      next: (res) => {
        this.stockViewBatches[itemId] = (res?.batches || []).map((b) => ({
          id: b.id,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
          batchNumber: b.batchNumber || '',
          purchaseDate: b.purchaseDate
        }));
      },
      error: () => {
        this.stockViewBatches[itemId] = [];
      }
    });
  }

  loadInventoryMovements(page = this.movementPagination.page): void {
    const params: Record<string, string | number> = {
      page,
      limit: this.movementPagination.limit
    };
    if (this.movementFilters.itemId) params['itemId'] = Number(this.movementFilters.itemId);
    if (this.movementFilters.fromDate) params['fromDate'] = this.movementFilters.fromDate;
    if (this.movementFilters.toDate) params['toDate'] = this.movementFilters.toDate;
    this.http
      .get<{
        movements: Array<{
          id: number;
          itemId: number;
          itemName: string;
          type: string;
          quantity: number;
          referenceType: string;
          referenceId: number | null;
          notes: string;
          createdAt: string;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.inventoryApiUrl}/movements`, { params })
      .subscribe({
        next: (res) => {
          this.movementRows = res?.movements || [];
          const pg = res?.pagination;
          this.movementPagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.movementPagination.limit,
            total: pg?.total ?? this.movementRows.length,
            totalPages: pg?.totalPages || 1
          };
          this.movementPageInput = this.movementPagination.page;
        },
        error: () => {
          this.movementRows = [];
        }
      });
  }

  applyMovementFilters(): void {
    this.loadInventoryMovements(1);
  }

  changeMovementPage(direction: 'prev' | 'next'): void {
    const next = direction === 'next' ? this.movementPagination.page + 1 : this.movementPagination.page - 1;
    if (next < 1 || next > this.movementPagination.totalPages) return;
    this.loadInventoryMovements(next);
  }

  jumpMovementPage(): void {
    const target = Math.max(1, Math.min(this.movementPagination.totalPages, Number(this.movementPageInput) || 1));
    this.loadInventoryMovements(target);
  }

  formatMovementReference(m: {
    referenceType: string;
    referenceId: number | null;
    notes: string;
  }): string {
    const rt = (m.referenceType || '').trim();
    if (rt && m.referenceId != null) return `${rt} #${m.referenceId}`;
    if (rt) return rt;
    if (m.notes) return m.notes;
    return '—';
  }

  formatMovementDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.toLocaleString();
  }

  loadInventoryReport(): void {
    this.inventoryReportLoading = true;
    this.http
      .get<{
        items: InventorySummaryRow[];
        lowStockItems: InventorySummaryRow[];
        expiringBatches: Array<{
          stockId: number;
          itemId: number;
          itemName: string;
          quantity: number;
          batchNumber: string;
          expiryDate: string | null;
          purchaseDate: string | null;
        }>;
        expiringWithinDays: number;
      }>(`${this.inventoryApiUrl}/summary`)
      .subscribe({
        next: (res) => {
          this.inventoryReportData = res;
          this.inventoryReportLoading = false;
        },
        error: () => {
          this.inventoryReportData = null;
          this.inventoryReportLoading = false;
        }
      });
  }

  get inventoryReportTotalItems(): number {
    return this.inventoryReportData?.items?.length ?? 0;
  }

  get inventoryReportLowStockCount(): number {
    return this.inventoryReportData?.lowStockItems?.length ?? 0;
  }

  get inventoryReportExpiringCount(): number {
    return this.inventoryReportData?.expiringBatches?.length ?? 0;
  }

  openInventoryHelp(): void {
    this.inventoryHelpOpen = true;
  }

  closeInventoryHelp(): void {
    this.inventoryHelpOpen = false;
  }

  loadOrganisation(): void {
    if (this.user?.role === 'Staff') {
      this.orgLoading = true;
      const savedOrganisation = localStorage.getItem('organisation');
      if (savedOrganisation) {
        try {
          this.organisation = { ...this.organisation, ...JSON.parse(savedOrganisation) };
        } catch {
          /* ignore */
        }
      }
      this.applyBranding();
      this.orgLoading = false;
      return;
    }
    this.orgLoading = true;
    this.http.get<{ organisation: OrganisationSettings }>(this.organisationApiUrl).subscribe({
      next: (res) => {
        if (res && res.organisation) {
          this.organisation = { ...this.organisation, ...res.organisation };
          localStorage.setItem('organisation', JSON.stringify(this.organisation));
        }
        this.applyBranding();
        this.orgLoading = false;
      },
      error: () => {
        const savedOrganisation = localStorage.getItem('organisation');
        if (savedOrganisation) {
          this.organisation = { ...this.organisation, ...JSON.parse(savedOrganisation) };
        }
        this.applyBranding();
        this.orgLoading = false;
      }
    });
  }

  private applyBranding(): void {
    const title = (this.organisation?.name || '').trim() || this.defaultTabTitle;
    document.title = title;
    this.applyFavicon(this.organisation?.logo || this.defaultFaviconPath);
  }

  private applyFavicon(url: string): void {
    const head = document.head;
    if (!head) return;
    let link = head.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      head.appendChild(link);
    }
    link.type = url.startsWith('data:image') ? 'image/png' : 'image/x-icon';
    link.href = url || this.defaultFaviconPath;
  }

  get isRegisterPage(): boolean {
    return this.active.endsWith('-register');
  }

  get activeRegisterKey(): string {
    return this.active.split('-')[0];
  }

  registerData: Record<string, Array<Record<string, any>>> = {
    doctor: [
      { id: 1, name: 'Dr. Alice Smith', specialty: 'Orthodontics', email: 'alice.smith@clinic.com' },
      { id: 2, name: 'Dr. Brian Shaw', specialty: 'Endodontics', email: 'brian.shaw@clinic.com' },
      { id: 3, name: 'Dr. Carla Zee', specialty: 'Pediatric', email: 'carla.zee@clinic.com' }
    ],
    patients: [
      { id: 1, name: 'John Doe', age: 34, status: 'Active', email: 'john.doe@example.com' },
      { id: 2, name: 'Maria Gomez', age: 28, status: 'Active', email: 'maria.gomez@example.com' },
      { id: 3, name: 'Luke Martin', age: 47, status: 'Pending', email: 'luke.martin@example.com' }
    ],
    staff: [],
    inventory: [
      { id: 1, item: 'Latex Gloves', qty: 200, status: 'In Stock' },
      { id: 2, item: 'Dental Floss', qty: 150, status: 'In Stock' },
      { id: 3, item: 'Anesthetic', qty: 40, status: 'Low Stock' }
    ],
  };

  get activeRegisterRows() {
    if (this.activeRegisterKey === 'doctor') {
      return this.doctorRows;
    }
    if (this.activeRegisterKey === 'patients') {
      return this.patientRows;
    }
    if (this.activeRegisterKey === 'staff') {
      return this.staffRows;
    }
    if (this.activeRegisterKey === 'appointment') {
      return this.appointmentRows;
    }
    return this.registerData[this.activeRegisterKey] || [];
  }

  get activeRegisterColumns(): string[] {
    return this.activeRegisterRows.length ? Object.keys(this.activeRegisterRows[0]) : [];
  }

  get filteredRegisterRows(): Array<Record<string, any>> {
    let rows = this.activeRegisterRows;
    const filters = Object.entries(this.columnFilters).filter(([_, value]) => value.trim() !== '');
    
    if (filters.length > 0) {
      rows = rows.filter(row => {
        return filters.every(([key, filterValue]) => {
          const cellValue = String(row[key] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      });
    }
    
    return rows;
  }

  get registerTotalRows(): number {
    if (this.activeRegisterKey === 'doctor') return this.doctorPagination.total;
    if (this.activeRegisterKey === 'patients') return this.patientPagination.total;
    if (this.activeRegisterKey === 'staff') return this.staffPagination.total;
    return this.filteredRegisterRows.length;
  }

  get registerTotalPages(): number {
    if (this.activeRegisterKey === 'doctor') return this.doctorPagination.totalPages;
    if (this.activeRegisterKey === 'patients') return this.patientPagination.totalPages;
    if (this.activeRegisterKey === 'staff') return this.staffPagination.totalPages;
    return Math.max(1, Math.ceil(this.filteredRegisterRows.length / this.registerPageSize));
  }

  get paginatedRegisterRows(): Array<Record<string, any>> {
    if (this.activeRegisterKey === 'doctor' || this.activeRegisterKey === 'patients' || this.activeRegisterKey === 'staff') {
      return this.filteredRegisterRows;
    }
    const start = (this.registerPage - 1) * this.registerPageSize;
    return this.filteredRegisterRows.slice(start, start + this.registerPageSize);
  }

  get selectedDoctorRegisterRow(): DoctorRow | null {
    const rows = this.doctorRows || [];
    if (!rows.length) return null;
    if (this.doctorRegisterSelectedId == null) return rows[0];
    return rows.find((row) => Number(row.id) === this.doctorRegisterSelectedId) || rows[0];
  }

  selectDoctorRegister(row: Record<string, any>): void {
    const id = Number(row?.['id']);
    this.doctorRegisterSelectedId = Number.isFinite(id) ? id : null;
  }

  private ensureDoctorRegisterSelection(): void {
    if (!this.doctorRows.length) {
      this.doctorRegisterSelectedId = null;
      return;
    }
    const selectedStillVisible = this.doctorRows.some((row) => Number(row.id) === this.doctorRegisterSelectedId);
    if (!selectedStillVisible) {
      this.doctorRegisterSelectedId = Number(this.doctorRows[0].id);
    }
  }

  get selectedPatientRegisterRow(): PatientRow | null {
    const rows = this.patientRows || [];
    if (!rows.length) return null;
    if (this.patientRegisterSelectedId == null) return rows[0];
    return rows.find((row) => Number(row.id) === this.patientRegisterSelectedId) || rows[0];
  }

  selectPatientRegister(row: Record<string, any>): void {
    const id = Number(row?.['id']);
    this.patientRegisterSelectedId = Number.isFinite(id) ? id : null;
  }

  openPatientDetails(row: Record<string, any>): void {
    const id = Number(row?.['id']);
    if (!Number.isFinite(id)) return;
    this.patientDetailRow = row as PatientRow;
    this.patientDetailTab = 'history';
    this.active = 'patients-detail';
    this.loadPatientDetailData(id);
  }

  setPatientDetailTab(tab: 'history' | 'plan' | 'documents' | 'billing' | 'xrays'): void {
    this.patientDetailTab = tab;
  }

  closePatientDetails(): void {
    this.active = 'patients-register';
    this.patientDetailError = '';
  }

  private ensurePatientRegisterSelection(): void {
    if (!this.patientRows.length) {
      this.patientRegisterSelectedId = null;
      return;
    }
    const selectedStillVisible = this.patientRows.some((row) => Number(row.id) === this.patientRegisterSelectedId);
    if (!selectedStillVisible) {
      this.patientRegisterSelectedId = Number(this.patientRows[0].id);
    }
  }

  private loadPatientDetailData(patientId: number): void {
    this.patientDetailLoading = true;
    this.patientDetailError = '';
    const patientName = String(this.patientDetailRow?.username || '').trim().toLowerCase();

    forkJoin({
      patient: this.http
        .get<{ patient: PatientRow }>(`${this.patientApiUrl}/${patientId}`)
        .pipe(map((res) => res?.patient || null), catchError(() => of(null))),
      appointments: this.http
        .get<{ appointments: AppointmentRow[] }>(this.appointmentApiUrl, { params: { page: 1, limit: 600 } })
        .pipe(map((res) => res?.appointments || []), catchError(() => of([]))),
      bills: this.http
        .get<{
          bills: Array<{
            id: number;
            patientName: string;
            patientId?: number;
            finalAmount: number;
            paidAmount: number;
            status: string;
            billDate: string;
          }>;
        }>(`${this.financialApiUrl}/bills`, { params: { page: 1, limit: 600 } })
        .pipe(map((res) => res?.bills || []), catchError(() => of([]))),
      patientDocs: this.http
        .get<{ attachments: AttachmentMetaRow[] }>(this.attachmentApiUrl, {
          params: { entityType: 'patient', entityId: String(patientId), page: 1, limit: 200 }
        })
        .pipe(map((res) => res?.attachments || []), catchError(() => of([]))),
      medicalDocs: this.http
        .get<{ attachments: AttachmentMetaRow[] }>(this.attachmentApiUrl, {
          params: { entityType: 'medical_record', entityId: String(patientId), page: 1, limit: 200 }
        })
        .pipe(map((res) => res?.attachments || []), catchError(() => of([])))
    }).subscribe({
      next: ({ patient, appointments, bills, patientDocs, medicalDocs }) => {
        if (patient) this.patientDetailRow = patient;

        this.patientDetailAppointments = (appointments || [])
          .filter((a) => Number(a.patientId) === patientId)
          .sort((a, b) => this.toTimestamp(b.appointmentDate, b.startTime) - this.toTimestamp(a.appointmentDate, a.startTime));

        this.patientDetailBills = (bills || [])
          .filter((b) => {
            const billPatientId = Number((b as any)?.patientId);
            if (Number.isFinite(billPatientId)) return billPatientId === patientId;
            return patientName && String(b.patientName || '').trim().toLowerCase() === patientName;
          })
          .sort((a, b) => this.toTimestamp(b.billDate) - this.toTimestamp(a.billDate));

        this.patientDetailDocuments = [...(patientDocs || []), ...(medicalDocs || [])].sort(
          (a, b) => this.toTimestamp(b.createdDate || '') - this.toTimestamp(a.createdDate || '')
        );
        this.patientDetailLoading = false;
      },
      error: () => {
        this.patientDetailAppointments = [];
        this.patientDetailBills = [];
        this.patientDetailDocuments = [];
        this.patientDetailLoading = false;
        this.patientDetailError = 'Unable to load patient details.';
      }
    });
  }

  private toTimestamp(date: string | null | undefined, time?: string | null): number {
    if (!date) return 0;
    const d = new Date(time ? `${date}T${time}` : date);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  get patientDetailXrayDocs(): AttachmentMetaRow[] {
    return this.patientDetailDocuments.filter((d) => {
      const t = String(d.documentType || '').toLowerCase();
      return t.includes('xray') || t.includes('x-ray');
    });
  }

  get patientDetailHistoryRows(): AppointmentRow[] {
    return this.patientDetailAppointments.filter((a) => a.status === 'completed');
  }

  get patientDetailUpcomingAppointments(): AppointmentRow[] {
    return this.patientDetailAppointments.filter((a) => a.status === 'scheduled');
  }

  getPatientHistoryAmount(appointmentDate: string | null | undefined): number | null {
    if (!appointmentDate) return null;
    const bill = this.patientDetailBills.find((b) => String(b.billDate || '').slice(0, 10) === String(appointmentDate).slice(0, 10));
    if (!bill) return null;
    return Number.isFinite(Number(bill.finalAmount)) ? Number(bill.finalAmount) : null;
  }

  private isDateWithinDays(dateValue: string | null | undefined, days: number): boolean {
    if (!dateValue) return false;
    const dt = new Date(dateValue);
    const t = dt.getTime();
    if (!Number.isFinite(t)) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((t - now.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= days;
  }

  get paginatedInventoryRows(): { item: string; qty: number; status: string; cost: string }[] {
    const start = (this.inventoryPage - 1) * this.inventoryPageSize;
    return this.filteredInventoryRows.slice(start, start + this.inventoryPageSize);
  }

  get inventoryTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredInventoryRows.length / this.inventoryPageSize));
  }

  getRowKeys(row: Record<string, any>): string[] {
    return Object.keys(row);
  }

  applyFilters(): void {
    // This method is called when filter inputs change
    // The filteredRegisterRows getter will automatically update
    this.registerPage = 1;
  }

  applyInventoryFilters(): void {
    // This method is called when inventory filter inputs change
    // The filteredInventoryRows getter will automatically update
    this.inventoryPage = 1;
  }

  changeRegisterPage(direction: 'prev' | 'next'): void {
    const next = direction === 'next' ? this.registerPage + 1 : this.registerPage - 1;
    if (next < 1 || next > this.registerTotalPages) return;

    if (this.activeRegisterKey === 'doctor') {
      this.loadDoctors(next, this.registerPageSize);
      return;
    }
    if (this.activeRegisterKey === 'patients') {
      this.loadPatients(next, this.registerPageSize);
      return;
    }
    if (this.activeRegisterKey === 'staff') {
      this.loadStaff(next, this.registerPageSize);
      return;
    }

    this.registerPage = next;
    this.registerPageInput = next;
  }

  changeInventoryPage(direction: 'prev' | 'next'): void {
    const next = direction === 'next' ? this.inventoryPage + 1 : this.inventoryPage - 1;
    if (next < 1 || next > this.inventoryTotalPages) return;
    this.inventoryPage = next;
    this.inventoryPageInput = next;
  }

  jumpRegisterPage(): void {
    const target = Math.max(1, Math.min(this.registerTotalPages, Number(this.registerPageInput) || 1));
    if (this.activeRegisterKey === 'doctor') {
      this.loadDoctors(target, this.registerPageSize);
      return;
    }
    if (this.activeRegisterKey === 'patients') {
      this.loadPatients(target, this.registerPageSize);
      return;
    }
    if (this.activeRegisterKey === 'staff') {
      this.loadStaff(target, this.registerPageSize);
      return;
    }
    this.registerPage = target;
  }

  jumpInventoryPage(): void {
    const target = Math.max(1, Math.min(this.inventoryTotalPages, Number(this.inventoryPageInput) || 1));
    this.inventoryPage = target;
  }

  onRegisterSearchInput(): void {
    if (this.registerSearchDebounce) clearTimeout(this.registerSearchDebounce);
    this.registerSearchDebounce = setTimeout(() => {
      this.registerPage = 1;
      this.registerPageInput = 1;
      if (this.activeRegisterKey === 'doctor') {
        this.loadDoctors(1, this.registerPageSize);
      } else if (this.activeRegisterKey === 'patients') {
        this.loadPatients(1, this.registerPageSize);
      } else if (this.activeRegisterKey === 'staff') {
        this.loadStaff(1, this.registerPageSize);
      }
    }, 300);
  }

  downloadCsv(records: Array<Record<string, any>>, filename = 'register-table.csv') {
    if (!records || records.length === 0) return;
    const columns = Object.keys(records[0]);
    const csv = [columns.join(',')].concat(records.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    link.click();
  }

  downloadRow(row: Record<string, any>) {
    const idValue = row['id'] || row['name'] || 'row';
    this.downloadCsv([row], `${this.activeRegisterKey}-row-${idValue}.csv`);
  }

  downloadExcel(records: Array<Record<string, any>>, filename = 'register-table.xlsx') {
    if (!records || records.length === 0) return;
    void import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(records);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, filename);
    });
  }

  downloadPdf(records: Array<Record<string, any>>, filename = 'register-table.pdf') {
    if (!records || records.length === 0) return;
    void Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([jsPDFMod, autoTableMod]) => {
      const jsPDF = jsPDFMod.default;
      const autoTable = autoTableMod.default;
      const doc = new jsPDF();

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const headerH = this.organisation.headerImage ? 20 : 0;
      const footerH = this.organisation.footerImage ? 18 : 0;

      const imageFormat = (dataUrl: string): 'PNG' | 'JPEG' => {
        return dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      };

      const drawBranding = () => {
        if (this.organisation.headerImage && this.organisation.headerImage.startsWith('data:image')) {
          doc.addImage(this.organisation.headerImage, imageFormat(this.organisation.headerImage), 0, 0, pageW, headerH || 20);
        }
        if (this.organisation.footerImage && this.organisation.footerImage.startsWith('data:image')) {
          doc.addImage(this.organisation.footerImage, imageFormat(this.organisation.footerImage), 0, pageH - (footerH || 18), pageW, footerH || 18);
        }
        if (this.organisation.addSeal && this.organisation.sealImage && this.organisation.sealImage.startsWith('data:image')) {
          const sealSize = 26;
          doc.addImage(
            this.organisation.sealImage,
            imageFormat(this.organisation.sealImage),
            pageW - sealSize - 10,
            pageH - (footerH || 0) - sealSize - 6,
            sealSize,
            sealSize
          );
        }
      };

      autoTable(doc, {
        head: [Object.keys(records[0])],
        body: records.map((r) => Object.values(r)),
        startY: headerH + 8,
        margin: { bottom: footerH + 8, left: 10, right: 10 },
        didDrawPage: () => drawBranding()
      });
      doc.save(filename);
    });
  }

  toggleDownloadDropdown(type: 'table' | 'row', row?: Record<string, any>, event?: MouseEvent) {
    event?.stopPropagation();
    if (this.showDownloadDropdown === type && this.activeRowForDownload === row) {
      this.showDownloadDropdown = null;
      this.activeRowForDownload = null;
    } else {
      this.showDownloadDropdown = type;
      this.activeRowForDownload = row || null;
    }
  }

  @HostListener('document:click')
  closeDownloadDropdown(): void {
    this.showDownloadDropdown = null;
    this.activeRowForDownload = null;
  }

  download(format: 'csv' | 'excel' | 'pdf', type: 'table' | 'row') {
    const records = type === 'table' ? this.filteredRegisterRows : (this.activeRowForDownload ? [this.activeRowForDownload] : []);
    if (!records.length) return;

    const baseFilename = type === 'table' ? `${this.activeRegisterKey}-register` : `${this.activeRegisterKey}-row-${this.activeRowForDownload!['id'] || this.activeRowForDownload!['name'] || 'row'}`;

    switch (format) {
      case 'csv':
        this.downloadCsv(records, `${baseFilename}.csv`);
        break;
      case 'excel':
        this.downloadExcel(records, `${baseFilename}.xlsx`);
        break;
      case 'pdf':
        this.downloadPdf(records, `${baseFilename}.pdf`);
        break;
    }

    this.showDownloadDropdown = null;
    this.activeRowForDownload = null;
  }

  updateNotification(section: NotificationSection, medium: NotificationMedium, value: boolean): void {
    this.notificationSettings[section][medium] = value;
    localStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
  }

  saveUser(): void {
    // In a real app, save to backend
    console.log('Saving user:', this.user);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePic = e.target?.result as string;
        localStorage.setItem('profilePic', this.profilePic);
      };
      reader.readAsDataURL(file);
    }
  }

  private normalizeNotificationSettings(raw: any) {
    const defaults = {
      email: { push: true, email: false, sms: false },
      message: { push: true, email: false, sms: false }
    };

    const coerce = (value: any, fallback: NotificationSection) => ({
      push: typeof value?.push === 'boolean' ? value.push : defaults[fallback].push,
      email: typeof value?.email === 'boolean' ? value.email : defaults[fallback].email,
      sms: typeof value?.sms === 'boolean' ? value.sms : defaults[fallback].sms
    });

    return {
      email: coerce(raw?.email ?? raw?.comments, 'email'),
      message: coerce(raw?.message ?? raw?.tags, 'message')
    };
  }

  private getEmptyDoctorForm() {
    return {
      username: '',
      email: '',
      specialization: '',
      experience: null,
      qualification: '',
      consultationFee: null,
      availableTime: '',
      profileImage: ''
    };
  }

  loadDoctors(page = this.doctorPagination.page, limit = this.registerPageSize): void {
    this.http
      .get<{ doctors: DoctorRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(this.doctorApiUrl, {
        params: { page, limit, q: this.registerSearch.trim() }
      })
      .subscribe({
      next: (res) => {
        this.doctorRows = (res?.doctors || []).map((doctor) => ({
          ...doctor,
          consultationFee: doctor.consultationFee !== null && doctor.consultationFee !== undefined ? Number(doctor.consultationFee) : null
        }));
        this.ensureDoctorRegisterSelection();
        const pg = res?.pagination;
        this.doctorPagination = {
          page: pg?.page || page,
          limit: pg?.limit || limit,
          total: pg?.total || this.doctorRows.length,
          totalPages: pg?.totalPages || 1
        };
        this.registerPage = this.doctorPagination.page;
        this.registerPageInput = this.doctorPagination.page;
      },
      error: () => {
        this.doctorFormError = 'Unable to load doctors from backend.';
      }
      });
  }

  openCreateDoctor(): void {
    this.editingDoctorId = null;
    this.doctorForm = this.getEmptyDoctorForm();
    this.doctorFormOpen = true;
    this.doctorFormError = '';
  }

  openEditDoctor(row: any): void {
    this.editingDoctorId = Number(row.id);
    this.doctorForm = {
      username: row.username || '',
      email: row.email || '',
      specialization: row.specialization || '',
      experience: row.experience !== null && row.experience !== undefined ? Number(row.experience) : null,
      qualification: row.qualification || '',
      consultationFee: row.consultationFee !== null && row.consultationFee !== undefined ? Number(row.consultationFee) : null,
      availableTime: row.availableTime || '',
      profileImage: row.profileImage || ''
    };
    this.doctorFormOpen = true;
    this.doctorFormError = '';
  }

  closeDoctorForm(): void {
    this.doctorFormOpen = false;
    this.doctorSubmitting = false;
    this.editingDoctorId = null;
    this.doctorFormError = '';
  }

  onDoctorImageSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.doctorForm.profileImage = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  }

  toggleDoctorTimeSlot(slot: string): void {
    const selected = this.doctorForm.availableTime
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = selected.includes(slot);
    const next = exists ? selected.filter((s) => s !== slot) : [...selected, slot];
    this.doctorForm.availableTime = next.join(', ');
  }

  isDoctorTimeSlotSelected(slot: string): boolean {
    return this.doctorForm.availableTime
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(slot);
  }

  saveDoctor(): void {
    const payload: any = {
      username: this.doctorForm.username.trim(),
      email: this.doctorForm.email.trim(),
      specialization: this.doctorForm.specialization.trim(),
      experience: this.doctorForm.experience,
      qualification: this.doctorForm.qualification.trim(),
      consultationFee: this.doctorForm.consultationFee,
      availableTime: this.doctorForm.availableTime.trim(),
      profileImage: this.doctorForm.profileImage || null
    };

    if (!payload.username || !payload.email) {
      this.doctorFormError = 'Username and email are required.';
      return;
    }

    if (this.editingDoctorId === null && !this.requireSingleClinicForCreate()) return;

    this.doctorSubmitting = true;
    this.doctorFormError = '';

    const request$ = this.editingDoctorId !== null
      ? this.http.put<{ doctors: DoctorRow[] }>(`${this.doctorApiUrl}/${this.editingDoctorId}`, payload)
      : this.http.post<{ doctors: DoctorRow[] }>(this.doctorApiUrl, payload);

    request$.subscribe({
      next: () => {
        this.loadDoctors(this.doctorPagination.page, this.registerPageSize);
        this.loadActiveDoctorsForDropdowns();
        this.closeDoctorForm();
      },
      error: (err) => {
        this.doctorSubmitting = false;
        this.doctorFormError = err?.error?.message || 'Unable to save doctor.';
      }
    });
  }

  deleteDoctor(row: any): void {
    const confirmed = window.confirm(`Delete doctor "${row.username || row.id}"?`);
    if (!confirmed) return;

    this.http
      .delete<{ doctors: DoctorRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(
        `${this.doctorApiUrl}/${row.id}`,
        { params: { page: this.doctorPagination.page, limit: this.registerPageSize, q: this.registerSearch.trim() } }
      )
      .subscribe({
        next: (res) => {
          this.doctorRows = (res?.doctors || []).map((doctor) => ({
            ...doctor,
            consultationFee: doctor.consultationFee !== null && doctor.consultationFee !== undefined ? Number(doctor.consultationFee) : null
          }));
          const pg = res?.pagination;
          this.doctorPagination = {
            page: pg?.page || this.doctorPagination.page,
            limit: pg?.limit || this.registerPageSize,
            total: pg?.total || this.doctorRows.length,
            totalPages: pg?.totalPages || 1
          };
          this.registerPage = this.doctorPagination.page;
          this.registerPageInput = this.doctorPagination.page;
          this.loadActiveDoctorsForDropdowns();
        },
        error: (err) => {
          this.doctorFormError = err?.error?.message || 'Unable to delete doctor.';
        }
      });
  }

  private getEmptyStaffForm() {
    return {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      staffType: 'other' as StaffType,
      department: '',
      canLogin: true,
      isActive: true,
      joiningDate: '',
      salary: null as number | null,
      notes: '',
      profileImage: ''
    };
  }

  loadStaff(page = this.staffPagination.page, limit = this.registerPageSize): void {
    this.http
      .get<{ staff: StaffRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(this.staffApiUrl, {
        params: { page, limit, q: this.registerSearch.trim() }
      })
      .subscribe({
        next: (res) => {
          this.staffRows = (res?.staff || []).map((s) => ({
            ...s,
            salary: s.salary !== null && s.salary !== undefined ? Number(s.salary) : null
          }));
          const pg = res?.pagination;
          this.staffPagination = {
            page: pg?.page || page,
            limit: pg?.limit || limit,
            total: pg?.total || this.staffRows.length,
            totalPages: pg?.totalPages || 1
          };
          this.registerPage = this.staffPagination.page;
          this.registerPageInput = this.staffPagination.page;
        },
        error: () => {
          this.staffFormError = 'Unable to load staff from backend.';
        }
      });
  }

  openCreateStaff(): void {
    this.editingStaffId = null;
    this.staffForm = this.getEmptyStaffForm();
    this.staffFormOpen = true;
    this.staffFormError = '';
  }

  openEditStaff(row: any): void {
    this.editingStaffId = Number(row.id);
    this.staffForm = {
      username: row.username || '',
      email: row.email || '',
      password: '',
      confirmPassword: '',
      staffType: (row.staffType || 'other') as StaffType,
      department: row.department || '',
      canLogin: !!row.canLogin,
      isActive: !!row.isActive,
      joiningDate: row.joiningDate || '',
      salary: row.salary !== null && row.salary !== undefined ? Number(row.salary) : null,
      notes: row.notes || '',
      profileImage: row.profileImage || ''
    };
    this.staffFormOpen = true;
    this.staffFormError = '';
  }

  closeStaffForm(): void {
    this.staffFormOpen = false;
    this.staffSubmitting = false;
    this.editingStaffId = null;
    this.staffFormError = '';
    this.staffForm.password = '';
    this.staffForm.confirmPassword = '';
  }

  onStaffImageSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.staffForm.profileImage = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  }

  saveStaff(): void {
    const pw = this.staffForm.password;
    const confirm = this.staffForm.confirmPassword;
    const isCreate = this.editingStaffId === null;

    if (isCreate) {
      if (!pw || !pw.trim()) {
        this.staffFormError = 'Password is required.';
        return;
      }
      if (pw !== confirm) {
        this.staffFormError = 'Password and confirm password do not match.';
        return;
      }
      if (pw.trim().length < 4) {
        this.staffFormError = 'Password must be at least 4 characters.';
        return;
      }
    } else {
      const hasPw = !!(pw && pw.trim());
      const hasConfirm = !!(confirm && confirm.trim());
      if (hasPw || hasConfirm) {
        if (pw !== confirm) {
          this.staffFormError = 'Password and confirm password do not match.';
          return;
        }
        if (!pw || !pw.trim() || pw.trim().length < 4) {
          this.staffFormError = 'New password must be at least 4 characters.';
          return;
        }
      }
    }

    const payload: any = {
      username: this.staffForm.username.trim(),
      email: this.staffForm.email.trim(),
      staffType: this.staffForm.staffType,
      department: this.staffForm.department.trim(),
      canLogin: this.staffForm.canLogin,
      isActive: this.staffForm.isActive,
      joiningDate: this.staffForm.joiningDate || null,
      salary: this.staffForm.salary,
      notes: this.staffForm.notes.trim(),
      profileImage: this.staffForm.profileImage || null
    };

    if (isCreate) {
      payload.password = pw.trim();
    } else if (pw && pw.trim()) {
      payload.password = pw.trim();
    }

    if (!payload.username || !payload.email) {
      this.staffFormError = 'Username and email are required.';
      return;
    }

    if (isCreate && !this.requireSingleClinicForCreate()) return;

    this.staffSubmitting = true;
    this.staffFormError = '';

    const request$ =
      this.editingStaffId !== null
        ? this.http.put<{ staff: StaffRow[] }>(`${this.staffApiUrl}/${this.editingStaffId}`, payload)
        : this.http.post<{ staff: StaffRow[] }>(this.staffApiUrl, payload);

    request$.subscribe({
      next: () => {
        this.loadStaff(this.staffPagination.page, this.registerPageSize);
        this.closeStaffForm();
      },
      error: (err) => {
        this.staffSubmitting = false;
        this.staffFormError = err?.error?.message || 'Unable to save staff.';
      }
    });
  }

  deleteStaff(row: any): void {
    const confirmed = window.confirm(`Delete staff "${row.username || row.id}"?`);
    if (!confirmed) return;

    this.http
      .delete<{ staff: StaffRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`${this.staffApiUrl}/${row.id}`, {
        params: { page: this.staffPagination.page, limit: this.registerPageSize, q: this.registerSearch.trim() }
      })
      .subscribe({
        next: (res) => {
          this.staffRows = (res?.staff || []).map((s) => ({
            ...s,
            salary: s.salary !== null && s.salary !== undefined ? Number(s.salary) : null
          }));
          const pg = res?.pagination;
          this.staffPagination = {
            page: pg?.page || this.staffPagination.page,
            limit: pg?.limit || this.registerPageSize,
            total: pg?.total || this.staffRows.length,
            totalPages: pg?.totalPages || 1
          };
          this.registerPage = this.staffPagination.page;
          this.registerPageInput = this.staffPagination.page;
        },
        error: (err) => {
          this.staffFormError = err?.error?.message || 'Unable to delete staff.';
        }
      });
  }

  private getEmptyClinicForm() {
    return {
      name: '',
      address: '',
      phone: '',
      email: ''
    };
  }

  loadClinics(): void {
    if (!this.canManageUserAccounts) return;
    this.clinicLoading = true;
    this.http.get<{ clinics: ClinicRow[] }>(this.clinicsApiUrl).subscribe({
      next: (res) => {
        this.clinicRows = (res?.clinics || []).map((c) => ({
          ...c,
          doctorCount: c.doctorCount ?? 0,
          patientCount: c.patientCount ?? 0
        }));
        this.clinicLoading = false;
        this.loadClinicCounts();
      },
      error: () => {
        this.clinicRows = [];
        this.clinicLoading = false;
        this.toast.error('Unable to load clinics.');
      }
    });
  }

  private loadClinicCounts(): void {
    if (!this.clinicRows.length) return;
    forkJoin({
      doctors: this.http
        .get<{ doctors: Array<Record<string, any>> }>(this.doctorApiUrl, {
          params: { page: 1, limit: 2000, q: '' }
        })
        .pipe(catchError(() => of({ doctors: [] }))),
      patients: this.http
        .get<{ patients: Array<Record<string, any>> }>(this.patientApiUrl, {
          params: { page: 1, limit: 2000, q: '' }
        })
        .pipe(catchError(() => of({ patients: [] })))
    }).subscribe(({ doctors, patients }) => {
      const doctorCounts = new Map<number, number>();
      const patientCounts = new Map<number, number>();

      for (const row of doctors.doctors || []) {
        const clinicId = Number(row?.['clinicId']);
        if (!Number.isFinite(clinicId) || clinicId <= 0) continue;
        doctorCounts.set(clinicId, (doctorCounts.get(clinicId) || 0) + 1);
      }
      for (const row of patients.patients || []) {
        const clinicId = Number(row?.['clinicId']);
        if (!Number.isFinite(clinicId) || clinicId <= 0) continue;
        patientCounts.set(clinicId, (patientCounts.get(clinicId) || 0) + 1);
      }

      this.clinicRows = this.clinicRows.map((row) => ({
        ...row,
        doctorCount: doctorCounts.get(row.id) || 0,
        patientCount: patientCounts.get(row.id) || 0
      }));
    });
  }

  openCreateClinic(): void {
    this.editingClinicId = null;
    this.clinicForm = this.getEmptyClinicForm();
    this.clinicFormOpen = true;
    this.clinicFormError = '';
  }

  openEditClinic(row: ClinicRow): void {
    this.editingClinicId = row.id;
    this.clinicForm = {
      name: row.name || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || ''
    };
    this.clinicFormOpen = true;
    this.clinicFormError = '';
  }

  closeClinicForm(): void {
    this.clinicFormOpen = false;
    this.clinicSubmitting = false;
    this.editingClinicId = null;
    this.clinicFormError = '';
  }

  saveClinic(): void {
    const name = this.clinicForm.name.trim();
    if (!name) {
      this.clinicFormError = 'Clinic name is required.';
      return;
    }
    this.clinicSubmitting = true;
    this.clinicFormError = '';
    const payload = {
      name,
      address: this.clinicForm.address.trim() || null,
      phone: this.clinicForm.phone.trim() || null,
      email: this.clinicForm.email.trim() || null
    };
    const req$ =
      this.editingClinicId !== null
        ? this.http.put<{ clinic: ClinicRow }>(`${this.clinicsApiUrl}/${this.editingClinicId}`, payload)
        : this.http.post<{ clinic: ClinicRow }>(this.clinicsApiUrl, payload);
    req$.subscribe({
      next: () => {
        const wasEdit = this.editingClinicId !== null;
        this.clinicSubmitting = false;
        this.closeClinicForm();
        this.loadClinics();
        this.toast.success(wasEdit ? 'Clinic updated.' : 'Clinic created.');
      },
      error: (err) => {
        this.clinicSubmitting = false;
        this.clinicFormError = err?.error?.message || 'Unable to save clinic.';
      }
    });
  }

  deleteClinic(row: ClinicRow): void {
    const confirmed = window.confirm(`Delete clinic "${row.name || row.id}"? This cannot be undone if no data is linked.`);
    if (!confirmed) return;
    this.http.delete<{ ok: boolean }>(`${this.clinicsApiUrl}/${row.id}`).subscribe({
      next: () => {
        this.loadClinics();
        this.toast.success('Clinic deleted.');
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Unable to delete clinic.');
      }
    });
  }

  private getEmptyPatientForm() {
    return {
      username: '',
      email: '',
      bloodGroup: '',
      allergies: '',
      emergencyContact: '',
      gender: '',
      dateOfBirth: '',
      mobile: '',
      alternateMobile: '',
      patientEmail: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      emergencyContactName: '',
      emergencyContactNumber: '',
      medicalHistory: '',
      profileImage: ''
    };
  }

  loadPatients(page = this.patientPagination.page, limit = this.registerPageSize): void {
    this.http
      .get<{ patients: PatientRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(this.patientApiUrl, {
        params: { page, limit, q: this.registerSearch.trim() }
      })
      .subscribe({
      next: (res) => {
        this.patientRows = res?.patients || [];
        this.ensurePatientRegisterSelection();
        const pg = res?.pagination;
        this.patientPagination = {
          page: pg?.page || page,
          limit: pg?.limit || limit,
          total: pg?.total || this.patientRows.length,
          totalPages: pg?.totalPages || 1
        };
        this.registerPage = this.patientPagination.page;
        this.registerPageInput = this.patientPagination.page;
      },
      error: () => {
        this.patientFormError = 'Unable to load patients from backend.';
      }
      });
  }

  openCreatePatient(): void {
    this.editingPatientId = null;
    this.patientForm = this.getEmptyPatientForm();
    this.patientFormOpen = true;
    this.patientFormError = '';
    this.active = 'patients-create';
  }

  openEditPatient(row: any): void {
    this.editingPatientId = Number(row.id);
    this.patientForm = {
      username: row.username || '',
      email: row.email || '',
      bloodGroup: row.bloodGroup || '',
      allergies: row.allergies || '',
      emergencyContact: row.emergencyContact || '',
      gender: row.gender || '',
      dateOfBirth: row.dateOfBirth || '',
      mobile: row.mobile || '',
      alternateMobile: row.alternateMobile || '',
      patientEmail: row.patientEmail || '',
      addressLine1: row.addressLine1 || '',
      addressLine2: row.addressLine2 || '',
      city: row.city || '',
      state: row.state || '',
      pincode: row.pincode || '',
      emergencyContactName: row.emergencyContactName || '',
      emergencyContactNumber: row.emergencyContactNumber || '',
      medicalHistory: row.medicalHistory || '',
      profileImage: row.profileImage || ''
    };
    this.patientFormOpen = true;
    this.patientFormError = '';
    this.active = 'patients-edit';
  }

  closePatientForm(): void {
    this.patientFormOpen = false;
    this.patientSubmitting = false;
    this.editingPatientId = null;
    this.patientFormError = '';
    if (this.active === 'patients-edit' || this.active === 'patients-create') {
      this.active = 'patients-register';
      this.loadPatients(this.patientPagination.page, this.registerPageSize);
    }
  }

  onPatientImageSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.patientForm.profileImage = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  }

  savePatient(): void {
    const payload: any = {
      username: this.patientForm.username.trim(),
      email: this.patientForm.email.trim(),
      bloodGroup: this.patientForm.bloodGroup.trim(),
      allergies: this.patientForm.allergies.trim(),
      emergencyContact: this.patientForm.emergencyContact.trim(),
      gender: this.patientForm.gender.trim(),
      dateOfBirth: this.patientForm.dateOfBirth,
      mobile: this.patientForm.mobile.trim(),
      alternateMobile: this.patientForm.alternateMobile.trim(),
      patientEmail: this.patientForm.patientEmail.trim(),
      addressLine1: this.patientForm.addressLine1.trim(),
      addressLine2: this.patientForm.addressLine2.trim(),
      city: this.patientForm.city.trim(),
      state: this.patientForm.state.trim(),
      pincode: this.patientForm.pincode.trim(),
      emergencyContactName: this.patientForm.emergencyContactName.trim(),
      emergencyContactNumber: this.patientForm.emergencyContactNumber.trim(),
      medicalHistory: this.patientForm.medicalHistory.trim(),
      profileImage: this.patientForm.profileImage || null
    };

    if (!payload.username || !payload.email) {
      this.patientFormError = 'Username and email are required.';
      return;
    }

    const isEdit = this.editingPatientId !== null;
    if (!isEdit && !this.requireSingleClinicForCreate()) return;

    this.patientSubmitting = true;
    this.patientFormError = '';
    const request$ = isEdit
      ? this.http.put<{ patients: PatientRow[] }>(`${this.patientApiUrl}/${this.editingPatientId}`, payload)
      : this.http.post<{ patients: PatientRow[]; createdPatientId?: number }>(this.patientApiUrl, payload);

    request$.subscribe({
      next: (res: any) => {
        this.patientSubmitting = false;
        this.loadPatients(this.patientPagination.page, this.registerPageSize);
        if (isEdit) {
          this.closePatientForm();
          return;
        }
        this.closePatientForm();
      },
      error: (err) => {
        this.patientSubmitting = false;
        this.patientFormError = err?.error?.message || 'Unable to save patient.';
      }
    });
  }

  deletePatient(row: any): void {
    const confirmed = window.confirm(`Delete patient "${row.username || row.id}"?`);
    if (!confirmed) return;
    this.http
      .delete<{ patients: PatientRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(
        `${this.patientApiUrl}/${row.id}`,
        { params: { page: this.patientPagination.page, limit: this.registerPageSize, q: this.registerSearch.trim() } }
      )
      .subscribe({
        next: (res) => {
          this.patientRows = res?.patients || [];
          const pg = res?.pagination;
          this.patientPagination = {
            page: pg?.page || this.patientPagination.page,
            limit: pg?.limit || this.registerPageSize,
            total: pg?.total || this.patientRows.length,
            totalPages: pg?.totalPages || 1
          };
          this.registerPage = this.patientPagination.page;
          this.registerPageInput = this.patientPagination.page;
        },
        error: (err) => {
          this.patientFormError = err?.error?.message || 'Unable to delete patient.';
        }
      });
  }

  private fileToDataUrl(file: File): Promise<{ name: string; type: string; data: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: String(file.name || `record-${Date.now()}`),
          type: String(file.type || 'application/octet-stream'),
          data: String(e.target?.result || '')
        });
      };
      reader.readAsDataURL(file);
    });
  }

  private getEmptyAppointmentForm() {
    return {
      patientId: null,
      doctorId: null,
      appointmentDate: '',
      startTime: '',
      endTime: '',
      status: 'scheduled' as const,
      title: '',
      description: ''
    };
  }

  private appendAppointmentColumnFilterParams(params: Record<string, string | number>): void {
    const f = this.appointmentColumnFilters;
    const colDate = String(f.date || '').trim();
    const colTime = String(f.time || '').trim();
    const colPatient = String(f.patient || '').trim();
    const colDoctor = String(f.doctor || '').trim();
    const colStatus = String(f.status || '').trim();
    const colTitle = String(f.title || '').trim();
    if (colDate) params['colDate'] = colDate;
    if (colTime) params['colTime'] = colTime;
    if (colPatient) params['colPatient'] = colPatient;
    if (colDoctor) params['colDoctor'] = colDoctor;
    if (colStatus) params['colStatus'] = colStatus;
    if (colTitle) params['colTitle'] = colTitle;
  }

  private getAppointmentListParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      page: this.appointmentPagination.page,
      limit: this.appointmentPagination.limit,
      q: this.appointmentSearch.trim()
    };
    if (this.appointmentDateFilter) {
      params['date'] = this.appointmentDateFilter;
    } else if (this.appointmentMonthFilter) {
      params['month'] = this.appointmentMonthFilter;
    }
    this.appendAppointmentColumnFilterParams(params);
    return params;
  }

  /** Query params for appointment list APIs when mutating from the All appointments calendar view. */
  private getAppointmentApiQueryParams(): Record<string, string | number> {
    if (this.active === 'appointment-all' && this.allAppointmentsCalendarMonth) {
      return { page: 1, limit: 100, month: this.allAppointmentsCalendarMonth, q: '' };
    }
    return this.getAppointmentListParams();
  }

  private refreshAppointmentViewsAfterSave(appointmentDate?: string): void {
    if (this.active === 'appointment-all') {
      this.loadAllAppointmentsCalendar();
      if (appointmentDate) {
        this.selectedAllCalendarDate = appointmentDate;
      }
      return;
    }
    this.loadAppointments(this.appointmentPagination.page);
  }

  private refreshAppointmentViewsAfterListChange(): void {
    if (this.active === 'appointment-all') {
      this.loadAllAppointmentsCalendar();
      return;
    }
    this.loadAppointments(this.appointmentPagination.page);
  }

  formatYearMonth(d: Date): string {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  ensureAllAppointmentsCalendarMonth(): void {
    if (!this.allAppointmentsCalendarMonth) {
      this.allAppointmentsCalendarMonth = this.formatYearMonth(new Date());
    }
  }

  loadAllAppointmentsCalendar(): void {
    this.ensureAllAppointmentsCalendarMonth();
    const month = this.allAppointmentsCalendarMonth;
    this.allAppointmentsCalendarLoading = true;
    const acc: AppointmentRow[] = [];
    let capturedTotal = 0;
    let totalPages = 1;

    const mapRow = (a: AppointmentRow) => ({
      ...a,
      appointmentDate: String(a.appointmentDate).slice(0, 10),
      startTime: String(a.startTime || '').slice(0, 5),
      endTime: String(a.endTime || '').slice(0, 5)
    });

    const loadPage = (page: number) => {
      this.http
        .get<{ appointments: AppointmentRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(
          this.appointmentApiUrl,
          { params: { page, limit: 100, month, q: '' } }
        )
        .subscribe({
          next: (res) => {
            const batch = (res?.appointments || []).map(mapRow);
            acc.push(...batch);
            const pg = res?.pagination;
            if (page === 1) {
              capturedTotal = pg?.total ?? acc.length;
              totalPages = pg?.totalPages ?? 1;
            }
            if (page < totalPages) {
              loadPage(page + 1);
            } else {
              acc.sort(
                (a, b) =>
                  a.appointmentDate.localeCompare(b.appointmentDate) || String(a.startTime).localeCompare(String(b.startTime))
              );
              this.allAppointmentsCalendarRows = acc;
              this.allAppointmentsCalendarTotal = capturedTotal;
              this.allAppointmentsCalendarLoading = false;
              if (!this.selectedAllCalendarDate && acc.length > 0) {
                this.selectedAllCalendarDate = acc[0].appointmentDate;
              }
            }
          },
          error: () => {
            this.allAppointmentsCalendarLoading = false;
            this.appointmentFormError = 'Unable to load appointments for calendar.';
          }
        });
    };

    loadPage(1);
  }

  shiftAllAppointmentsCalendarMonth(delta: number): void {
    this.ensureAllAppointmentsCalendarMonth();
    const [ys, ms] = this.allAppointmentsCalendarMonth.split('-').map(Number);
    const d = new Date(ys, ms - 1 + delta, 1);
    this.allAppointmentsCalendarMonth = this.formatYearMonth(d);
    this.selectedAllCalendarDate = null;
    this.loadAllAppointmentsCalendar();
  }

  goAllAppointmentsCalendarToday(): void {
    this.allAppointmentsCalendarMonth = this.formatYearMonth(new Date());
    this.selectedAllCalendarDate = this.todayYmd;
    this.loadAllAppointmentsCalendar();
  }

  get todayYmd(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  get allAppointmentsCalendarTitle(): string {
    if (!this.allAppointmentsCalendarMonth) return '';
    const [y, m] = this.allAppointmentsCalendarMonth.split('-').map(Number);
    if (!y || !m) return this.allAppointmentsCalendarMonth;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  get allCalendarWeekdayLabels(): string[] {
    const base = new Date(2024, 6, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(undefined, { weekday: 'short' });
    });
  }

  get allCalendarWeeks(): Array<Array<{ date: string | null; inMonth: boolean; items: AppointmentRow[] }>> {
    const ym = this.allAppointmentsCalendarMonth;
    if (!ym) return [];
    const parts = ym.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!y || !m) return [];

    const itemsByDate = new Map<string, AppointmentRow[]>();
    for (const row of this.allAppointmentsCalendarRows) {
      const k = row.appointmentDate;
      if (!k || !k.startsWith(ym)) continue;
      const list = itemsByDate.get(k) || [];
      list.push(row);
      itemsByDate.set(k, list);
    }

    const first = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0).getDate();
    const startPad = first.getDay();

    const cells: Array<{ date: string | null; inMonth: boolean; items: AppointmentRow[] }> = [];
    for (let i = 0; i < startPad; i += 1) {
      cells.push({ date: null, inMonth: false, items: [] });
    }
    for (let d = 1; d <= lastDay; d += 1) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: dateStr, inMonth: true, items: itemsByDate.get(dateStr) || [] });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, inMonth: false, items: [] });
    }

    const weeks: Array<Array<{ date: string | null; inMonth: boolean; items: AppointmentRow[] }>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  get selectedAllCalendarDayAppointments(): AppointmentRow[] {
    if (!this.selectedAllCalendarDate) return [];
    return this.allAppointmentsCalendarRows.filter((r) => r.appointmentDate === this.selectedAllCalendarDate);
  }

  get selectedAllCalendarDateLabel(): string {
    if (!this.selectedAllCalendarDate) return 'Select a day';
    const d = new Date(this.selectedAllCalendarDate + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return this.selectedAllCalendarDate;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  selectAllCalendarDate(date: string | null): void {
    this.selectedAllCalendarDate = date;
  }

  loadAppointments(page = this.appointmentPagination.page): void {
    const params: any = {
      page,
      limit: this.appointmentPagination.limit,
      q: this.appointmentSearch.trim()
    };
    if (this.appointmentDateFilter) {
      params.date = this.appointmentDateFilter;
    } else if (this.appointmentMonthFilter) {
      params.month = this.appointmentMonthFilter;
    }
    this.appendAppointmentColumnFilterParams(params);

    this.http
      .get<{ appointments: AppointmentRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(this.appointmentApiUrl, {
        params
      })
      .subscribe({
      next: (res) => {
        this.appointmentRows = (res?.appointments || []).map((a) => ({
          ...a,
          appointmentDate: String(a.appointmentDate).slice(0, 10),
          startTime: String(a.startTime || '').slice(0, 5),
          endTime: String(a.endTime || '').slice(0, 5)
        }));
        const pg = res?.pagination;
        this.appointmentPagination = {
          page: pg?.page || page,
          limit: pg?.limit || this.appointmentPagination.limit,
          total: pg?.total || this.appointmentRows.length,
          totalPages: pg?.totalPages || 1
        };
        this.appointmentPageInput = this.appointmentPagination.page;
      },
      error: () => {
        this.appointmentFormError = 'Unable to load appointments from backend.';
      }
      });
  }

  private mapReportAppointment(a: AppointmentRow): AppointmentRow {
    return {
      ...a,
      appointmentDate: String(a.appointmentDate).slice(0, 10),
      startTime: String(a.startTime || '').slice(0, 5),
      endTime: String(a.endTime || '').slice(0, 5)
    };
  }

  /** All appointments for analytics / doctor report (paginates API, max 100 per page). */
  loadReportAppointmentsAll(): void {
    this.reportAnalyticsLoading = true;
    const limit = 100;
    const acc: AppointmentRow[] = [];
    const fetchPage = (page: number) => {
      this.http
        .get<{
          appointments: AppointmentRow[];
          pagination?: { page: number; limit: number; total: number; totalPages: number };
        }>(this.appointmentApiUrl, { params: { page, limit } })
        .subscribe({
          next: (res) => {
            const batch = (res?.appointments || []).map((x) => this.mapReportAppointment(x));
            acc.push(...batch);
            const pg = res?.pagination;
            const totalPages = pg?.totalPages ?? 1;
            const cur = pg?.page ?? page;
            if (cur < totalPages) {
              fetchPage(cur + 1);
            } else {
              this.reportAnalyticsAppointments = acc;
              this.reportAnalyticsLoading = false;
            }
          },
          error: () => {
            this.reportAnalyticsAppointments = [];
            this.reportAnalyticsLoading = false;
          }
        });
    };
    fetchPage(1);
  }

  loadPatientsReport(): void {
    this.patientsReportLoading = true;
    const nameById = new Map<number, string>();
    const loadPatientPage = (page: number, done: () => void) => {
      this.http
        .get<{ patients: PatientRow[]; pagination?: { page: number; totalPages: number } }>(this.patientApiUrl, {
          params: { page, limit: 100, q: '' }
        })
        .subscribe({
          next: (res) => {
            for (const p of res.patients || []) nameById.set(p.id, p.username);
            const tp = res.pagination?.totalPages ?? 1;
            const cp = res.pagination?.page ?? page;
            if (cp < tp) loadPatientPage(cp + 1, done);
            else done();
          },
          error: () => done()
        });
    };

    const attachmentsAcc: Array<AttachmentMetaRow & { patientName?: string }> = [];
    const loadAttachPage = (page: number, done: () => void) => {
      this.http
        .get<{
          attachments: AttachmentMetaRow[];
          pagination: { page: number; limit: number; total: number; totalPages: number };
        }>(`${this.attachmentApiUrl}/browse`, {
          params: { page, limit: 100, entityType: 'medical_record' }
        })
        .subscribe({
          next: (res) => {
            const batch = (res.attachments || []).map((row) => {
              const pid = row.patientId ?? row.entityId ?? null;
              const pn =
                pid != null ? nameById.get(pid) || `Patient #${pid}` : '—';
              return { ...row, patientName: pn };
            });
            attachmentsAcc.push(...batch);
            const pg = res.pagination;
            if (pg.page < pg.totalPages) loadAttachPage(pg.page + 1, done);
            else done();
          },
          error: () => {
            this.patientsReportRows = [];
            this.patientsReportLoading = false;
          }
        });
    };

    loadPatientPage(1, () => {
      loadAttachPage(1, () => {
        this.patientsReportRows = attachmentsAcc;
        this.patientsReportLoading = false;
      });
    });
  }

  deletePatientReportAttachment(row: AttachmentMetaRow): void {
    this.deleteDocMgmtAttachment(row, () => this.loadPatientsReport());
  }

  private analyticsBarFromCounts(counts: Map<string, number>, maxBars: number, sort: 'value' | 'key'): Array<{ label: string; count: number; pct: number }> {
    let entries = [...counts.entries()];
    if (sort === 'value') entries.sort((a, b) => b[1] - a[1]);
    else entries.sort((a, b) => a[0].localeCompare(b[0]));
    entries = entries.slice(0, maxBars);
    const max = Math.max(1, ...entries.map(([, c]) => c));
    return entries.map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100)
    }));
  }

  get doctorReportFilteredAppointments(): AppointmentRow[] {
    if (this.reportDoctorId == null) return this.reportAnalyticsAppointments;
    return this.reportAnalyticsAppointments.filter((a) => a.doctorId === this.reportDoctorId);
  }

  get appointmentAnalyticsByStatus(): Array<{ label: string; count: number; pct: number }> {
    const m = new Map<string, number>();
    for (const a of this.reportAnalyticsAppointments) {
      const k = (a.status || 'unknown').replace(/_/g, ' ');
      m.set(k, (m.get(k) || 0) + 1);
    }
    return this.analyticsBarFromCounts(m, 12, 'value');
  }

  get appointmentAnalyticsByDoctor(): Array<{ label: string; count: number; pct: number }> {
    const m = new Map<string, number>();
    for (const a of this.reportAnalyticsAppointments) {
      const k = a.doctorName || `Doctor #${a.doctorId}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return this.analyticsBarFromCounts(m, 10, 'value');
  }

  get appointmentAnalyticsByMonth(): Array<{ label: string; count: number; pct: number }> {
    const m = new Map<string, number>();
    for (const a of this.reportAnalyticsAppointments) {
      const mo = String(a.appointmentDate || '').slice(0, 7);
      if (!mo) continue;
      m.set(mo, (m.get(mo) || 0) + 1);
    }
    const keys = [...m.keys()].sort();
    const last = keys.slice(-12);
    const max = Math.max(1, ...last.map((k) => m.get(k) || 0));
    return last.map((k) => ({
      label: k,
      count: m.get(k) || 0,
      pct: Math.round(((m.get(k) || 0) / max) * 100)
    }));
  }

  get appointmentAnalyticsByWeekday(): Array<{ label: string; count: number; pct: number }> {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const m = new Map<string, number>();
    for (let i = 0; i < 7; i += 1) m.set(labels[i], 0);
    for (const a of this.reportAnalyticsAppointments) {
      const ds = String(a.appointmentDate || '').slice(0, 10);
      if (!ds) continue;
      const d = new Date(`${ds}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const lab = labels[d.getDay()];
      m.set(lab, (m.get(lab) || 0) + 1);
    }
    const rows = labels.map((label) => ({ label, count: m.get(label) || 0 }));
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }));
  }

  get appointmentAnalyticsByHour(): Array<{ label: string; count: number; pct: number }> {
    const m = new Map<string, number>();
    for (let h = 0; h < 24; h += 1) m.set(`${String(h).padStart(2, '0')}:00`, 0);
    for (const a of this.reportAnalyticsAppointments) {
      const t = String(a.startTime || '00:00');
      const hour = parseInt(t.slice(0, 2), 10);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const lab = `${String(hour).padStart(2, '0')}:00`;
      m.set(lab, (m.get(lab) || 0) + 1);
    }
    const nonzero = [...m.entries()].filter(([, c]) => c > 0);
    const slice = nonzero.length ? nonzero : [...m.entries()].slice(8, 18);
    const max = Math.max(1, ...slice.map(([, c]) => c));
    return slice.map(([label, count]) => ({ label, count, pct: Math.round((count / max) * 100) }));
  }

  openCreateAppointment(): void {
    this.editingAppointmentId = null;
    this.appointmentForm = this.getEmptyAppointmentForm();
    if (this.active === 'appointment-all' && this.selectedAllCalendarDate) {
      this.appointmentForm.appointmentDate = this.selectedAllCalendarDate;
    }
    this.appointmentFormOpen = true;
    this.appointmentFormError = '';
  }

  openEditAppointment(row: AppointmentRow): void {
    this.editingAppointmentId = Number(row.id);
    this.appointmentForm = {
      patientId: Number(row.patientId),
      doctorId: Number(row.doctorId),
      appointmentDate: row.appointmentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status || 'scheduled',
      title: row.title || '',
      description: row.description || ''
    };
    this.appointmentFormOpen = true;
    this.appointmentFormError = '';
  }

  closeAppointmentForm(): void {
    this.appointmentFormOpen = false;
    this.appointmentSubmitting = false;
    this.editingAppointmentId = null;
    this.appointmentFormError = '';
  }

  saveAppointment(): void {
    const payload = {
      patientId: this.appointmentForm.patientId,
      doctorId: this.appointmentForm.doctorId,
      appointmentDate: this.appointmentForm.appointmentDate,
      startTime: this.appointmentForm.startTime,
      endTime: this.appointmentForm.endTime,
      status: this.appointmentForm.status,
      title: this.appointmentForm.title.trim(),
      description: this.appointmentForm.description.trim(),
      color: 'green'
    };

    if (!payload.patientId || !payload.doctorId || !payload.appointmentDate || !payload.startTime || !payload.endTime) {
      this.appointmentFormError = 'Patient, doctor, date, start time, and end time are required.';
      return;
    }

    if (!this.editingAppointmentId) {
      if (!this.requireSingleClinicForCreate()) return;
      const clinicHdr = this.authSession.getClinicIdHeaderValue();
      if (clinicHdr == null || String(clinicHdr).trim() === '') {
        this.appointmentFormError =
          'Choose an active clinic in the header switcher. Appointments are saved with that clinic (sent as X-Clinic-Id).';
        return;
      }
    }

    this.appointmentSubmitting = true;
    this.appointmentFormError = '';

    const listParams = this.getAppointmentApiQueryParams();

    const request$ = this.editingAppointmentId
      ? this.http.put<{ appointments: AppointmentRow[] }>(`${this.appointmentApiUrl}/${this.editingAppointmentId}`, payload, {
          params: listParams
        })
      : this.http.post<{ appointments: AppointmentRow[] }>(this.appointmentApiUrl, payload, {
          params: listParams
        });

    request$.subscribe({
      next: () => {
        this.refreshAppointmentViewsAfterSave(payload.appointmentDate);
        this.closeAppointmentForm();
      },
      error: (err) => {
        this.appointmentSubmitting = false;
        this.appointmentFormError = err?.error?.message || 'Unable to save appointment.';
      }
    });
  }

  updateAppointmentStatus(item: AppointmentRow, status: string): void {
    if (item.status === status) return;
    const payload = {
      patientId: item.patientId,
      doctorId: item.doctorId,
      appointmentDate: item.appointmentDate,
      startTime: item.startTime,
      endTime: item.endTime,
      status,
      title: item.title || '',
      description: item.description || '',
      color: item.color || 'green'
    };
    this.appointmentStatusUpdatingId = item.id;
    this.appointmentFormError = '';
    this.http
      .put<{ appointments: AppointmentRow[] }>(`${this.appointmentApiUrl}/${item.id}`, payload, {
        params: this.getAppointmentApiQueryParams()
      })
      .subscribe({
        next: () => {
          this.appointmentStatusUpdatingId = null;
          this.refreshAppointmentViewsAfterListChange();
        },
        error: (err) => {
          this.appointmentStatusUpdatingId = null;
          this.appointmentFormError = err?.error?.message || 'Unable to update status.';
        }
      });
  }

  deleteAppointment(row: AppointmentRow): void {
    const confirmed = window.confirm('Delete this appointment?');
    if (!confirmed) return;

    this.http
      .delete(`${this.appointmentApiUrl}/${row.id}`, {
        params: this.getAppointmentApiQueryParams()
      })
      .subscribe({
        next: () => {
          this.refreshAppointmentViewsAfterListChange();
        },
        error: (err) => {
          this.appointmentFormError = err?.error?.message || 'Unable to delete appointment.';
        }
      });
  }

  changeAppointmentPage(direction: 'prev' | 'next'): void {
    const next = direction === 'next' ? this.appointmentPagination.page + 1 : this.appointmentPagination.page - 1;
    if (next < 1 || next > this.appointmentPagination.totalPages) return;
    this.loadAppointments(next);
  }

  jumpAppointmentPage(): void {
    const target = Math.max(1, Math.min(this.appointmentPagination.totalPages, Number(this.appointmentPageInput) || 1));
    this.loadAppointments(target);
  }

  onAppointmentSearchInput(): void {
    if (this.appointmentSearchDebounce) clearTimeout(this.appointmentSearchDebounce);
    this.appointmentSearchDebounce = setTimeout(() => {
      this.loadAppointments(1);
    }, 300);
  }

  onAppointmentColumnFilterChange(): void {
    if (this.active !== 'appointment-register') return;
    if (this.appointmentColumnFilterDebounce) clearTimeout(this.appointmentColumnFilterDebounce);
    this.appointmentColumnFilterDebounce = setTimeout(() => {
      this.loadAppointments(1);
    }, 400);
  }

  applyAppointmentFilters(): void {
    this.loadAppointments(1);
  }

  clearAppointmentFilters(): void {
    this.appointmentSearch = '';
    this.appointmentDateFilter = '';
    this.appointmentMonthFilter = '';
    this.appointmentColumnFilters = {
      date: '',
      time: '',
      patient: '',
      doctor: '',
      status: '',
      title: ''
    };
    this.loadAppointments(1);
  }

  get filteredInventoryRows(): { item: string; qty: number; status: string; cost: string }[] {
    let rows = this.inventoryRows;
    const filters = Object.entries(this.inventoryFilters).filter(([_, value]) => value.trim() !== '');
    
    if (filters.length > 0) {
      rows = rows.filter(row => {
        return filters.every(([key, filterValue]) => {
          const cellValue = String(row[key as keyof typeof row] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      });
    }
    
    return rows;
  }

  private toPolylinePoints(series: number[], w: number, h: number, pad: number): string {
    if (!series.length) return '';
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const span = Math.max(max - min, 1);
    const n = series.length;
    const denom = Math.max(n - 1, 1);
    return series
      .map((v, idx) => {
        const x = pad + (idx * (w - pad * 2)) / denom;
        const y = pad + ((max - v) * (h - pad * 2)) / span;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  loadFinancialPatients(): void {
    this.http
      .get<{ patients: PatientRow[] }>(this.patientApiUrl, { params: { page: 1, limit: 400 } })
      .subscribe({
        next: (res) => {
          this.financialPatients = (res.patients || []).map((p) => ({
            id: p.id,
            name: p.username || `Patient #${p.id}`
          }));
        },
        error: () => {
          this.financialPatients = [];
        }
      });
  }

  loadFinancialAppointments(): void {
    this.http
      .get<{ appointments: AppointmentRow[] }>(this.appointmentApiUrl, { params: { page: 1, limit: 500 } })
      .subscribe({
        next: (res) => {
          this.financialAppointments = res.appointments || [];
        },
        error: () => {
          this.financialAppointments = [];
        }
      });
  }

  private toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Align filter dates with preset (6 / 12 calendar months, or year-to-date). */
  applyFinancialPresetDates(preset: '6m' | '12m' | 'ytd'): void {
    const today = new Date();
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let from: Date;
    if (preset === '6m') {
      from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    } else if (preset === '12m') {
      from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    } else {
      from = new Date(today.getFullYear(), 0, 1);
    }
    this.financialDashboardFilters.fromDate = this.toYmdLocal(from);
    this.financialDashboardFilters.toDate = this.toYmdLocal(to);
  }

  onFinancialPresetChange(): void {
    if (this.financialDashboardFilters.preset !== 'custom') {
      this.applyFinancialPresetDates(this.financialDashboardFilters.preset);
      this.loadFinancialDashboard();
    }
  }

  resetFinancialDashboardPeriod(): void {
    this.financialDashboardFilters.preset = '6m';
    this.applyFinancialPresetDates('6m');
    this.loadFinancialDashboard();
  }

  onFinancialDateRangeEdited(): void {
    this.financialDashboardFilters.preset = 'custom';
  }

  applyFinancialDashboardFilters(): void {
    this.loadFinancialDashboard();
  }

  loadFinancialDashboard(): void {
    if (!this.financialDashboardFilters.fromDate || !this.financialDashboardFilters.toDate) {
      this.applyFinancialPresetDates('6m');
      this.financialDashboardFilters.preset = '6m';
    }
    this.financialDashboardLoading = true;
    const params: Record<string, string> = {
      fromDate: this.financialDashboardFilters.fromDate,
      toDate: this.financialDashboardFilters.toDate
    };
    this.http
      .get<{
        totalIncome: number;
        totalExpense: number;
        balance: number;
        pendingPayments: number;
        chart: Array<{ month: string; income: number; expense: number; net: number }>;
        incomeByPaymentMethod: Array<{ method: string; amount: number }>;
        expenseByCategory: Array<{ category: string; amount: number }>;
        period?: { fromDate: string; toDate: string };
      }>(`${this.financialApiUrl}/dashboard`, { params })
      .subscribe({
        next: (res) => {
          this.financialDashboard = {
            ...res,
            chart: (res.chart || []).map((c) => ({
              ...c,
              net: c.net != null ? Number(c.net) : Number(c.income || 0) - Number(c.expense || 0)
            })),
            incomeByPaymentMethod: res.incomeByPaymentMethod || [],
            expenseByCategory: res.expenseByCategory || [],
            period: res.period
          };
          if (res.period) {
            this.financialDashboardFilters.fromDate = res.period.fromDate;
            this.financialDashboardFilters.toDate = res.period.toDate;
          }
          this.financialDashboardLoading = false;
        },
        error: () => {
          this.financialDashboard = null;
          this.financialDashboardLoading = false;
        }
      });
  }

  showFinDashTooltip(
    event: MouseEvent,
    row: { month: string; income: number; expense: number; net: number }
  ): void {
    this.finDashActiveMonth = row.month;
    this.finDashTooltip = {
      show: true,
      text: `${row.month} · In ${this.formatMoney(row.income)} · Out ${this.formatMoney(row.expense)} · Net ${this.formatMoney(row.net)}`,
      x: event.clientX + 14,
      y: event.clientY + 14
    };
  }

  moveFinDashTooltip(event: MouseEvent): void {
    if (!this.finDashTooltip.show) return;
    this.finDashTooltip = { ...this.finDashTooltip, x: event.clientX + 14, y: event.clientY + 14 };
  }

  hideFinDashTooltip(): void {
    this.finDashTooltip.show = false;
    this.finDashActiveMonth = null;
  }

  showHbarTooltip(event: MouseEvent, text: string): void {
    this.hbarTooltip = { show: true, text, x: event.clientX + 14, y: event.clientY + 14 };
  }

  moveHbarTooltip(event: MouseEvent): void {
    if (!this.hbarTooltip.show) return;
    this.hbarTooltip = { ...this.hbarTooltip, x: event.clientX + 14, y: event.clientY + 14 };
  }

  hideHbarTooltip(): void {
    this.hbarTooltip.show = false;
  }

  showNetPointTooltip(event: MouseEvent, month: string, net: number): void {
    this.finDashTooltip = {
      show: true,
      text: `${month} · Net ${this.formatMoney(net)}`,
      x: event.clientX + 14,
      y: event.clientY + 14
    };
  }

  openTransactionsHelp(section: 'dashboard' | 'billing' | 'payments' | 'expenses' | 'ledger'): void {
    this.transactionsHelpSection = section;
    this.transactionsHelpOpen = true;
  }

  closeTransactionsHelp(): void {
    this.transactionsHelpOpen = false;
  }

  printBillPdf(billId: number): void {
    this.http
      .get<{
        bill: {
          id: number;
          patientName: string;
          billDate: string;
          totalAmount: number;
          discount: number;
          finalAmount: number;
          status: string;
          paidAmount: number;
          items: Array<{ itemName: string; quantity: number; price: number }>;
        };
      }>(`${this.financialApiUrl}/bills/${billId}`)
      .subscribe({
        next: (res) => {
          const bill = res?.bill;
          if (!bill) return;
          void Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([jsPDFMod, autoTableMod]) => {
            const jsPDF = jsPDFMod.default;
            const autoTable = autoTableMod.default;
            const doc = new jsPDF();
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const headerH = this.organisation.headerImage ? 20 : 0;
            const footerH = this.organisation.footerImage ? 18 : 0;
            const imageFormat = (dataUrl: string): 'PNG' | 'JPEG' =>
              dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
            const drawBranding = () => {
              if (this.organisation.headerImage && this.organisation.headerImage.startsWith('data:image')) {
                doc.addImage(
                  this.organisation.headerImage,
                  imageFormat(this.organisation.headerImage),
                  0,
                  0,
                  pageW,
                  headerH || 20
                );
              }
              if (this.organisation.footerImage && this.organisation.footerImage.startsWith('data:image')) {
                doc.addImage(
                  this.organisation.footerImage,
                  imageFormat(this.organisation.footerImage),
                  0,
                  pageH - (footerH || 18),
                  pageW,
                  footerH || 18
                );
              }
              if (this.organisation.addSeal && this.organisation.sealImage && this.organisation.sealImage.startsWith('data:image')) {
                const sealSize = 26;
                doc.addImage(
                  this.organisation.sealImage,
                  imageFormat(this.organisation.sealImage),
                  pageW - sealSize - 10,
                  pageH - (footerH || 0) - sealSize - 6,
                  sealSize,
                  sealSize
                );
              }
            };
            let y = headerH + 10;
            doc.setFontSize(16);
            doc.text('Invoice / Bill', 14, y);
            y += 8;
            doc.setFontSize(10);
            doc.text(String(this.organisation.name || 'Dental Clinic'), 14, y);
            y += 6;
            doc.text(`Bill #${bill.id} · ${bill.patientName}`, 14, y);
            y += 5;
            doc.text(`Bill date: ${bill.billDate} · Status: ${bill.status}`, 14, y);
            y += 5;
            doc.text(
              `Subtotal ${this.formatMoney(bill.totalAmount)} · Discount ${this.formatMoney(bill.discount)} · Final ${this.formatMoney(
                bill.finalAmount
              )}`,
              14,
              y
            );
            y += 5;
            doc.text(`Paid to date: ${this.formatMoney(bill.paidAmount)}`, 14, y);
            y += 8;
            const body = (bill.items || []).map((it) => {
              const q = Number(it.quantity) || 1;
              const p = Number(it.price) || 0;
              return [it.itemName, String(q), this.formatMoney(p), this.formatMoney(q * p)];
            });
            autoTable(doc, {
              head: [['Item', 'Qty', 'Unit price', 'Line total']],
              body,
              startY: y,
              margin: { bottom: footerH + 8, left: 10, right: 10 },
              didDrawPage: () => drawBranding()
            });
            doc.save(`bill-${bill.id}.pdf`);
          });
        },
        error: () => {
          window.alert('Could not load bill for PDF.');
        }
      });
  }

  loadFinancialBillingPage(): void {
    this.loadFinancialPatients();
    this.loadFinancialAppointments();
    this.loadBills(1);
    this.loadBillInventoryItems();
    if (!this.billForm.billDate) {
      this.billForm.billDate = new Date().toISOString().slice(0, 10);
    }
  }

  private loadBillInventoryItems(): void {
    this.inventoryApi.listItems({ page: 1, limit: 500 }).subscribe({
      next: (res) => {
        this.billInventoryItemOptions = (res.items || [])
          .filter((i) => i.isActive)
          .map((i) => ({ id: i.id, name: i.name }));
      },
      error: () => (this.billInventoryItemOptions = [])
    });
  }

  onBillLineInventoryChange(line: (typeof this.billForm.items)[0]): void {
    line.stockError = '';
    line.stockHint = '';
    line.availableQty = null;
    if (!line.inventoryItemId) return;
    this.inventoryApi.getItemAvailability(line.inventoryItemId).subscribe({
      next: (a) => {
        line.availableQty = a.available;
        const expiringSoon = a.expiringWithinDays || this.isDateWithinDays(a.nearestUsableExpiry, 7);
        if (a.hasOnlyExpiredRemaining) {
          line.stockError = 'Only expired stock remains; cannot sell.';
          line.stockHint = '';
        } else if (a.available <= 0) {
          line.stockError = 'No usable stock available.';
        } else {
          line.stockHint =
            `Available: ${a.available}` +
            (a.nearestUsableExpiry ? ` · Next expiry ${a.nearestUsableExpiry}` : '') +
            (expiringSoon ? ' · Expiring within 7 days' : '');
        }
        this.validateBillLineQty(line);
      },
      error: () => {
        line.stockError = 'Could not load stock for this item.';
      }
    });
  }

  validateBillLineQty(line: (typeof this.billForm.items)[0]): void {
    if (!line.inventoryItemId || line.availableQty == null) return;
    const q = Math.max(1, Math.floor(Number(line.quantity) || 1));
    if (q > line.availableQty) {
      line.stockError = `Quantity exceeds available (${line.availableQty}).`;
    } else if (line.stockError?.startsWith('Quantity exceeds')) {
      line.stockError = '';
    }
  }

  private emptyBillLine() {
    return {
      itemName: '',
      quantity: 1,
      price: 0,
      inventoryItemId: null,
      availableQty: null,
      stockHint: '',
      stockError: ''
    };
  }

  loadBills(page = this.billingPagination.page): void {
    this.http
      .get<{
        bills: Array<{
          id: number;
          patientName: string;
          finalAmount: number;
          paidAmount: number;
          status: string;
          billDate: string;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.financialApiUrl}/bills`, { params: { page, limit: this.billingPagination.limit } })
      .subscribe({
        next: (res) => {
          this.billingList = res.bills || [];
          const pg = res.pagination;
          this.billingPagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.billingPagination.limit,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.billingPageInput = this.billingPagination.page;
        },
        error: () => {
          this.billingList = [];
        }
      });
  }

  changeBillingPage(direction: 'prev' | 'next'): void {
    const next =
      direction === 'next' ? this.billingPagination.page + 1 : this.billingPagination.page - 1;
    if (next < 1 || next > this.billingPagination.totalPages) return;
    this.loadBills(next);
  }

  jumpBillingPage(): void {
    const target = Math.max(1, Math.min(this.billingPagination.totalPages, Number(this.billingPageInput) || 1));
    this.loadBills(target);
  }

  addBillLine(): void {
    this.billForm.items.push(this.emptyBillLine());
  }

  removeBillLine(index: number): void {
    if (this.billForm.items.length <= 1) return;
    this.billForm.items.splice(index, 1);
  }

  get billSubtotal(): number {
    return this.billForm.items.reduce(
      (s, it) => s + (Number(it.quantity) || 1) * (Number(it.price) || 0),
      0
    );
  }

  get billFinalComputed(): number {
    const d = Number(this.billForm.discount) || 0;
    return Math.max(0, Math.round((this.billSubtotal - d) * 100) / 100);
  }

  get appointmentsForBillPatient(): AppointmentRow[] {
    const pid = this.billForm.patientId;
    if (!pid) return [];
    return this.financialAppointments.filter((a) => Number(a.patientId) === pid);
  }

  submitBill(): void {
    if (!this.billForm.patientId) {
      this.billError = 'Select a patient.';
      return;
    }
    const lines = this.billForm.items.filter((it) => it.itemName.trim().length > 0);
    if (!lines.length) {
      this.billError = 'Add at least one line item with a name.';
      return;
    }
    for (const line of lines) {
      const itemName = line.itemName.trim();
      const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const invId = line.inventoryItemId != null && line.inventoryItemId > 0 ? line.inventoryItemId : null;
      if (invId) {
        if (line.stockError && line.stockError.includes('Only expired')) {
          this.billError = line.stockError;
          return;
        }
        if (line.availableQty != null && qty > line.availableQty) {
          this.billError = `Line “${itemName}”: quantity exceeds available stock (${line.availableQty}).`;
          return;
        }
        if (line.availableQty === 0 || (line.stockError && line.stockError.includes('No usable'))) {
          this.billError = `Line “${itemName}”: no usable stock.`;
          return;
        }
      }
    }
    if (!this.requireSingleClinicForCreate()) return;
    this.billSubmitting = true;
    this.billError = '';
    const body = {
      patientId: this.billForm.patientId,
      appointmentId: this.billForm.appointmentId || null,
      billDate: this.billForm.billDate || new Date().toISOString().slice(0, 10),
      discount: Number(this.billForm.discount) || 0,
      items: lines.map((line) => ({
        itemName: line.itemName.trim(),
        quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
        price: Math.max(0, Number(line.price) || 0),
        inventoryItemId:
          line.inventoryItemId != null && line.inventoryItemId > 0 ? line.inventoryItemId : null
      }))
    };
    this.billingApi.createBill(body).subscribe({
      next: () => {
        this.billSubmitting = false;
        this.toast.success('Bill created and stock updated.');
        this.billForm = {
          patientId: null,
          appointmentId: null,
          billDate: new Date().toISOString().slice(0, 10),
          discount: 0,
          items: [this.emptyBillLine()]
        };
        this.loadBills(1);
        this.loadFinancialDashboard();
        this.loadBillInventoryItems();
      },
      error: (err) => {
        this.billSubmitting = false;
        this.billError = err?.error?.message || 'Could not create bill.';
        this.toast.error(this.billError);
      }
    });
  }

  get billsWithBalance(): Array<{ id: number; remaining: number; label: string }> {
    return this.billingList
      .map((b) => {
        const remaining = Math.round((b.finalAmount - b.paidAmount) * 100) / 100;
        return {
          id: b.id,
          remaining,
          label: `#${b.id} ${b.patientName} — due ${remaining.toFixed(2)} (${b.status})`
        };
      })
      .filter((b) => b.remaining > 0.001);
  }

  onPaymentBillChange(): void {
    const id = this.paymentForm.billingId;
    if (!id) return;
    const row = this.billingList.find((b) => b.id === id);
    if (row) {
      const rem = Math.round((row.finalAmount - row.paidAmount) * 100) / 100;
      this.paymentForm.amount = rem > 0 ? rem : 0;
    }
  }

  loadFinancialPaymentsPage(): void {
    this.loadBills(1);
    this.loadPayments(1);
    if (!this.paymentForm.paymentDate) {
      this.paymentForm.paymentDate = new Date().toISOString().slice(0, 10);
    }
  }

  loadPayments(page = this.paymentPagination.page): void {
    this.http
      .get<{
        payments: Array<{
          id: number;
          billingId: number;
          amount: number;
          paymentMethod: string;
          paymentDate: string;
          patientName: string;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.financialApiUrl}/payments`, { params: { page, limit: this.paymentPagination.limit } })
      .subscribe({
        next: (res) => {
          this.paymentList = res.payments || [];
          const pg = res.pagination;
          this.paymentPagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.paymentPagination.limit,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.paymentPageInput = this.paymentPagination.page;
        },
        error: () => {
          this.paymentList = [];
        }
      });
  }

  changePaymentPage(direction: 'prev' | 'next'): void {
    const next =
      direction === 'next' ? this.paymentPagination.page + 1 : this.paymentPagination.page - 1;
    if (next < 1 || next > this.paymentPagination.totalPages) return;
    this.loadPayments(next);
  }

  jumpPaymentPage(): void {
    const target = Math.max(1, Math.min(this.paymentPagination.totalPages, Number(this.paymentPageInput) || 1));
    this.loadPayments(target);
  }

  submitPayment(): void {
    if (!this.paymentForm.billingId || this.paymentForm.amount <= 0) {
      this.paymentError = 'Select a bill and enter a valid amount.';
      return;
    }
    this.paymentSubmitting = true;
    this.paymentError = '';
    this.http
      .post(`${this.financialApiUrl}/payments`, {
        billingId: this.paymentForm.billingId,
        amount: this.paymentForm.amount,
        paymentMethod: this.paymentForm.paymentMethod,
        paymentDate: this.paymentForm.paymentDate
      })
      .subscribe({
        next: () => {
          this.paymentSubmitting = false;
          this.loadPayments(this.paymentPagination.page);
          this.loadBills(this.billingPagination.page);
          this.loadFinancialDashboard();
          this.onPaymentBillChange();
        },
        error: (err) => {
          this.paymentSubmitting = false;
          this.paymentError = err?.error?.message || 'Could not record payment.';
        }
      });
  }

  loadInventoryItemsForExpense(): void {
    this.http
      .get<{ items: Array<{ id: number; name: string }> }>(`${this.inventoryApiUrl}/items`, {
        params: { page: 1, limit: 500 }
      })
      .subscribe({
        next: (res) => {
          this.inventoryItemsForExpense = (res.items || []).map((i) => ({ id: i.id, name: i.name }));
        },
        error: () => {
          this.inventoryItemsForExpense = [];
        }
      });
  }

  loadFinancialExpensesPage(): void {
    this.loadExpenses(1);
    this.loadInventoryItemsForExpense();
    if (!this.expenseForm.expenseDate) {
      this.expenseForm.expenseDate = new Date().toISOString().slice(0, 10);
    }
  }

  loadExpenses(page = this.expensePagination.page): void {
    this.http
      .get<{
        expenses: Array<{
          id: number;
          title: string;
          amount: number;
          category: string;
          paymentMethod: string;
          expenseDate: string;
          referenceType: string;
          referenceId: number | null;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.financialApiUrl}/expenses`, { params: { page, limit: this.expensePagination.limit } })
      .subscribe({
        next: (res) => {
          this.expenseList = res.expenses || [];
          const pg = res.pagination;
          this.expensePagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.expensePagination.limit,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.expensePageInput = this.expensePagination.page;
        },
        error: () => {
          this.expenseList = [];
        }
      });
  }

  changeExpensePage(direction: 'prev' | 'next'): void {
    const next =
      direction === 'next' ? this.expensePagination.page + 1 : this.expensePagination.page - 1;
    if (next < 1 || next > this.expensePagination.totalPages) return;
    this.loadExpenses(next);
  }

  jumpExpensePage(): void {
    const target = Math.max(1, Math.min(this.expensePagination.totalPages, Number(this.expensePageInput) || 1));
    this.loadExpenses(target);
  }

  onExpenseInventoryToggle(): void {
    if (this.expenseForm.linkInventory) {
      if (this.expenseForm.category !== 'inventory_purchase' && this.expenseForm.category !== 'equipment_purchase') {
        this.expenseForm.category = 'inventory_purchase';
      }
    }
  }

  onExpenseInventoryItemChange(): void {
    const id = this.expenseForm.inventoryItemId;
    if (!id) return;
    const row = this.inventoryItemsForExpense.find((i) => i.id === id);
    if (row && !this.expenseForm.title.trim()) {
      this.expenseForm.title = `Purchase: ${row.name}`;
    }
  }

  submitExpense(): void {
    const title = this.expenseForm.title.trim();
    const amount = Number(this.expenseForm.amount);
    if (!title || !amount || amount <= 0) {
      this.expenseError = 'Title and a positive amount are required.';
      return;
    }
    const body: any = {
      title,
      amount,
      category: this.expenseForm.category,
      paymentMethod: this.expenseForm.paymentMethod,
      expenseDate: this.expenseForm.expenseDate,
      description: this.expenseForm.description.trim() || null
    };
    if (this.expenseForm.linkInventory && this.expenseForm.inventoryItemId) {
      const qty = Math.max(1, Math.floor(Number(this.expenseForm.invQty) || 1));
      const linePrice = Number(this.expenseForm.invPurchasePrice) || amount;
      if (Math.abs(linePrice - amount) > 0.02) {
        this.expenseError = 'Amount must match the inventory line total (purchase price).';
        return;
      }
      body.inventoryPurchase = {
        itemId: this.expenseForm.inventoryItemId,
        quantity: qty,
        purchasePrice: linePrice,
        purchaseDate: this.expenseForm.invPurchaseDate || this.expenseForm.expenseDate,
        supplierName: this.expenseForm.invSupplier.trim() || null,
        expiryDate: this.expenseForm.invExpiry || null,
        batchNumber: this.expenseForm.invBatch.trim() || null
      };
    }
    this.expenseSubmitting = true;
    this.expenseError = '';
    this.http.post(`${this.financialApiUrl}/expenses`, body).subscribe({
      next: () => {
        this.expenseSubmitting = false;
        this.expenseForm = {
          title: '',
          amount: 0,
          category: 'general',
          paymentMethod: 'cash',
          expenseDate: new Date().toISOString().slice(0, 10),
          description: '',
          linkInventory: false,
          inventoryItemId: null,
          invQty: 1,
          invPurchasePrice: 0,
          invPurchaseDate: '',
          invSupplier: '',
          invExpiry: '',
          invBatch: ''
        };
        this.loadExpenses(1);
        this.loadFinancialLedgerPage();
        this.loadFinancialDashboard();
      },
      error: (err) => {
        this.expenseSubmitting = false;
        this.expenseError = err?.error?.message || 'Could not save expense.';
      }
    });
  }

  loadFinancialLedgerPage(): void {
    this.loadLedger(1);
  }

  loadLedger(page = this.ledgerPagination.page): void {
    const params: Record<string, string | number> = {
      page,
      limit: this.ledgerPagination.limit
    };
    if (this.ledgerFilters.type) params['type'] = this.ledgerFilters.type;
    if (this.ledgerFilters.category.trim()) params['category'] = this.ledgerFilters.category.trim();
    if (this.ledgerFilters.fromDate) params['fromDate'] = this.ledgerFilters.fromDate;
    if (this.ledgerFilters.toDate) params['toDate'] = this.ledgerFilters.toDate;
    this.http
      .get<{
        entries: Array<{
          id: number;
          type: string;
          amount: number;
          category: string;
          referenceType: string;
          referenceId: number | null;
          paymentMethod: string;
          transactionDate: string;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.financialApiUrl}/ledger`, { params })
      .subscribe({
        next: (res) => {
          this.ledgerEntries = res.entries || [];
          const pg = res.pagination;
          this.ledgerPagination = {
            page: pg?.page || page,
            limit: pg?.limit || this.ledgerPagination.limit,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.ledgerPageInput = this.ledgerPagination.page;
        },
        error: () => {
          this.ledgerEntries = [];
        }
      });
  }

  applyLedgerFilters(): void {
    this.loadLedger(1);
  }

  changeLedgerPage(direction: 'prev' | 'next'): void {
    const next =
      direction === 'next' ? this.ledgerPagination.page + 1 : this.ledgerPagination.page - 1;
    if (next < 1 || next > this.ledgerPagination.totalPages) return;
    this.loadLedger(next);
  }

  jumpLedgerPage(): void {
    const target = Math.max(1, Math.min(this.ledgerPagination.totalPages, Number(this.ledgerPageInput) || 1));
    this.loadLedger(target);
  }

  private clearDocReferenceDropdownsAndSelections(): void {
    this.docPatients = [];
    this.docDoctors = [];
    this.docAppointments = [];
    this.docBillsSelect = [];
    this.docPatientId = null;
    this.docMedPatientId = null;
    this.docMedAppointmentId = null;
    this.docBillId = null;
    this.docDoctorId = null;
    this.docPatientAttachments = [];
    this.docMedAttachments = [];
    this.docBillingAttachments = [];
    this.docDoctorAttachments = [];
  }

  /** Patients / doctors / appointments / bills for document screens — scoped to the active clinic header. */
  ensureDocReferenceData(): void {
    const key = this.authSession.getClinicIdHeaderValue() ?? '';
    if (this.docReferenceDataClinicKey === key) return;
    this.docReferenceDataClinicKey = key;

    if (this.authSession.isAllClinicsScopeSelected()) {
      this.clearDocReferenceDropdownsAndSelections();
      return;
    }

    const scopeKey = key;

    this.http.get<{ patients: PatientRow[] }>(this.patientApiUrl, { params: { page: 1, limit: 500 } }).subscribe({
      next: (res) => {
        if (this.docReferenceDataClinicKey !== scopeKey) return;
        this.docPatients = (res.patients || []).map((p) => ({
          id: p.id,
          name: p.username || `Patient #${p.id}`
        }));
      },
      error: () => {
        if (this.docReferenceDataClinicKey !== scopeKey) return;
        this.docPatients = [];
      }
    });
    this.http
      .get<{ doctors: DoctorRow[] }>(this.doctorApiUrl, { params: { page: 1, limit: 500, activeOnly: '1' } })
      .subscribe({
        next: (res) => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docDoctors = (res.doctors || []).map((d) => ({
            id: d.id,
            name: d.username || `Doctor #${d.id}`
          }));
        },
        error: () => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docDoctors = [];
        }
      });
    this.http
      .get<{ appointments: AppointmentRow[] }>(this.appointmentApiUrl, { params: { page: 1, limit: 800 } })
      .subscribe({
        next: (res) => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docAppointments = res.appointments || [];
        },
        error: () => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docAppointments = [];
        }
      });
    this.http
      .get<{ bills: Array<{ id: number; patientName: string; billDate: string; finalAmount: number }> }>(
        `${this.financialApiUrl}/bills`,
        { params: { page: 1, limit: 200 } }
      )
      .subscribe({
        next: (res) => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docBillsSelect = (res.bills || []).map((b) => ({
            id: b.id,
            label: `#${b.id} · ${b.patientName || 'Bill'} · ${b.billDate}`
          }));
        },
        error: () => {
          if (this.docReferenceDataClinicKey !== scopeKey) return;
          this.docBillsSelect = [];
        }
      });
  }

  get docPatientsFiltered(): Array<{ id: number; name: string }> {
    const q = this.docPatientSearch.trim().toLowerCase();
    if (!q) return this.docPatients;
    return this.docPatients.filter((p) => p.name.toLowerCase().includes(q));
  }

  private getDocCategoryKey(documentType: string | null | undefined): 'prescriptions' | 'xrays' | 'labs' | 'consents' | 'plans' {
    const t = String(documentType || '').toLowerCase();
    if (t.includes('xray') || t.includes('x-ray')) return 'xrays';
    if (t.includes('lab') || t.includes('report')) return 'labs';
    if (t.includes('consent')) return 'consents';
    if (t.includes('plan') || t.includes('treatment')) return 'plans';
    return 'prescriptions';
  }

  get docPatientCategories(): Array<{ key: 'all' | 'prescriptions' | 'xrays' | 'labs' | 'consents' | 'plans'; label: string; count: number }> {
    const counts = {
      prescriptions: 0,
      xrays: 0,
      labs: 0,
      consents: 0,
      plans: 0
    };
    for (const row of this.docPatientAttachments) {
      const key = this.getDocCategoryKey(row.documentType);
      counts[key] += 1;
    }
    return [
      { key: 'all', label: 'All Documents', count: this.docPatientAttachments.length },
      { key: 'prescriptions', label: 'Prescriptions', count: counts.prescriptions },
      { key: 'xrays', label: 'X-Rays', count: counts.xrays },
      { key: 'labs', label: 'Lab Reports', count: counts.labs },
      { key: 'consents', label: 'Consent Forms', count: counts.consents },
      { key: 'plans', label: 'Treatment Plans', count: counts.plans }
    ];
  }

  get docPatientAttachmentsDisplay(): AttachmentMetaRow[] {
    const q = this.docPatientDocumentSearch.trim().toLowerCase();
    return this.docPatientAttachments.filter((row) => {
      const categoryMatch =
        this.docPatientCategoryFilter === 'all' || this.getDocCategoryKey(row.documentType) === this.docPatientCategoryFilter;
      if (!categoryMatch) return false;
      if (!q) return true;
      const hay = `${row.title || ''} ${row.fileName || ''} ${row.documentType || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  getDocPatientCardTypeLabel(row: AttachmentMetaRow): string {
    const k = this.getDocCategoryKey(row.documentType);
    if (k === 'xrays') return 'XR';
    if (k === 'labs') return 'LAB';
    if (k === 'consents') return 'CN';
    if (k === 'plans') return 'PLN';
    return 'DOC';
  }

  get docAppointmentsForMedPatient(): AppointmentRow[] {
    if (!this.docMedPatientId) return [];
    return this.docAppointments.filter((a) => a.patientId === this.docMedPatientId);
  }

  get docMedAttachmentsFiltered(): AttachmentMetaRow[] {
    if (!this.docMedAppointmentId) return this.docMedAttachments;
    return this.docMedAttachments.filter((a) => (a.appointmentId || null) === this.docMedAppointmentId);
  }

  onDocPatientSelected(): void {
    this.docPatientUploadExpanded = false;
    this.loadDocumentsPatientList();
  }

  loadDocumentsPatientList(): void {
    if (!this.docPatientId) {
      this.docPatientAttachments = [];
      return;
    }
    this.docPatientLoading = true;
    this.http
      .get<{ attachments: AttachmentMetaRow[]; pagination: { page: number; total: number; totalPages: number } }>(
        this.attachmentApiUrl,
        { params: { entityType: 'patient', entityId: String(this.docPatientId), page: 1, limit: 100 } }
      )
      .subscribe({
        next: (res) => {
          this.docPatientAttachments = res.attachments || [];
          this.docPatientLoading = false;
        },
        error: () => {
          this.docPatientAttachments = [];
          this.docPatientLoading = false;
        }
      });
  }

  onDocPatientFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.docPatientUpload = { ...this.docPatientUpload, file: f || null };
  }

  submitDocumentsPatientUpload(): void {
    if (!this.requireSingleClinicForCreate()) return;
    if (!this.docPatientId || !this.docPatientUpload.file) return;
    this.docPatientLoading = true;
    this.fileToDataUrl(this.docPatientUpload.file).then((t) => {
      const body = {
        fileName: t.name,
        fileType: t.type,
        data: t.data,
        entityType: 'patient',
        entityId: this.docPatientId,
        documentType: this.docPatientUpload.documentType.trim() || 'general',
        title: this.docPatientUpload.title.trim() || t.name,
        description: this.docPatientUpload.description.trim() || null
      };
      this.http.post(`${this.attachmentApiUrl}`, body).subscribe({
        next: () => {
          this.docPatientUpload = { documentType: '', title: '', description: '', file: null };
          this.docPatientLoading = false;
          this.loadDocumentsPatientList();
        },
        error: () => {
          this.docPatientLoading = false;
        }
      });
    });
  }

  loadDocumentsMedicalList(): void {
    if (!this.docMedPatientId) {
      this.docMedAttachments = [];
      return;
    }
    this.docMedLoading = true;
    this.http
      .get<{ attachments: AttachmentMetaRow[] }>(this.attachmentApiUrl, {
        params: { entityType: 'medical_record', entityId: String(this.docMedPatientId), page: 1, limit: 200 }
      })
      .subscribe({
        next: (res) => {
          this.docMedAttachments = res.attachments || [];
          this.docMedLoading = false;
        },
        error: () => {
          this.docMedAttachments = [];
          this.docMedLoading = false;
        }
      });
  }

  onDocMedPatientChange(): void {
    this.docMedAppointmentId = null;
    this.loadDocumentsMedicalList();
  }

  onDocMedFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.docMedUpload = { ...this.docMedUpload, file: f || null };
  }

  submitDocumentsMedicalUpload(): void {
    if (!this.requireSingleClinicForCreate()) return;
    if (!this.docMedPatientId || !this.docMedUpload.file) return;
    this.docMedLoading = true;
    this.fileToDataUrl(this.docMedUpload.file).then((t) => {
      const body: Record<string, unknown> = {
        fileName: t.name,
        fileType: t.type,
        data: t.data,
        entityType: 'medical_record',
        entityId: this.docMedPatientId,
        documentType: this.docMedUpload.documentType.trim() || 'clinical',
        title: this.docMedUpload.title.trim() || t.name,
        description: this.docMedUpload.description.trim() || null
      };
      const aid = this.docMedUpload.appointmentId ?? this.docMedAppointmentId;
      if (aid) body['appointmentId'] = aid;
      this.http.post(`${this.attachmentApiUrl}`, body).subscribe({
        next: () => {
          this.docMedUpload = {
            documentType: 'clinical',
            title: '',
            description: '',
            appointmentId: null,
            file: null
          };
          this.docMedLoading = false;
          this.loadDocumentsMedicalList();
        },
        error: () => {
          this.docMedLoading = false;
        }
      });
    });
  }

  onDocBillSelected(): void {
    this.loadDocumentsBillingList();
  }

  loadDocumentsBillingList(): void {
    if (!this.docBillId) {
      this.docBillingAttachments = [];
      return;
    }
    this.docBillingLoading = true;
    this.http
      .get<{ attachments: AttachmentMetaRow[] }>(this.attachmentApiUrl, {
        params: { entityType: 'billing', entityId: String(this.docBillId), page: 1, limit: 100 }
      })
      .subscribe({
        next: (res) => {
          this.docBillingAttachments = res.attachments || [];
          this.docBillingLoading = false;
        },
        error: () => {
          this.docBillingAttachments = [];
          this.docBillingLoading = false;
        }
      });
  }

  onDocBillingFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.docBillingUpload = { ...this.docBillingUpload, file: f || null };
  }

  submitDocumentsBillingUpload(): void {
    if (!this.requireSingleClinicForCreate()) return;
    if (!this.docBillId || !this.docBillingUpload.file) return;
    this.docBillingLoading = true;
    this.fileToDataUrl(this.docBillingUpload.file).then((t) => {
      const body = {
        fileName: t.name,
        fileType: t.type,
        data: t.data,
        entityType: 'billing',
        entityId: this.docBillId,
        documentType: this.docBillingUpload.documentType.trim() || 'receipt',
        title: this.docBillingUpload.title.trim() || t.name,
        description: this.docBillingUpload.description.trim() || null
      };
      this.http.post(`${this.attachmentApiUrl}`, body).subscribe({
        next: () => {
          this.docBillingUpload = { documentType: 'receipt', title: '', description: '', file: null };
          this.docBillingLoading = false;
          this.loadDocumentsBillingList();
        },
        error: () => {
          this.docBillingLoading = false;
        }
      });
    });
  }

  onDocDoctorSelected(): void {
    this.loadDocumentsDoctorList();
  }

  loadDocumentsDoctorList(): void {
    if (!this.docDoctorId) {
      this.docDoctorAttachments = [];
      return;
    }
    this.docDoctorLoading = true;
    this.http
      .get<{ attachments: AttachmentMetaRow[] }>(this.attachmentApiUrl, {
        params: { entityType: 'doctor', entityId: String(this.docDoctorId), page: 1, limit: 100 }
      })
      .subscribe({
        next: (res) => {
          this.docDoctorAttachments = res.attachments || [];
          this.docDoctorLoading = false;
        },
        error: () => {
          this.docDoctorAttachments = [];
          this.docDoctorLoading = false;
        }
      });
  }

  onDocDoctorFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.docDoctorUpload = { ...this.docDoctorUpload, file: f || null };
  }

  submitDocumentsDoctorUpload(): void {
    if (!this.requireSingleClinicForCreate()) return;
    if (!this.docDoctorId || !this.docDoctorUpload.file) return;
    this.docDoctorLoading = true;
    this.fileToDataUrl(this.docDoctorUpload.file).then((t) => {
      const body = {
        fileName: t.name,
        fileType: t.type,
        data: t.data,
        entityType: 'doctor',
        entityId: this.docDoctorId,
        documentType: this.docDoctorUpload.documentType.trim() || 'certificate',
        title: this.docDoctorUpload.title.trim() || t.name,
        description: this.docDoctorUpload.description.trim() || null
      };
      this.http.post(`${this.attachmentApiUrl}`, body).subscribe({
        next: () => {
          this.docDoctorUpload = { documentType: 'certificate', title: '', description: '', file: null };
          this.docDoctorLoading = false;
          this.loadDocumentsDoctorList();
        },
        error: () => {
          this.docDoctorLoading = false;
        }
      });
    });
  }

  loadDocumentsBrowse(): void {
    this.docBrowseLoading = true;
    const p: Record<string, string | number> = {
      page: this.docBrowseFilters.page,
      limit: this.docBrowsePagination.limit
    };
    if (this.docBrowseFilters.entityType) p['entityType'] = this.docBrowseFilters.entityType;
    if (this.docBrowseFilters.entityId.trim()) p['entityId'] = this.docBrowseFilters.entityId.trim();
    if (this.docBrowseFilters.documentType.trim()) p['documentType'] = this.docBrowseFilters.documentType.trim();
    if (this.docBrowseFilters.fromDate) p['fromDate'] = this.docBrowseFilters.fromDate;
    if (this.docBrowseFilters.toDate) p['toDate'] = this.docBrowseFilters.toDate;
    if (this.docBrowseFilters.appointmentId.trim()) p['appointmentId'] = this.docBrowseFilters.appointmentId.trim();
    this.http
      .get<{
        attachments: AttachmentMetaRow[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`${this.attachmentApiUrl}/browse`, { params: p })
      .subscribe({
        next: (res) => {
          this.docBrowseAttachments = res.attachments || [];
          const pg = res.pagination;
          this.docBrowsePagination = {
            page: pg?.page || 1,
            limit: pg?.limit || 25,
            total: pg?.total ?? 0,
            totalPages: pg?.totalPages || 1
          };
          this.docBrowseLoading = false;
        },
        error: () => {
          this.docBrowseAttachments = [];
          this.docBrowseLoading = false;
        }
      });
  }

  applyDocumentsBrowseFilters(): void {
    this.docBrowseFilters = { ...this.docBrowseFilters, page: 1 };
    this.loadDocumentsBrowse();
  }

  changeDocumentsBrowsePage(dir: 'prev' | 'next'): void {
    const next =
      dir === 'next' ? this.docBrowsePagination.page + 1 : this.docBrowsePagination.page - 1;
    if (next < 1 || next > this.docBrowsePagination.totalPages) return;
    this.docBrowseFilters = { ...this.docBrowseFilters, page: next };
    this.loadDocumentsBrowse();
  }

  openDocMgmtPreview(row: AttachmentMetaRow): void {
    this.closeDocMgmtEdit();
    this.docMgmtPreview = row;
    this.docMgmtPreviewData = null;
    this.docMgmtPreviewUrl = null;
    this.http.get<{ attachment: { data: string; fileType: string; fileName: string } }>(`${this.attachmentApiUrl}/${row.id}`).subscribe({
      next: (res) => {
        const a = res.attachment;
        if (!a?.data) return;
        this.docMgmtPreviewData = { data: a.data, fileType: a.fileType, fileName: a.fileName };
        if (this.isDocMgmtPreviewPdf(a.fileType)) {
          this.docMgmtPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(a.data);
        }
      },
      error: () => {
        this.docMgmtPreview = null;
      }
    });
  }

  closeDocMgmtPreview(): void {
    this.docMgmtPreview = null;
    this.docMgmtPreviewData = null;
    this.docMgmtPreviewUrl = null;
  }

  isDocMgmtPreviewImage(fileType: string): boolean {
    return !!fileType && fileType.toLowerCase().startsWith('image/');
  }

  isDocMgmtPreviewPdf(fileType: string): boolean {
    return !!fileType && fileType.toLowerCase().includes('pdf');
  }

  downloadDocMgmtAttachment(row: AttachmentMetaRow): void {
    this.http.get<{ attachment: { data: string; fileType: string; fileName: string } }>(`${this.attachmentApiUrl}/${row.id}`).subscribe({
      next: (res) => {
        const a = res.attachment;
        if (!a?.data) return;
        const link = document.createElement('a');
        link.href = a.data;
        link.download = a.fileName || `file-${row.id}`;
        link.click();
      }
    });
  }

  deleteDocMgmtAttachment(row: AttachmentMetaRow, reload?: () => void): void {
    if (!window.confirm(`Delete "${row.fileName || row.id}"?`)) return;
    const r = reload ?? (() => this.reloadDocumentsForActiveRoute());
    this.http.delete(`${this.attachmentApiUrl}/${row.id}`).subscribe({
      next: () => r(),
      error: () => {}
    });
  }

  reloadDocumentsForActiveRoute(): void {
    const a = this.active;
    if (a === 'documents-patient') this.loadDocumentsPatientList();
    else if (a === 'documents-medical') this.loadDocumentsMedicalList();
    else if (a === 'documents-billing') this.loadDocumentsBillingList();
    else if (a === 'documents-doctor') this.loadDocumentsDoctorList();
    else if (a === 'documents-all') this.loadDocumentsBrowse();
  }

  formatDocDate(s: string | null | undefined): string {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s).slice(0, 19);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  openDocMgmtEdit(row: AttachmentMetaRow): void {
    this.closeDocMgmtPreview();
    this.docMgmtEditId = row.id;
    this.docMgmtEditForm = {
      documentType: row.documentType || '',
      title: row.title || '',
      description: row.description || '',
      entityType: (row.entityType as any) || 'patient',
      entityId: row.entityId != null ? String(row.entityId) : '',
      appointmentId: row.appointmentId != null ? String(row.appointmentId) : '',
      replaceFile: null
    };
    this.docMgmtEditOpen = true;
  }

  closeDocMgmtEdit(): void {
    this.docMgmtEditOpen = false;
    this.docMgmtEditId = null;
  }

  onDocMgmtEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.docMgmtEditForm.replaceFile = input.files?.[0] || null;
  }

  submitDocMgmtEdit(): void {
    if (!this.docMgmtEditId) return;
    const eid = Number(this.docMgmtEditForm.entityId);
    if (!eid || eid <= 0) {
      window.alert('Please enter a valid entity ID.');
      return;
    }
    this.docMgmtEditSaving = true;
    const base: Record<string, unknown> = {
      documentType: this.docMgmtEditForm.documentType.trim() || null,
      title: this.docMgmtEditForm.title.trim() || null,
      description: this.docMgmtEditForm.description.trim() || null,
      entityType: this.docMgmtEditForm.entityType,
      entityId: eid
    };
    if (this.docMgmtEditForm.appointmentId.trim()) {
      base['appointmentId'] = Number(this.docMgmtEditForm.appointmentId);
    } else {
      base['appointmentId'] = null;
    }
    const finish = (): void => {
      this.docMgmtEditSaving = false;
      this.closeDocMgmtEdit();
      this.reloadDocumentsForActiveRoute();
    };
    const fail = (): void => {
      this.docMgmtEditSaving = false;
    };
    if (this.docMgmtEditForm.replaceFile) {
      this.fileToDataUrl(this.docMgmtEditForm.replaceFile).then((t) => {
        base['data'] = t.data;
        base['fileName'] = t.name;
        base['fileType'] = t.type;
        this.http.put(`${this.attachmentApiUrl}/${this.docMgmtEditId}`, base).subscribe({
          next: () => finish(),
          error: fail
        });
      });
    } else {
      this.http.put(`${this.attachmentApiUrl}/${this.docMgmtEditId}`, base).subscribe({
        next: () => finish(),
        error: fail
      });
    }
  }

  formatMoney(n: number): string {
    return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get financialChartMax(): number {
    const ch = this.financialDashboard?.chart || [];
    let m = 1;
    for (const row of ch) {
      const net = Number(row.net);
      m = Math.max(m, row.income, row.expense, Math.abs(net || 0));
    }
    return m;
  }

  get financialNetBarMax(): number {
    const ch = this.financialDashboard?.chart || [];
    let m = 1;
    for (const row of ch) {
      const net = Number(row.net);
      m = Math.max(m, Math.abs(net || 0));
    }
    return m;
  }

  chartBarPct(value: number): number {
    const m = this.financialChartMax;
    return m > 0 ? Math.min(100, Math.round((Number(value) / m) * 100)) : 0;
  }

  chartNetBarPct(net: number): number {
    const m = this.financialNetBarMax;
    return m > 0 ? Math.min(100, Math.round((Math.abs(Number(net)) / m) * 100)) : 0;
  }

  get financialChartRows(): Array<{ month: string; income: number; expense: number; net: number }> {
    return this.financialDashboard?.chart || [];
  }

  get financialNetPolyline(): string {
    const ch = this.financialChartRows;
    if (!ch.length) return '';
    const series = ch.map((r) => Number(r.net) || 0);
    return this.toPolylinePoints(series, 520, 110, 14);
  }

  get financialNetPoints(): Array<{ x: number; y: number; month: string; net: number }> {
    const ch = this.financialChartRows;
    if (!ch.length) return [];
    const series = ch.map((r) => Number(r.net) || 0);
    const w = 520;
    const h = 110;
    const pad = 14;
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const span = Math.max(max - min, 1);
    const n = series.length;
    const denom = Math.max(n - 1, 1);
    return series.map((v, idx) => ({
      x: pad + (idx * (w - pad * 2)) / denom,
      y: pad + ((max - v) * (h - pad * 2)) / span,
      month: ch[idx].month,
      net: v
    }));
  }

  get financialDashboardPeriodLabel(): string {
    const p = this.financialDashboard?.period;
    if (!p?.fromDate || !p?.toDate) return '';
    return `${p.fromDate} → ${p.toDate}`;
  }

  get financialPaymentMethodMax(): number {
    const rows = this.financialDashboard?.incomeByPaymentMethod || [];
    let m = 1;
    for (const r of rows) m = Math.max(m, r.amount);
    return m;
  }

  get financialCategoryMax(): number {
    const rows = this.financialDashboard?.expenseByCategory || [];
    let m = 1;
    for (const r of rows) m = Math.max(m, r.amount);
    return m;
  }

  hBarPct(value: number, max: number): number {
    return max > 0 ? Math.min(100, Math.round((Number(value) / max) * 100)) : 0;
  }

  formatPaymentMethodLabel(m: string): string {
    const s = String(m || 'other');
    if (s === 'upi') return 'UPI';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  resetMaintenanceRaiseForm(): void {
    this.maintenanceRaiseForm = {
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
      initialMessage: '',
      file: null
    };
    this.maintenanceRaiseError = '';
  }

  onMaintenanceRaiseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    this.maintenanceRaiseForm.file = f || null;
  }

  private readFileBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        const i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(file);
    });
  }

  submitMaintenanceRaise(): void {
    if (this.user?.role !== 'Staff') return;
    if (!this.requireSingleClinicForCreate()) return;
    const title = this.maintenanceRaiseForm.title.trim();
    if (!title) {
      this.maintenanceRaiseError = 'Title is required.';
      return;
    }
    this.maintenanceRaiseSubmitting = true;
    this.maintenanceRaiseError = '';
    const body: Record<string, unknown> = {
      title,
      description: this.maintenanceRaiseForm.description.trim() || null,
      category: this.maintenanceRaiseForm.category,
      priority: this.maintenanceRaiseForm.priority
    };
    const im = this.maintenanceRaiseForm.initialMessage.trim();
    if (im) {
      body['initialMessage'] = im;
    }
    this.http
      .post<{
        complaint: { id: number };
      }>(this.complaintsApiUrl, body)
      .subscribe({
        next: (res) => {
          const id = res?.complaint?.id;
          const file = this.maintenanceRaiseForm.file;
          const finishOk = (): void => {
            this.maintenanceRaiseSubmitting = false;
            this.toast.success('Complaint submitted.');
            this.resetMaintenanceRaiseForm();
            this.setActive('maintenance-my');
          };
          if (id && file) {
            this.readFileBase64(file).then((data) =>
              firstValueFrom(
                this.http.post(this.attachmentApiUrl, {
                  data,
                  entityType: 'complaint',
                  entityId: id,
                  fileName: file.name,
                  fileType: file.type || 'application/octet-stream'
                })
              )
                .then(() => finishOk())
                .catch(() => {
                  this.maintenanceRaiseSubmitting = false;
                  this.toast.error('Complaint saved but file upload failed.');
                  this.resetMaintenanceRaiseForm();
                  this.setActive('maintenance-my');
                })
            );
            return;
          }
          finishOk();
        },
        error: (err) => {
          this.maintenanceRaiseSubmitting = false;
          this.maintenanceRaiseError = err?.error?.message || 'Could not create complaint.';
        }
      });
  }

  loadMaintenanceMyComplaints(): void {
    this.maintenanceMyLoading = true;
    this.http
      .get<{ complaints: ComplaintListRow[] }>(this.complaintsApiUrl, {
        params: { page: 1, limit: 500 }
      })
      .subscribe({
        next: (res) => {
          const uid = Number(this.user?.id);
          const all = res?.complaints || [];
          this.maintenanceMyRows = all.filter((c) => c.createdBy === uid);
          this.maintenanceMyLoading = false;
        },
        error: () => {
          this.maintenanceMyRows = [];
          this.maintenanceMyLoading = false;
          this.toast.error('Could not load your complaints.');
        }
      });
  }

  loadMaintenanceAllComplaints(page = 1): void {
    if (!this.canManageUserAccounts) return;
    this.maintenanceAllLoading = true;
    const params: Record<string, string | number> = {
      page,
      limit: this.maintenanceAllPagination.limit
    };
    if (this.maintenanceAllFilterStatus) {
      params['status'] = this.maintenanceAllFilterStatus;
    }
    if (this.maintenanceAllFilterPriority) {
      params['priority'] = this.maintenanceAllFilterPriority;
    }
    if (
      this.authSession.isAllClinicsScopeSelected() &&
      this.maintenanceAllFilterClinicId !== '' &&
      this.maintenanceAllFilterClinicId != null
    ) {
      params['clinicId'] = Number(this.maintenanceAllFilterClinicId);
    }
    this.http
      .get<{
        complaints: ComplaintListRow[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }>(this.complaintsApiUrl, { params })
      .subscribe({
        next: (res) => {
          this.maintenanceAllRows = res?.complaints || [];
          const pg = res?.pagination;
          this.maintenanceAllPagination = {
            page: pg?.page ?? page,
            limit: pg?.limit ?? this.maintenanceAllPagination.limit,
            total: pg?.total ?? this.maintenanceAllRows.length,
            totalPages: pg?.totalPages ?? 1
          };
          this.maintenanceAllPageInput = this.maintenanceAllPagination.page;
          this.maintenanceAllLoading = false;
        },
        error: () => {
          this.maintenanceAllRows = [];
          this.maintenanceAllLoading = false;
          this.toast.error('Could not load complaints.');
        }
      });
  }

  applyMaintenanceAllFilters(): void {
    this.loadMaintenanceAllComplaints(1);
  }

  maintenanceAllGoPage(dir: 'prev' | 'next'): void {
    const next =
      dir === 'next'
        ? this.maintenanceAllPagination.page + 1
        : this.maintenanceAllPagination.page - 1;
    if (next < 1 || next > this.maintenanceAllPagination.totalPages) return;
    this.loadMaintenanceAllComplaints(next);
  }

  maintenanceAllGoPageInput(): void {
    const t = Math.max(
      1,
      Math.min(
        this.maintenanceAllPagination.totalPages,
        Number(this.maintenanceAllPageInput) || 1
      )
    );
    this.loadMaintenanceAllComplaints(t);
  }

  openComplaintDetail(id: number, returnKey: string): void {
    this.complaintDetailReturnKey = returnKey;
    this.complaintDetailId = id;
    this.active = 'maintenance-detail';
    this.maintenanceStatusForm = { status: '', message: '', rejectionReason: '' };
    this.maintenanceCommentText = '';
    this.maintenanceAssignUserId = '';
    this.loadComplaintDetail(id);
    if (this.canManageUserAccounts) {
      this.loadMaintenanceAssignStaffOptions();
    }
  }

  backFromComplaintDetail(): void {
    const k = this.complaintDetailReturnKey;
    this.closeAttachmentPreview();
    this.complaintDetailId = null;
    this.complaintDetail = null;
    this.setActive(k || 'dashboard');
  }

  loadComplaintDetail(id: number): void {
    this.complaintDetailLoading = true;
    this.http
      .get<{
        complaint: {
          id: number;
          clinicId: number;
          title: string;
          description: string | null;
          category: string;
          priority: string;
          status: string;
          createdBy: number;
          assignedTo: number | null;
          rejectionReason: string | null;
          resolvedAt: string | null;
          createdAt: string | null;
          updatedAt: string | null;
          clinic?: ComplaintClinicRef;
          createdByStaff?: {
            user: { id: number; username: string; email: string };
            staff: {
              id: number;
              staffType: string;
              department: string | null;
              joiningDate: string | null;
            } | null;
          };
          assignedToUser?: { userId: number; username: string; email: string } | null;
          updates: ComplaintUpdateDto[];
          attachments: ComplaintAttachmentMeta[];
        };
      }>(`${this.complaintsApiUrl}/${id}`)
      .subscribe({
        next: (res) => {
          this.complaintDetail = res?.complaint || null;
          if (this.complaintDetail) {
            this.maintenanceStatusForm.status = this.complaintDetail.status;
          }
          this.complaintDetailLoading = false;
        },
        error: () => {
          this.complaintDetail = null;
          this.complaintDetailLoading = false;
          this.toast.error('Could not load complaint.');
        }
      });
  }

  loadMaintenanceAssignStaffOptions(): void {
    this.http
      .get<{ staff: Array<{ userId: number; username: string; email: string }> }>(
        this.staffApiUrl,
        { params: { page: 1, limit: 200 } }
      )
      .subscribe({
        next: (res) => {
          this.maintenanceAssignStaffOptions = (res?.staff || []).map((s) => ({
            userId: s.userId,
            username: s.username,
            email: s.email
          }));
        },
        error: () => {
          this.maintenanceAssignStaffOptions = [];
        }
      });
  }

  get canManageComplaintDetail(): boolean {
    return this.canManageUserAccounts;
  }

  submitMaintenanceStatus(): void {
    if (!this.complaintDetailId || !this.canManageUserAccounts) return;
    const status = this.maintenanceStatusForm.status;
    const body: Record<string, unknown> = {
      status,
      message: this.maintenanceStatusForm.message.trim() || null
    };
    if (status === 'rejected') {
      body['rejectionReason'] = this.maintenanceStatusForm.rejectionReason.trim();
      if (!body['rejectionReason']) {
        this.toast.error('Rejection reason is required.');
        return;
      }
    }
    this.maintenanceStatusSubmitting = true;
    this.http
      .patch<{ complaint: ComplaintDetailDto }>(
        `${this.complaintsApiUrl}/${this.complaintDetailId}/status`,
        body
      )
      .subscribe({
        next: (res) => {
          this.maintenanceStatusSubmitting = false;
          if (res?.complaint) {
            this.complaintDetail = res.complaint;
            this.maintenanceStatusForm.message = '';
            this.maintenanceStatusForm.rejectionReason = '';
          } else {
            this.loadComplaintDetail(this.complaintDetailId!);
          }
          this.toast.success('Status updated.');
        },
        error: (err) => {
          this.maintenanceStatusSubmitting = false;
          this.toast.error(err?.error?.message || 'Could not update status.');
        }
      });
  }

  submitMaintenanceComment(): void {
    if (!this.complaintDetailId || !this.canManageUserAccounts) return;
    const message = this.maintenanceCommentText.trim();
    if (!message) {
      this.toast.error('Enter a message.');
      return;
    }
    this.maintenanceCommentSubmitting = true;
    this.http
      .post<{ complaint: ComplaintDetailDto }>(
        `${this.complaintsApiUrl}/${this.complaintDetailId}/updates`,
        { message }
      )
      .subscribe({
        next: (res) => {
          this.maintenanceCommentSubmitting = false;
          this.maintenanceCommentText = '';
          if (res?.complaint) {
            this.complaintDetail = res.complaint;
          } else {
            this.loadComplaintDetail(this.complaintDetailId!);
          }
          this.toast.success('Update added.');
        },
        error: (err) => {
          this.maintenanceCommentSubmitting = false;
          this.toast.error(err?.error?.message || 'Could not add update.');
        }
      });
  }

  submitMaintenanceAssign(): void {
    if (!this.complaintDetailId || !this.canManageUserAccounts) return;
    const uid = Number(this.maintenanceAssignUserId);
    if (!Number.isFinite(uid) || uid < 1) {
      this.toast.error('Select a user to assign.');
      return;
    }
    this.maintenanceAssignSubmitting = true;
    this.http
      .patch<{ complaint: ComplaintDetailDto }>(
        `${this.complaintsApiUrl}/${this.complaintDetailId}/assign`,
        { assignedTo: uid }
      )
      .subscribe({
        next: (res) => {
          this.maintenanceAssignSubmitting = false;
          if (res?.complaint) {
            this.complaintDetail = res.complaint;
          } else {
            this.loadComplaintDetail(this.complaintDetailId!);
          }
          this.toast.success('Assignee updated.');
        },
        error: (err) => {
          this.maintenanceAssignSubmitting = false;
          this.toast.error(err?.error?.message || 'Could not assign.');
        }
      });
  }

  confirmDeleteComplaint(): void {
    if (!this.complaintDetailId || !this.canManageUserAccounts) return;
    if (!confirm('Delete this complaint and its history? This cannot be undone.')) return;
    this.maintenanceDeleteSubmitting = true;
    this.http.delete(`${this.complaintsApiUrl}/${this.complaintDetailId}`).subscribe({
      next: () => {
        this.maintenanceDeleteSubmitting = false;
        this.toast.success('Complaint deleted.');
        this.backFromComplaintDetail();
      },
      error: (err) => {
        this.maintenanceDeleteSubmitting = false;
        this.toast.error(err?.error?.message || 'Could not delete.');
      }
    });
  }

  previewComplaintAttachment(att: ComplaintAttachmentMeta): void {
    this.http
      .get<{
        attachment: { fileName: string; fileType: string; data: string };
      }>(`${this.attachmentApiUrl}/${att.id}`)
      .subscribe({
        next: (res) => {
          const row = res?.attachment;
          const raw = row?.data || '';
          const mime = row?.fileType || att.fileType || 'application/octet-stream';
          const name = row?.fileName || att.fileName;
          this.attachmentPreviewName = name;
          this.sanitizedAttachmentPreview = null;
          if (mime.startsWith('image/')) {
            this.attachmentPreviewUrl = `data:${mime};base64,${raw}`;
          } else {
            const blob = this.base64ToBlob(raw, mime);
            if (this.attachmentPreviewUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(this.attachmentPreviewUrl);
            }
            this.attachmentPreviewUrl = URL.createObjectURL(blob);
            this.sanitizedAttachmentPreview = this.sanitizer.bypassSecurityTrustResourceUrl(
              this.attachmentPreviewUrl
            );
          }
        },
        error: () => this.toast.error('Could not load attachment.')
      });
  }

  private base64ToBlob(b64: string, mime: string): Blob {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return new Blob([arr], { type: mime || 'application/octet-stream' });
  }

  downloadComplaintAttachment(att: ComplaintAttachmentMeta): void {
    this.http
      .get<{ attachment: { fileName: string; fileType: string; data: string } }>(
        `${this.attachmentApiUrl}/${att.id}`
      )
      .subscribe({
        next: (res) => {
          const row = res?.attachment;
          const blob = this.base64ToBlob(row?.data || '', row?.fileType || att.fileType);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = row?.fileName || att.fileName || 'download';
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.toast.error('Could not download.')
      });
  }

  closeAttachmentPreview(): void {
    if (this.attachmentPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.attachmentPreviewUrl);
    }
    this.attachmentPreviewUrl = null;
    this.sanitizedAttachmentPreview = null;
    this.attachmentPreviewName = '';
  }

  formatComplaintStatusLabel(s: string): string {
    return String(s || '')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  logout(): void {
    this.authSession.clear();
    this.router.navigate(['/login']);
  }
}

