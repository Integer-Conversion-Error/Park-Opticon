-- Supports the authenticated community-impact summary without scanning all
-- historical reports or notifications for each profile visit.

CREATE INDEX IF NOT EXISTS idx_parking_spots_reporter_id
    ON parking_spots (reporter_id);

CREATE INDEX IF NOT EXISTS idx_notifications_enforcement_related_recipient
    ON notifications (related_id, user_id)
    WHERE notification_type = 'enforcement_alert'
      AND related_type = 'enforcement_alert';
