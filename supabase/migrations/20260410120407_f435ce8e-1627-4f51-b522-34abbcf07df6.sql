
-- ============================================================
-- PART 0: Core utility functions (must exist before any triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- PART 1: User roles & profiles
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = p_user_id; $$;

CREATE OR REPLACE FUNCTION public.is_user_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT get_user_role(p_user_id) = 'admin'; $$;

CREATE OR REPLACE FUNCTION public.is_user_manager(p_user_id UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT get_user_role(p_user_id) = 'manager'; $$;

CREATE POLICY "Anyone can view roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (is_user_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (is_user_admin());

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  "Email ID" TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_user_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, "Email ID")
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 2: Security audit log
-- ============================================================

CREATE TABLE public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view audit logs" ON public.security_audit_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit logs" ON public.security_audit_log FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_security_event(p_action TEXT, p_resource_type TEXT, p_resource_id TEXT DEFAULT NULL, p_details JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, resource_type, resource_id, details, ip_address)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_details, inet_client_addr());
END;
$$;

CREATE OR REPLACE FUNCTION public.log_data_access(p_table_name TEXT, p_operation TEXT, p_record_id TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_audit_log (user_id, action, resource_type, resource_id, details, ip_address)
  VALUES (auth.uid(), p_operation, p_table_name, p_record_id,
    jsonb_build_object('timestamp', now()), inet_client_addr());
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- ============================================================
-- PART 3: Accounts
-- ============================================================

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  region TEXT,
  country TEXT,
  website TEXT,
  company_type TEXT,
  tags TEXT[],
  status TEXT DEFAULT 'New',
  notes TEXT,
  email TEXT,
  account_owner UUID,
  industry TEXT,
  phone TEXT,
  score INTEGER DEFAULT 0,
  segment TEXT DEFAULT 'prospect',
  total_revenue NUMERIC DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  contact_count INTEGER DEFAULT 0,
  last_activity_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  modified_by UUID
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_accounts_company_name ON public.accounts(company_name);
CREATE INDEX idx_accounts_account_owner ON public.accounts(account_owner);
CREATE INDEX idx_accounts_status ON public.accounts(status);

CREATE POLICY "Authenticated users can view all accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Users can insert accounts" ON public.accounts FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update accounts" ON public.accounts FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR account_owner = auth.uid());
CREATE POLICY "Users can delete accounts" ON public.accounts FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 4: Leads
-- ============================================================

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone_no TEXT,
  mobile_no TEXT,
  position TEXT,
  city TEXT,
  country TEXT,
  industry TEXT,
  no_of_employees INTEGER,
  website TEXT,
  linkedin TEXT,
  contact_source TEXT,
  lead_status TEXT DEFAULT 'New',
  interest TEXT,
  description TEXT,
  contact_owner UUID,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_by UUID,
  modified_by UUID,
  modified_time TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_account_id ON public.leads(account_id);

CREATE POLICY "Authenticated users can view all leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Users can insert leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update leads" ON public.leads FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR contact_owner = auth.uid());
CREATE POLICY "Users can delete leads" ON public.leads FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

-- ============================================================
-- PART 5: Contacts
-- ============================================================

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone_no TEXT,
  mobile_no TEXT,
  position TEXT,
  city TEXT,
  country TEXT,
  industry TEXT,
  website TEXT,
  linkedin TEXT,
  contact_source TEXT,
  description TEXT,
  contact_owner UUID,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  tags TEXT[],
  last_activity_time TIMESTAMPTZ,
  modified_by UUID,
  modified_time TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_time TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contacts_account_id ON public.contacts(account_id);

CREATE POLICY "Authenticated users can view all contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Users can insert contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update contacts" ON public.contacts FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR contact_owner = auth.uid());
CREATE POLICY "Users can delete contacts" ON public.contacts FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

