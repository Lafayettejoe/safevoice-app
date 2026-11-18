CREATE INDEX IF NOT EXISTS report_incident_types_gin
ON "Report"
USING GIN ("incidentTypes");