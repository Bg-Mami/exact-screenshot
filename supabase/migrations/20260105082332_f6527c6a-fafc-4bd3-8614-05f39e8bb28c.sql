-- Aylık rotasyon tablosu
CREATE TABLE public.staff_rotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  museum_id UUID NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,
  rotation_month DATE NOT NULL, -- Ay başlangıç tarihi (2025-01-01 gibi)
  rotation_order INTEGER NOT NULL DEFAULT 0, -- Sıralama için
  is_manual_override BOOLEAN DEFAULT false, -- Admin tarafından manuel değiştirildi mi
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, rotation_month) -- Her kullanıcı için ayda tek kayıt
);

-- RLS aktif et
ALTER TABLE public.staff_rotations ENABLE ROW LEVEL SECURITY;

-- Adminler yönetebilir
CREATE POLICY "Admins can manage staff rotations"
ON public.staff_rotations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Herkes görüntüleyebilir
CREATE POLICY "Anyone can view staff rotations"
ON public.staff_rotations
FOR SELECT
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_staff_rotations_updated_at
BEFORE UPDATE ON public.staff_rotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();