-- ============================================================
-- PART 6: Deals
-- ============================================================

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_name TEXT,
  stage TEXT NOT NULL DEFAULT 'Lead',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  modified_by UUID,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_name TEXT,
  customer_name TEXT,
  lead_name TEXT,
  lead_owner TEXT,
  region TEXT,
  priority INTEGER,
  probability INTEGER,
  internal_comment TEXT,
  expected_closing_date DATE,
  customer_need TEXT,
  customer_challenges TEXT,
  relationship_strength TEXT,
  budget TEXT,
  business_value TEXT,
  decision_maker_level TEXT,
  is_recurring TEXT,
  total_contract_value NUMERIC,
  currency_type TEXT DEFAULT 'EUR',
  start_date DATE,
  end_date DATE,
  project_duration INTEGER,
  action_items TEXT,
  rfq_received_date DATE,
  proposal_due_date DATE,
  rfq_status TEXT,
  current_status TEXT,
  closing TEXT,
  won_reason TEXT,
  quarterly_revenue_q1 NUMERIC,
  quarterly_revenue_q2 NUMERIC,
  quarterly_revenue_q3 NUMERIC,
  quarterly_revenue_q4 NUMERIC,
  total_revenue NUMERIC,
  signed_contract_date DATE,
  implementation_start_date DATE,
  handoff_status TEXT,
  lost_reason TEXT,
  need_improvement TEXT,
  drop_reason TEXT,
  fax TEXT,
  phone_no TEXT,
  company_name TEXT,
  closing_notes TEXT,
  rfq_comment TEXT,
  offered_comment TEXT,
  final_status TEXT,
  final_comment TEXT,
  contact_person TEXT,
  challenges TEXT,
  discussions_comment TEXT,
  budget_status TEXT,
  qualified_comment TEXT,
  monthly_revenue NUMERIC,
  duration_months INTEGER,
  revenue_q1 NUMERIC,
  revenue_q2 NUMERIC,
  revenue_q3 NUMERIC,
  revenue_q4 NUMERIC
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Users can insert deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update deals" ON public.deals FOR UPDATE USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Users can delete deals" ON public.deals FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

CREATE TRIGGER update_deals_modified_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_modified_at_column();

-- ============================================================
-- PART 7: Meetings
-- ============================================================

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  join_url TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled',
  outcome TEXT,
  notes TEXT
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meetings_lead_id ON public.meetings(lead_id);
CREATE INDEX idx_meetings_contact_id ON public.meetings(contact_id);
CREATE INDEX idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX idx_meetings_created_by ON public.meetings(created_by);

