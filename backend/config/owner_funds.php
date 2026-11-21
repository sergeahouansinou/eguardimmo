<?php

declare(strict_types=1);

return [
    'batch_max' => (int) env('OWNER_FUNDS_BATCH_MAX', 50),
    'preview_limit' => (int) env('OWNER_FUNDS_PREVIEW_LIMIT', 20),
    'payout_minimum_minor' => (int) env('OWNER_FUNDS_PAYOUT_MINIMUM_MINOR', 0),
    'require_second_approver' => filter_var(env('OWNER_FUNDS_REQUIRE_SECOND_APPROVER', true), FILTER_VALIDATE_BOOL),
    'account_cooling_days' => (int) env('OWNER_FUNDS_ACCOUNT_COOLING_DAYS', 2),
    'pending_warning_days' => (int) env('OWNER_FUNDS_PENDING_WARNING_DAYS', 10),
    'payout_request_days' => (int) env('OWNER_PAYOUT_REQUEST_DAYS', 14),
    'payout_code_minutes' => (int) env('OWNER_FUNDS_PAYOUT_CODE_MINUTES', 15),
    'payout_code_attempts' => (int) env('OWNER_FUNDS_PAYOUT_CODE_ATTEMPTS', 3),
    'payout_proof_retention_years' => (int) env('OWNER_FUNDS_PAYOUT_PROOF_RETENTION_YEARS', 10),
];
