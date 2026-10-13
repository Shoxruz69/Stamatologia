-- ====================================================================
-- DentaCare Stomatologiya - PostgreSQL Ma'lumotlar Bazasi Sxemasi
-- Versiya: 1.0.0
-- ====================================================================

-- 1. XODIMLAR JADVALI (Staff Members)
CREATE TABLE IF NOT EXISTS staff_members (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Shifokor', 'Medsestra', 'Menejer')),
  pin_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(10),
  avatar_color VARCHAR(30) DEFAULT '#0D9488',
  title VARCHAR(255),
  phone VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_role ON staff_members(role);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff_members(is_active);

-- 2. XIZMATLAR JADVALI (Services)
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes INT NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

-- 3. SHIFOKORLAR JADVALI (Doctors)
CREATE TABLE IF NOT EXISTS doctors (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  work_days JSONB NOT NULL DEFAULT '["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]'::jsonb,
  work_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "18:00"}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_color VARCHAR(30) DEFAULT '#0D9488',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);

-- 4. BEMORLAR JADVALI (Patients)
CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('Erkak', 'Ayol')),
  birth_date VARCHAR(50),
  address TEXT,
  total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  last_visit_date VARCHAR(50),
  debt BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  telegram_chat_id VARCHAR(64),
  telegram_username VARCHAR(100),
  telegram_connected_at VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_debt ON patients(debt);

-- 5. QABULLAR JADVALI (Appointments)
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name VARCHAR(255) NOT NULL,
  patient_phone VARCHAR(50) NOT NULL,
  doctor_id VARCHAR(64) NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  doctor_name VARCHAR(255) NOT NULL,
  service_id VARCHAR(64) REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  service_price BIGINT NOT NULL DEFAULT 0,
  date VARCHAR(20) NOT NULL,
  time VARCHAR(10) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  paid_amount BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 6. TO'LOVLAR JADVALI (Payments)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  appointment_id VARCHAR(64) REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name VARCHAR(255) NOT NULL,
  doctor_id VARCHAR(64) NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  doctor_name VARCHAR(255) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  total_amount BIGINT NOT NULL DEFAULT 0,
  paid_amount BIGINT NOT NULL DEFAULT 0,
  debt_amount BIGINT NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  date VARCHAR(20) NOT NULL,
  time VARCHAR(10) NOT NULL,
  notes TEXT,
  receipt_number VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);

-- 7. KLINIKA SOZLAMALARI JADVALI (Clinic Settings)
CREATE TABLE IF NOT EXISTS clinic_settings (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  tagline VARCHAR(255),
  address TEXT,
  phone VARCHAR(50),
  working_hours VARCHAR(100),
  default_appointment_duration INT DEFAULT 30,
  currency VARCHAR(20) DEFAULT 'so''m',
  tax_rate_percent NUMERIC(5, 2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. MAXFIY RUXSAT KODLARI JADVALI (Security Access Codes)
CREATE TABLE IF NOT EXISTS security_codes (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'default',
  master_admin_code_hash VARCHAR(255) NOT NULL,
  doctor_access_code_hash VARCHAR(255) NOT NULL,
  nurse_access_code_hash VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. AUDIT VA AMALLAR TARIXI (Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(64),
  performed_by_id VARCHAR(64),
  performed_by_name VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
