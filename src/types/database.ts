export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: Clinic;
        Insert: Omit<Clinic, 'id' | 'created_at'>;
        Update: Partial<Omit<Clinic, 'id' | 'created_at'>>;
      };
      patients: {
        Row: Patient;
        Insert: Omit<Patient, 'id' | 'created_at'>;
        Update: Partial<Omit<Patient, 'id' | 'created_at'>>;
      };
      visits: {
        Row: Visit;
        Insert: Omit<Visit, 'id' | 'created_at'>;
        Update: Partial<Omit<Visit, 'id' | 'created_at'>>;
      };
      appointments: {
        Row: Appointment;
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>;
      };
      receipts: {
        Row: Receipt;
        Insert: Omit<Receipt, 'id' | 'created_at'>;
        Update: Partial<Omit<Receipt, 'id' | 'created_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
      settings: {
        Row: Settings;
        Insert: Omit<Settings, 'id' | 'updated_at'>;
        Update: Partial<Omit<Settings, 'id'>>;
      };
    };
  };
}

export interface Clinic {
  id: string;
  name: string;
  phone: string;
  address: string;
  slug: string | null;
  line_channel_access_token: string | null;
  line_channel_secret: string | null;
  liff_id: string | null;
  tier: 'starter' | 'professional' | 'enterprise' | 'custom';
  is_active: boolean;
  owner_email: string | null;
  subscription_expires_at: string | null;
  custom_features: Record<string, boolean> | null;
  created_at: string;
}

export interface ClinicWithStats extends Clinic {
  patient_count: number;
  visit_count: number;
  total_revenue: number;
}

export interface Patient {
  id: string;
  clinic_id: string;
  hn: string;
  full_name: string;
  phone: string;
  allergies: string | null;
  disease: string | null;
  face_image_url: string | null;
  consent_image_url: string | null;
  source: string | null;
  sales_name: string | null;
  line_user_id: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  clinic_id: string;
  patient_id: string;
  hn: string;
  treatment_name: string;
  price: number;
  doctor: string | null;
  sales_name: string | null;
  customer_type: 'new' | 'returning';
  payment_method: 'โอน' | 'เงินสด' | 'เครดิต';
  appt_date: string | null;
  appt_time: string | null;
  appt_treatment: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  hn: string | null;
  name: string;
  phone: string;
  sales_name: string | null;
  doctor: string | null;
  status: 'new' | 'returning';
  date: string;
  time: string;
  procedure: string | null;
  note: string | null;
  line_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  clinic_id: string;
  visit_id: string;
  hn: string;
  full_name: string;
  items: { name: string; price: number }[];
  total: number;
  payment_method: string;
  receiver: string;
  pdf_url: string | null;
  date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string | null;
  type: 'reminder' | 'confirm' | 'followup' | 'marketing';
  line_user_id: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

export interface Settings {
  id: string;
  clinic_id: string;
  sales_names: string[];
  doctor_names: string[];
  time_slots: string[];
  treatment_cycles: TreatmentCycle[];
  updated_at: string;
}

export interface TreatmentCycle {
  treatment: string;
  days: number; // จำนวนวันก่อนหมดฤทธิ์
}
