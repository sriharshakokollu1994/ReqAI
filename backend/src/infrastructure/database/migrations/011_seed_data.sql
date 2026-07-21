-- ============================================================
-- Migration 011 — Seed Data (Development / Staging Only)
-- ReqAI – AI Requirement Analyzer
-- DO NOT run in production.
-- ============================================================

-- ------------------------------------
-- Seed Users (password: 'Password123!' — bcrypt hash)
-- ------------------------------------
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, is_email_verified) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'admin@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'System', 'Admin', 'ADMIN', TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000002',
    'ananya@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'Ananya', 'Sharma', 'BUSINESS_ANALYST', TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000003',
    'marcus@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'Marcus', 'Stevens', 'DEVELOPER', TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000004',
    'priya@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'Priya', 'Rajan', 'QA_ENGINEER', TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000005',
    'david@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'David', 'Kim', 'ARCHITECT', TRUE, TRUE
),
(
    'a0000000-0000-0000-0000-000000000006',
    'sarah@reqai.dev',
    '$2b$12$LkMBgYvEIvpDFN3SkVD2pO7j1M4G5SaTz6QBTF0pCe2UX9SaM1d8O',
    'Sarah', 'Whitfield', 'PROJECT_MANAGER', TRUE, TRUE
);

-- ------------------------------------
-- Seed Projects
-- ------------------------------------
INSERT INTO projects (id, name, description, status, owner_id) VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'E-Commerce Platform',
    'Customer-facing e-commerce platform with cart, payments, and order management.',
    'ACTIVE',
    'a0000000-0000-0000-0000-000000000002'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'Banking API Gateway',
    'Enterprise banking API layer for core banking system integration.',
    'ACTIVE',
    'a0000000-0000-0000-0000-000000000002'
);

-- Project Members
INSERT INTO project_members (project_id, user_id, role) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'OWNER'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'MEMBER'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'MEMBER'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'MEMBER'),
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'VIEWER'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'OWNER'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'MEMBER');

-- ------------------------------------
-- Seed Requirements
-- ------------------------------------
INSERT INTO requirements (id, project_id, created_by, title, body, type, priority, status, tags) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'User Authentication via OAuth 2.0',
    'The system must allow users to authenticate using OAuth 2.0 with support for Google and Microsoft identity providers. Users should be able to log in using their corporate credentials. The system must support single sign-on (SSO) and maintain session state for 8 hours. Failed login attempts should be locked after 5 tries. Admins must be able to revoke access instantly.',
    'FUNCTIONAL', 'HIGH', 'ANALYZED',
    ARRAY['auth','oauth','sso','security']
),
(
    'c0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'Payment Gateway Integration',
    'The platform must integrate with Stripe and PayPal payment gateways to process credit card, debit card, and digital wallet payments. All payment data must comply with PCI-DSS Level 1. The system must handle payment failures gracefully with retry logic. Refunds must be processed within 3-5 business days.',
    'FUNCTIONAL', 'CRITICAL', 'ANALYZED',
    ARRAY['payment','stripe','pci','integration']
);
