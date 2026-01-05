-- Create museum_ticket_prices table for museum-specific pricing
CREATE TABLE public.museum_ticket_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  museum_id UUID NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(museum_id, ticket_type_id)
);

-- Enable RLS
ALTER TABLE public.museum_ticket_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage museum prices"
ON public.museum_ticket_prices
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active museum prices"
ON public.museum_ticket_prices
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_museum_ticket_prices_updated_at
BEFORE UPDATE ON public.museum_ticket_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();