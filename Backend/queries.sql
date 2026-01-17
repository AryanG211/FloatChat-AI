-- PROFILES TABLE (Parent)
-- This table stores information about each profile collected 
-- (like time, location, float ID, and depth range).
-- The table is partitioned by year so that data for each year 
-- is stored in its own partition.

CREATE TABLE profiles (
    profile_id SERIAL,                 -- Unique ID for each profile
    year INT NOT NULL,                 -- Year of the profile (used for partitioning)
    month INT NOT NULL,                -- Month of the profile
    float_id BIGINT,                   -- Float identifier (from the source system)
    file_path TEXT,                    -- File path where data is stored
    profile_datetime TIMESTAMP,        -- Date and time of the profile
    latitude DOUBLE PRECISION,         -- Latitude location
    longitude DOUBLE PRECISION,        -- Longitude location
    depth_min DOUBLE PRECISION,        -- Minimum depth recorded
    depth_max DOUBLE PRECISION,        -- Maximum depth recorded
    PRIMARY KEY (profile_id, year)     -- Composite primary key (profile + year)
) PARTITION BY LIST (year);            -- Partitioning strategy (list by year)


-- MEASUREMENTS TABLE (Parent)
-- This table stores the actual measurements linked to profiles:
-- pressure, temperature, and salinity. 
-- It references the profiles table to maintain data integrity.
CREATE TABLE measurements (
    measurement_id SERIAL,                      -- Unique ID for each measurement
    profile_id INT NOT NULL,                    -- Links back to profile_id
    year INT NOT NULL,                          -- Year (used for partitioning)
    pressure DOUBLE PRECISION,                  -- Pressure measurement
    temperature DOUBLE PRECISION,               -- Temperature measurement
    salinity DOUBLE PRECISION,                  -- Salinity measurement
    PRIMARY KEY (measurement_id, year),         -- Composite primary key
    FOREIGN KEY (profile_id, year)              -- Reference to profiles table
        REFERENCES profiles(profile_id, year) 
        ON DELETE CASCADE                       -- Delete measurements if parent profile is deleted
) PARTITION BY LIST (year);                     -- Partitioning strategy (list by year)


-- PARTITION CREATION BLOCK FOR PROFILES
-- This block checks if a partition for the given year exists.
-- If not, it will create a new partition table for that year.
-- NOTE: Replace {year} with the actual year before running.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'profiles_{year}' AND n.nspname = 'public'
    ) THEN
        EXECUTE 'CREATE TABLE profiles_{year} 
                 PARTITION OF profiles 
                 FOR VALUES IN ({year});';
    END IF;
END $$;


-- PARTITION CREATION BLOCK FOR MEASUREMENTS
-- Same as above, but for the measurements table.
-- Ensures each year has its own dedicated partition.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'measurements_{year}' AND n.nspname = 'public'
    ) THEN
        EXECUTE 'CREATE TABLE measurements_{year} 
                 PARTITION OF measurements 
                 FOR VALUES IN ({year});';
    END IF;
END $$;
