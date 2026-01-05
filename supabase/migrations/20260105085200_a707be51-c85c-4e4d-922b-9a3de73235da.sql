-- Add delete_tickets permission to enum
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'delete_tickets';