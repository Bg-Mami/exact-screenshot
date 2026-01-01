-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

-- Enum for permissions
CREATE TYPE public.app_permission AS ENUM (
  'sell_tickets',
  'view_reports',
  'manage_staff',
  'manage_museums',
  'manage_sessions',
  'manage_ticket_types',
  'manage_settings'
);

-- Museums table
CREATE TABLE public.museums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ticket types table (admin can set prices)
CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type_key TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'Ticket',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sessions table (for timed entry)
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id UUID REFERENCES public.museums(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 50,
  sold_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_capacity CHECK (capacity > 0),
  CONSTRAINT valid_sold_count CHECK (sold_count >= 0 AND sold_count <= capacity)
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  assigned_museum_id UUID REFERENCES public.museums(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- User permissions table
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission app_permission NOT NULL,
  UNIQUE (user_id, permission)
);

-- Tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID REFERENCES public.ticket_types(id) NOT NULL,
  museum_id UUID REFERENCES public.museums(id) NOT NULL,
  session_id UUID REFERENCES public.sessions(id),
  qr_code TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  sold_by UUID REFERENCES auth.users(id) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.museums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  ) OR public.has_role(_user_id, 'admin')
$$;

-- RLS Policies for museums
CREATE POLICY "Anyone can view active museums" ON public.museums
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage museums" ON public.museums
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ticket_types
CREATE POLICY "Anyone can view active ticket types" ON public.ticket_types
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ticket types" ON public.ticket_types
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sessions
CREATE POLICY "Users can view sessions" ON public.sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sessions" ON public.sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_permissions
CREATE POLICY "Users can view permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions" ON public.user_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tickets
CREATE POLICY "Users with permission can view tickets" ON public.tickets
  FOR SELECT TO authenticated USING (
    public.has_permission(auth.uid(), 'sell_tickets') OR 
    public.has_permission(auth.uid(), 'view_reports')
  );

CREATE POLICY "Users with permission can create tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (
    public.has_permission(auth.uid(), 'sell_tickets')
  );

CREATE POLICY "Users with permission can update tickets" ON public.tickets
  FOR UPDATE TO authenticated USING (
    public.has_permission(auth.uid(), 'sell_tickets')
  );

-- Function to update session sold count
CREATE OR REPLACE FUNCTION public.increment_session_sold_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE public.sessions
    SET sold_count = sold_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to increment sold count
CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_session_sold_count();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_museums_updated_at
  BEFORE UPDATE ON public.museums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_types_updated_at
  BEFORE UPDATE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default ticket types
INSERT INTO public.ticket_types (name, type_key, price, color, icon) VALUES
  ('Tam Bilet', 'full', 150.00, '#3b82f6', 'Ticket'),
  ('Öğrenci', 'student', 75.00, '#22c55e', 'GraduationCap'),
  ('Grup (10+ kişi)', 'group', 100.00, '#a855f7', 'Users'),
  ('Engelli', 'disabled', 0.00, '#f97316', 'Heart'),
  ('Ücretsiz', 'free', 0.00, '#6b7280', 'Gift');