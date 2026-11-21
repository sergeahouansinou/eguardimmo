<?php

declare(strict_types=1);

return [
    'approval_deadline_hours' => (int) env('MAINTENANCE_APPROVAL_DEADLINE_HOURS', 48),
    'invoice_tax_tolerance_minor' => (int) env('MAINTENANCE_INVOICE_TAX_TOLERANCE_MINOR', 5),
    'emergency_ceiling_minor' => (int) env('MAINTENANCE_EMERGENCY_CEILING_MINOR', 200000),
    'max_open_per_lease' => (int) env('MAINTENANCE_MAX_OPEN_PER_LEASE', 10),
    'files_per_intervention' => (int) env('MAINTENANCE_FILES_PER_INTERVENTION', 30),
    'photos_per_report' => (int) env('MAINTENANCE_PHOTOS_PER_REPORT', 6),
    'tenant_media_retention_years' => (int) env('MAINTENANCE_TENANT_MEDIA_RETENTION_YEARS', 5),
    'third_party_second_approval_minor' => (int) env('MAINTENANCE_THIRD_PARTY_SECOND_APPROVAL_MINOR', 100000),
    'owner_decision_statement_version' => (string) env('MAINTENANCE_OWNER_DECISION_STATEMENT_VERSION', 'v1'),
    'accounting_retention_years' => (int) env('MAINTENANCE_ACCOUNTING_RETENTION_YEARS', 10),
];
