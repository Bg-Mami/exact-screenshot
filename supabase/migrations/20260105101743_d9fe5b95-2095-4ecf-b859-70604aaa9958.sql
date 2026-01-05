-- Create museum_groups table
CREATE TABLE public.museum_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create museum_group_members table (links museums to groups)
CREATE TABLE public.museum_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.museum_groups(id) ON DELETE CASCADE,
  museum_id UUID NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, museum_id)
);

-- Create user_museum_groups table (links users/booths to groups)
CREATE TABLE public.user_museum_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.museum_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Enable RLS
ALTER TABLE public.museum_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.museum_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_museum_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for museum_groups
CREATE POLICY "Admins can manage museum groups"
ON public.museum_groups
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active museum groups"
ON public.museum_groups
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

-- RLS Policies for museum_group_members
CREATE POLICY "Admins can manage museum group members"
ON public.museum_group_members
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view museum group members"
ON public.museum_group_members
FOR SELECT
USING (true);

-- RLS Policies for user_museum_groups
CREATE POLICY "Admins can manage user museum groups"
ON public.user_museum_groups
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own museum groups"
ON public.user_museum_groups
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_museum_groups_updated_at
BEFORE UPDATE ON public.museum_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();