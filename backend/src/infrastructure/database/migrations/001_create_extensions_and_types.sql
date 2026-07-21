-- ============================================================
-- Migration 001 — Extensions & Enum Types
-- ReqAI – AI Requirement Analyzer
-- ============================================================

-- ------------------------------------
-- Extensions
-- ------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- trigram full-text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN indexes on scalar types

-- ------------------------------------
-- Enum Types
-- ------------------------------------

CREATE TYPE user_role AS ENUM (
    'ADMIN',
    'BUSINESS_ANALYST',
    'DEVELOPER',
    'QA_ENGINEER',
    'ARCHITECT',
    'PROJECT_MANAGER'
);

CREATE TYPE requirement_status AS ENUM (
    'DRAFT',
    'IN_ANALYSIS',
    'ANALYZED',
    'REVIEWED',
    'APPROVED',
    'ARCHIVED'
);

CREATE TYPE requirement_type AS ENUM (
    'FUNCTIONAL',
    'NON_FUNCTIONAL',
    'BUSINESS',
    'TECHNICAL',
    'CONSTRAINT',
    'ASSUMPTION'
);

CREATE TYPE priority_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE analysis_status AS ENUM (
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE artifact_type AS ENUM (
    'USER_STORIES',
    'ACCEPTANCE_CRITERIA',
    'TEST_SCENARIOS',
    'NON_FUNCTIONAL_REQS',
    'RISKS',
    'TECHNICAL_NOTES',
    'COMPLEXITY_SCORE',
    'SUMMARY',
    'MISSING_INFO'
);

CREATE TYPE complexity_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'VERY_HIGH'
);

CREATE TYPE risk_severity AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE ai_provider AS ENUM (
    'OPENAI',
    'AZURE_OPENAI',
    'ANTHROPIC',
    'WATSONX',
    'CUSTOM'
);

CREATE TYPE audit_action AS ENUM (
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'ANALYZE',
    'EXPORT',
    'INVITE',
    'REVOKE'
);

CREATE TYPE project_status AS ENUM (
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'ARCHIVED'
);

CREATE TYPE project_member_role AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'VIEWER'
);

CREATE TYPE notification_type AS ENUM (
    'ANALYSIS_COMPLETE',
    'ANALYSIS_FAILED',
    'HIGH_RISK_DETECTED',
    'REQUIREMENT_REVIEWED',
    'TEAM_INVITE',
    'SYSTEM_ALERT'
);
