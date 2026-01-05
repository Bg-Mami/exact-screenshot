-- Add credits column to ticket_types (default 1 for regular tickets)
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 1;

-- Add is_combo flag to ticket_types
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS is_combo boolean NOT NULL DEFAULT false;

-- Create combo_ticket_museums table - defines which museums a combo ticket type covers
CREATE TABLE IF NOT EXISTS public.combo_ticket_museums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
    museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
    credits integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(ticket_type_id, museum_id)
);

-- Enable RLS on combo_ticket_museums
ALTER TABLE public.combo_ticket_museums ENABLE ROW LEVEL SECURITY;

-- RLS policies for combo_ticket_museums
CREATE POLICY "Admins can manage combo ticket museums" 
ON public.combo_ticket_museums 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view combo ticket museums" 
ON public.combo_ticket_museums 
FOR SELECT 
USING (true);

-- Add remaining_credits to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS remaining_credits integer NOT NULL DEFAULT 1;

-- Create ticket_usage table to track usage per museum (for combo tickets)
CREATE TABLE IF NOT EXISTS public.ticket_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    museum_id uuid NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
    used_credits integer NOT NULL DEFAULT 1,
    used_at timestamp with time zone NOT NULL DEFAULT now(),
    used_by uuid REFERENCES auth.users(id),
    UNIQUE(ticket_id, museum_id, used_at)
);

-- Enable RLS on ticket_usage
ALTER TABLE public.ticket_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_usage
CREATE POLICY "Users with sell_tickets can manage ticket usage" 
ON public.ticket_usage 
FOR ALL 
USING (has_permission(auth.uid(), 'sell_tickets'::app_permission));

CREATE POLICY "Users with view_reports can view ticket usage" 
ON public.ticket_usage 
FOR SELECT 
USING (has_permission(auth.uid(), 'view_reports'::app_permission));

-- Add delete policy for tickets (only admins with delete_tickets permission)
CREATE POLICY "Admins can delete tickets" 
ON public.tickets 
FOR DELETE 
USING (has_permission(auth.uid(), 'delete_tickets'::app_permission));