CREATE POLICY "Authenticated users can view all meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Users can insert meetings" ON public.meetings FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update meetings" ON public.meetings FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid());
CREATE POLICY "Users can delete meetings" ON public.meetings FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 8: Tasks
-- ============================================================

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  due_date DATE,
  due_time TIME,
  reminder_date TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  module_type TEXT,
  recurrence TEXT DEFAULT 'none',
  recurrence_end_date DATE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  tags TEXT[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX idx_tasks_contact_id ON public.tasks(contact_id);
CREATE INDEX idx_tasks_deal_id ON public.tasks(deal_id);
CREATE INDEX idx_tasks_account_id ON public.tasks(account_id);

CREATE POLICY "Authenticated users can view all tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Users can insert tasks" ON public.tasks FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY "Users can delete tasks" ON public.tasks FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View subtasks" ON public.task_subtasks FOR SELECT USING (true);
CREATE POLICY "Insert subtasks" ON public.task_subtasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Update subtasks" ON public.task_subtasks FOR UPDATE USING (true);
CREATE POLICY "Delete subtasks" ON public.task_subtasks FOR DELETE USING (true);
CREATE TRIGGER update_task_subtasks_updated_at BEFORE UPDATE ON public.task_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 9: Notifications
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID,
  message TEXT NOT NULL,
  title TEXT,
  type TEXT DEFAULT 'info',
  module_type TEXT,
  module_id TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  notification_type TEXT NOT NULL DEFAULT 'action_item',
  action_item_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================
-- PART 10: Email history & replies
-- ============================================================

CREATE TABLE public.email_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  sender_email TEXT,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  is_valid_open BOOLEAN DEFAULT true,
  first_open_ip TEXT,
  click_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  contact_id UUID,
  lead_id UUID,
  account_id UUID,
  bounce_type TEXT,
  bounce_reason TEXT,
  bounced_at TIMESTAMPTZ,
  reply_count INTEGER DEFAULT 0,
  replied_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  message_id TEXT,
  thread_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_email_history_sent_by ON public.email_history(sent_by);
CREATE INDEX idx_email_history_bounce_type ON public.email_history(bounce_type) WHERE bounce_type IS NOT NULL;

CREATE POLICY "Users can view own emails" ON public.email_history FOR SELECT USING (sent_by = auth.uid() OR is_user_admin() OR is_user_manager());
CREATE POLICY "Users can insert emails" ON public.email_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update emails" ON public.email_history FOR UPDATE USING (sent_by = auth.uid() OR is_user_admin() OR is_user_manager());

CREATE TABLE public.email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_history_id UUID REFERENCES public.email_history(id) ON DELETE CASCADE,
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View replies" ON public.email_replies FOR SELECT USING (true);
CREATE POLICY "Insert replies" ON public.email_replies FOR INSERT WITH CHECK (true);

CREATE TABLE public.pending_bounce_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_history_id UUID REFERENCES public.email_history(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  check_after TIMESTAMPTZ NOT NULL,
  checked BOOLEAN DEFAULT false,
  check_result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pending_bounce_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pending_checks_ready ON public.pending_bounce_checks(check_after, checked) WHERE checked = false;
CREATE POLICY "Full access to pending_bounce_checks" ON public.pending_bounce_checks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View templates" ON public.email_templates FOR SELECT USING (true);
CREATE POLICY "Insert templates" ON public.email_templates FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update templates" ON public.email_templates FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid());
CREATE POLICY "Delete templates" ON public.email_templates FOR DELETE USING (is_user_admin() OR created_by = auth.uid());
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 11: Activity tables
-- ============================================================

CREATE TABLE public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  outcome TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE POLICY "View contact activities" ON public.contact_activities FOR SELECT USING (true);
CREATE POLICY "Insert contact activities" ON public.contact_activities FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update contact activities" ON public.contact_activities FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid());
CREATE POLICY "Delete contact activities" ON public.contact_activities FOR DELETE USING (is_user_admin() OR created_by = auth.uid());
CREATE TRIGGER update_contact_activities_updated_at BEFORE UPDATE ON public.contact_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.account_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  outcome TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_account_activities_account_id ON public.account_activities(account_id);
CREATE POLICY "View account activities" ON public.account_activities FOR SELECT USING (true);
CREATE POLICY "Insert account activities" ON public.account_activities FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update account activities" ON public.account_activities FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid());
CREATE POLICY "Delete account activities" ON public.account_activities FOR DELETE USING (is_user_admin() OR created_by = auth.uid());
CREATE TRIGGER update_account_activities_updated_at BEFORE UPDATE ON public.account_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 12: Action items
-- ============================================================

CREATE TABLE public.lead_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  next_action TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View lead action items" ON public.lead_action_items FOR SELECT USING (true);
CREATE POLICY "Insert lead action items" ON public.lead_action_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update lead action items" ON public.lead_action_items FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY "Delete lead action items" ON public.lead_action_items FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

CREATE TABLE public.deal_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  next_action TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View deal action items" ON public.deal_action_items FOR SELECT USING (true);
CREATE POLICY "Insert deal action items" ON public.deal_action_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update deal action items" ON public.deal_action_items FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY "Delete deal action items" ON public.deal_action_items FOR DELETE USING (is_user_admin() OR created_by = auth.uid());

-- ============================================================
-- PART 13: Deal stage history
-- ============================================================

CREATE TABLE public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  notes TEXT
);
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deal_stage_history_deal_id ON public.deal_stage_history(deal_id);
CREATE POLICY "View stage history" ON public.deal_stage_history FOR SELECT USING (true);
CREATE POLICY "Insert stage history" ON public.deal_stage_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, NULL, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_deal_stage_change
  AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();

-- ============================================================
-- PART 14: Meeting follow-ups & reminders
-- ============================================================

CREATE TABLE public.meeting_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View follow-ups" ON public.meeting_follow_ups FOR SELECT USING (true);
CREATE POLICY "Insert follow-ups" ON public.meeting_follow_ups FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update follow-ups" ON public.meeting_follow_ups FOR UPDATE USING (is_user_admin() OR is_user_manager() OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY "Delete follow-ups" ON public.meeting_follow_ups FOR DELETE USING (is_user_admin() OR created_by = auth.uid());
CREATE TRIGGER update_meeting_follow_ups_updated_at BEFORE UPDATE ON public.meeting_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meeting_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  remind_15min BOOLEAN NOT NULL DEFAULT true,
  remind_1hr BOOLEAN NOT NULL DEFAULT true,
  remind_1day BOOLEAN NOT NULL DEFAULT false,
  sent_15min BOOLEAN NOT NULL DEFAULT false,
  sent_1hr BOOLEAN NOT NULL DEFAULT false,
  sent_1day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id)
);
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View reminders" ON public.meeting_reminders FOR SELECT USING (true);
CREATE POLICY "Insert reminders" ON public.meeting_reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Update reminders" ON public.meeting_reminders FOR UPDATE USING (true);
CREATE POLICY "Delete reminders" ON public.meeting_reminders FOR DELETE USING (true);
CREATE TRIGGER update_meeting_reminders_updated_at BEFORE UPDATE ON public.meeting_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 15: User preferences & settings
-- ============================================================

CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  theme TEXT DEFAULT 'auto',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  time_format TEXT DEFAULT '12h',
  currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  language TEXT DEFAULT 'en',
  default_module TEXT DEFAULT 'dashboard',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own prefs" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own prefs" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own prefs" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  lead_assigned BOOLEAN DEFAULT true,
  deal_updates BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  meeting_reminders BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own notif prefs" ON public.notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Insert own notif prefs" ON public.notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own notif prefs" ON public.notification_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_type TEXT NOT NULL DEFAULT 'deals',
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own filters" ON public.saved_filters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own filters" ON public.saved_filters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own filters" ON public.saved_filters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own filters" ON public.saved_filters FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.table_column_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  column_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_name)
);
ALTER TABLE public.table_column_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own col prefs" ON public.table_column_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Insert own col prefs" ON public.table_column_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own col prefs" ON public.table_column_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Delete own col prefs" ON public.table_column_preferences FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER update_table_column_preferences_updated_at BEFORE UPDATE ON public.table_column_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own sessions" ON public.user_sessions FOR SELECT USING (user_id = auth.uid() OR is_user_admin());
CREATE POLICY "Insert own sessions" ON public.user_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own sessions" ON public.user_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Delete own sessions" ON public.user_sessions FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- PART 16: Admin/config tables
-- ============================================================

CREATE TABLE public.page_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  description TEXT,
  route TEXT NOT NULL UNIQUE,
  admin_access BOOLEAN NOT NULL DEFAULT true,
  manager_access BOOLEAN NOT NULL DEFAULT false,
  user_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View page permissions" ON public.page_permissions FOR SELECT USING (true);
CREATE POLICY "Admins manage page permissions" ON public.page_permissions FOR ALL USING (is_user_admin());
CREATE TRIGGER update_page_permissions_updated_at BEFORE UPDATE ON public.page_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.page_permissions (page_name, description, route, admin_access, manager_access, user_access) VALUES
('Dashboard', 'Main dashboard', '/dashboard', true, true, true),
('Leads', 'Manage leads', '/leads', true, true, true),
('Deals', 'Manage deals', '/deals', true, true, true),
('Contacts', 'Manage contacts', '/contacts', true, true, true),
('Accounts', 'Manage accounts', '/accounts', true, true, true),
('Settings', 'Admin settings', '/settings', true, false, false),
('Notifications', 'View notifications', '/notifications', true, true, true);

CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 0,
  stage_color TEXT DEFAULT '#3b82f6',
  stage_probability INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_won_stage BOOLEAN DEFAULT false,
  is_lost_stage BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View pipeline stages" ON public.pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Admins manage stages" ON public.pipeline_stages FOR ALL USING (is_user_admin());
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pipeline_stages (stage_name, stage_order, stage_color, stage_probability, is_won_stage, is_lost_stage) VALUES
('Lead', 0, '#6b7280', 10, false, false),
('Qualified', 1, '#3b82f6', 25, false, false),
('RFQ', 2, '#8b5cf6', 40, false, false),
('Offered', 3, '#f59e0b', 60, false, false),
('Discussions', 4, '#10b981', 80, false, false),
('Won', 5, '#22c55e', 100, true, false),
('Lost', 6, '#ef4444', 0, false, true),
('Dropped', 7, '#94a3b8', 0, false, true);

CREATE TABLE public.lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_name TEXT NOT NULL UNIQUE,
  status_color TEXT DEFAULT '#6b7280',
  status_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_converted_status BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View lead statuses" ON public.lead_statuses FOR SELECT USING (true);
CREATE POLICY "Admins manage statuses" ON public.lead_statuses FOR ALL USING (is_user_admin());
CREATE TRIGGER update_lead_statuses_updated_at BEFORE UPDATE ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lead_statuses (status_name, status_color, status_order, is_converted_status) VALUES
('New', '#3b82f6', 0, false),
('Contacted', '#8b5cf6', 1, false),
('Qualified', '#10b981', 2, false),
('Unqualified', '#ef4444', 3, false),
('Converted', '#22c55e', 4, true);

CREATE TABLE public.yearly_revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  total_target NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year)
);
ALTER TABLE public.yearly_revenue_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View targets" ON public.yearly_revenue_targets FOR SELECT USING (true);
CREATE POLICY "Insert targets" ON public.yearly_revenue_targets FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update targets" ON public.yearly_revenue_targets FOR UPDATE USING (true);
CREATE POLICY "Delete targets" ON public.yearly_revenue_targets FOR DELETE USING (true);

-- ============================================================
-- PART 17: Backups & scheduled reports
-- ============================================================

CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes BIGINT,
  tables_count INTEGER,
  records_count INTEGER,
  backup_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'completed',
  manifest JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage backups" ON public.backups FOR ALL USING (is_user_admin());

CREATE TABLE public.backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'daily',
  day_of_week INTEGER,
  time_of_day TIME NOT NULL DEFAULT '00:00',
  retention_days INTEGER DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage backup schedules" ON public.backup_schedules FOR ALL USING (is_user_admin());

CREATE TABLE public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_of_day TIME NOT NULL DEFAULT '08:00',
  recipients JSONB DEFAULT '[]'::jsonb,
  filters JSONB,
  is_enabled BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage report schedules" ON public.report_schedules FOR ALL USING (is_user_admin());
CREATE POLICY "View report schedules" ON public.report_schedules FOR SELECT USING (true);

-- ============================================================
-- PART 18: Announcements
-- ============================================================

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  priority TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  target_roles TEXT[] DEFAULT ARRAY['user', 'manager', 'admin'],
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (is_user_admin());
CREATE POLICY "View active announcements" ON public.announcements FOR SELECT USING (
  is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (expires_at IS NULL OR expires_at > now())
);

CREATE TABLE public.announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dismissals" ON public.announcement_dismissals FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- PART 19: Approvals
-- ============================================================

CREATE TABLE public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  trigger_conditions JSONB,
  approval_steps JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage workflows" ON public.approval_workflows FOR ALL USING (is_user_admin());
