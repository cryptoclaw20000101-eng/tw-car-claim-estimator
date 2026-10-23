-- No account, IP, URL, diagnosis, money, or contact fields.
CREATE TABLE IF NOT EXISTS public.journey_events (
  session_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('visit', 'form_started', 'step_viewed', 'step_completed', 'validation_failed', 'estimate_completed', 'repair_started', 'repair_completed')),
  step text NOT NULL DEFAULT '' CHECK (step IN ('', 'basics', 'fault', 'person', 'diagnosis', 'expenses', 'repair')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, event, step)
);
CREATE INDEX IF NOT EXISTS journey_events_created_at_idx ON public.journey_events(created_at);
