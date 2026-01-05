-- Create user_museums table for direct multiple museum assignments
CREATE TABLE public.user_museums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  museum_id UUID NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, museum_id)
);

-- Enable RLS
ALTER TABLE public.user_museums ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage user museums"
ON public.user_museums
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own assignments
CREATE POLICY "Users can view their museum assignments"
ON public.user_museums
FOR SELECT
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));