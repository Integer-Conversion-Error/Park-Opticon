-- Fix the check_schedule_type constraint to include all schedule types
ALTER TABLE enforcement_schedules DROP CONSTRAINT IF EXISTS check_schedule_type;

ALTER TABLE enforcement_schedules ADD CONSTRAINT check_schedule_type 
CHECK (schedule_type IN ('enforced', 'enforced_unpaid', 'no_parking', 'no_stopping', 'free', 'unenforced'));
