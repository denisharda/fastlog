-- Add upper bound for target_hours (max 72h per project spec)
ALTER TABLE fasting_sessions ADD CONSTRAINT target_hours_max CHECK (target_hours <= 72);

-- Add positive constraint for hydration amount (idempotent — may already exist from 002)
DO $$
BEGIN
  ALTER TABLE hydration_logs ADD CONSTRAINT amount_ml_positive CHECK (amount_ml > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
