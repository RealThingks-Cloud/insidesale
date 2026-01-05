-- Create system_updates table for tracking Windows/system updates
CREATE TABLE public.system_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_name TEXT NOT NULL,
  os_version TEXT,
  update_version TEXT,
  patch_id TEXT,
  update_type TEXT DEFAULT 'Security',
  status TEXT DEFAULT 'Pending',
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  installed_on TIMESTAMP WITH TIME ZONE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance table for maintenance scheduling
CREATE TABLE public.maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  maintenance_type TEXT DEFAULT 'Preventive',
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  performed_by TEXT,
  status TEXT DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_updates (authenticated users can access)
CREATE POLICY "Authenticated users can view system_updates" 
ON public.system_updates FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert system_updates" 
ON public.system_updates FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update system_updates" 
ON public.system_updates FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete system_updates" 
ON public.system_updates FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for maintenance
CREATE POLICY "Authenticated users can view maintenance" 
ON public.maintenance FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert maintenance" 
ON public.maintenance FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update maintenance" 
ON public.maintenance FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete maintenance" 
ON public.maintenance FOR DELETE 
TO authenticated
USING (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_system_updates_updated_at
BEFORE UPDATE ON public.system_updates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at
BEFORE UPDATE ON public.maintenance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();