-- Image Trace Database Initialization Script
-- This script creates the complete database schema for the image traceability analysis system
-- Created on: 2025-11-16

-- Projects table - stores project information
CREATE TABLE projects (
    name VARCHAR(255) NOT NULL,
    description VARCHAR,
    status VARCHAR(50) NOT NULL,
    owner_id CHAR(32),
    settings VARCHAR,
    id CHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
);

-- Index for projects table
CREATE INDEX ix_projects_id ON projects (id);

-- Users table - stores user information
CREATE TABLE users (
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    is_active BOOLEAN NOT NULL,
    id CHAR(32) NOT NULL,
    supabase_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
);

-- Indexes for users table
CREATE INDEX ix_users_id ON users (id);
CREATE INDEX ix_users_email ON users (email);
CREATE UNIQUE INDEX ix_users_supabase_id ON users (supabase_id);

-- Images table - stores image information
CREATE TABLE images (
    project_id CHAR(32) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    checksum VARCHAR,
    image_metadata VARCHAR,
    id CHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(project_id) REFERENCES projects (id)
);

-- Index for images table
CREATE INDEX ix_images_id ON images (id);

-- Documents table - stores document information
CREATE TABLE documents (
    project_id CHAR(32) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    checksum VARCHAR,
    document_metadata VARCHAR,
    processing_status VARCHAR(50) NOT NULL,
    extracted_image_count INTEGER,
    id CHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(project_id) REFERENCES projects (id)
);

-- Index for documents table
CREATE INDEX ix_documents_id ON documents (id);

-- Extracted Images table - stores extracted images from documents
CREATE TABLE extracted_images (
    document_id CHAR(32) NOT NULL,
    project_id CHAR(32) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    checksum VARCHAR,
    extraction_metadata VARCHAR,
    image_id CHAR(32),
    id CHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(document_id) REFERENCES documents (id),
    FOREIGN KEY(project_id) REFERENCES projects (id),
    FOREIGN KEY(image_id) REFERENCES images (id)
);

-- Index for extracted_images table
CREATE INDEX ix_extracted_images_id ON extracted_images (id);

-- Analysis Results table - stores analysis results
CREATE TABLE analysis_results (
    project_id CHAR(32) NOT NULL,
    task_id VARCHAR(100) NOT NULL,
    algorithm_type VARCHAR(50) NOT NULL,
    parameters VARCHAR,
    results VARCHAR,
    confidence_score FLOAT,
    processing_time_seconds FLOAT,
    id CHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT "pending",
    progress REAL DEFAULT 0.0,
    error_message TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY(project_id) REFERENCES projects (id),
    UNIQUE (task_id)
);

-- Index for analysis_results table
CREATE INDEX ix_analysis_results_id ON analysis_results (id);

-- Insert sample data (optional - for development/testing)
-- INSERT INTO projects (id, name, description, status, created_at, updated_at)
-- VALUES ('sample-project-id', 'Sample Project', 'A sample project for testing', 'active', datetime('now'), datetime('now'));

-- INSERT INTO users (id, email, display_name, is_active, supabase_id, created_at, updated_at)
-- VALUES ('sample-user-id', 'user@example.com', 'Sample User', true, 'sample-supabase-id', datetime('now'), datetime('now'));