CREATE POLICY "View workflows" ON public.approval_workflows FOR SELECT USING (true);

CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.approval_workflows(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  submitted_by UUID,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View approval requests" ON public.approval_requests FOR SELECT USING (true);
CREATE POLICY "Insert approval requests" ON public.approval_requests FOR INSERT WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Update approval requests" ON public.approval_requests FOR UPDATE USING (is_user_admin() OR submitted_by = auth.uid());

CREATE TABLE public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_id UUID NOT NULL,
  action TEXT NOT NULL,
  comments TEXT,
  acted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View approval actions" ON public.approval_actions FOR SELECT USING (true);
CREATE POLICY "Insert approval actions" ON public.approval_actions FOR INSERT WITH CHECK (approver_id = auth.uid());

-- ============================================================
-- PART 20: Branding & misc
-- ============================================================

CREATE TABLE public.branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT DEFAULT 'CRM',
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#0284c7',
  secondary_color TEXT DEFAULT '#334155',
  accent_color TEXT DEFAULT '#f8fafc',
  font_family TEXT DEFAULT 'Inter',
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage branding" ON public.branding_settings FOR ALL USING (is_user_admin());
CREATE POLICY "View branding" ON public.branding_settings FOR SELECT USING (true);
INSERT INTO public.branding_settings (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.crm_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB,
  is_required BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, field_name)
);
ALTER TABLE public.crm_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View custom fields" ON public.crm_custom_fields FOR SELECT USING (true);
CREATE POLICY "Admins manage custom fields" ON public.crm_custom_fields FOR ALL USING (is_user_admin());

CREATE TABLE public.import_export_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  field_mappings JSONB,
  default_values JSONB,
  skip_duplicates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type)
);
ALTER TABLE public.import_export_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own import settings" ON public.import_export_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Manage own import settings" ON public.import_export_settings FOR ALL USING (user_id = auth.uid());

CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View integrations" ON public.integration_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage integrations" ON public.integration_settings FOR ALL USING (is_user_admin());

INSERT INTO public.integration_settings (integration_name, is_enabled, config) VALUES
('Microsoft Teams', false, '{"client_id": null, "tenant_id": null}'),
('Email (SMTP)', false, '{"host": null, "port": 587, "secure": false}'),
('Calendar Sync', false, '{"provider": null}');

CREATE TABLE public.system_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name TEXT NOT NULL,
  os_version TEXT,
  update_version TEXT,
  patch_id TEXT,
  update_type TEXT DEFAULT 'Security',
  status TEXT DEFAULT 'Pending',
  last_checked TIMESTAMPTZ DEFAULT now(),
  installed_on TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage system_updates" ON public.system_updates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name TEXT NOT NULL,
  maintenance_type TEXT DEFAULT 'Preventive',
  scheduled_date TIMESTAMPTZ NOT NULL,
  performed_by TEXT,
  status TEXT DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage maintenance" ON public.maintenance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.keep_alive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View keep_alive" ON public.keep_alive FOR SELECT USING (true);
CREATE POLICY "Insert keep_alive" ON public.keep_alive FOR INSERT WITH CHECK (true);

-- Account stats helper functions
CREATE OR REPLACE FUNCTION public.update_account_stats(p_account_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.accounts SET
    contact_count = (SELECT COUNT(*) FROM public.contacts WHERE account_id = p_account_id),
    last_activity_date = (SELECT MAX(activity_date) FROM public.account_activities WHERE account_id = p_account_id)
  WHERE id = p_account_id;
END;
$$;

-- Enable realtime for key tables
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Storage bucket for backups
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Admins upload backups" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'backups' AND is_user_admin());
CREATE POLICY "Admins view backups" ON storage.objects FOR SELECT USING (bucket_id = 'backups' AND is_user_admin());
CREATE POLICY "Admins delete backups" ON storage.objects FOR DELETE USING (bucket_id = 'backups' AND is_user_admin());
