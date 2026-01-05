-- Create session templates table for recurring schedules
CREATE TABLE public.session_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  museum_id UUID NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_time TIME WITHOUT TIME ZONE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage session templates"
ON public.session_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active session templates"
ON public.session_templates
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_session_templates_updated_at
BEFORE UPDATE ON public.session_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_template_generated column to sessions to track which are auto-generated
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.session_templates(id) ON DELETE SET NULL;