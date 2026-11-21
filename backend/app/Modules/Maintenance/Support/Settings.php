<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

final class Settings
{
    public static function approvalDeadlineHours(): int
    {
        $heures = config('maintenance.approval_deadline_hours');

        return min(168, max(24, is_int($heures) ? $heures : 48));
    }

    public static function ownerStatementVersion(): string
    {
        $version = config('maintenance.owner_decision_statement_version');

        return is_string($version) && $version !== '' ? $version : 'v1';
    }

    public static function taxToleranceMinor(): int
    {
        $tolerance = config('maintenance.invoice_tax_tolerance_minor');

        return max(0, is_int($tolerance) ? $tolerance : 5);
    }

    public static function emergencyCeilingMinor(): int
    {
        $plafond = config('maintenance.emergency_ceiling_minor');

        return max(0, is_int($plafond) ? $plafond : 200000);
    }

    public static function maxOpenPerLease(): int
    {
        $max = config('maintenance.max_open_per_lease');

        return max(1, is_int($max) ? $max : 10);
    }

    public static function filesPerIntervention(): int
    {
        $max = config('maintenance.files_per_intervention');

        return max(1, is_int($max) ? $max : 30);
    }

    public static function photosPerReport(): int
    {
        $max = config('maintenance.photos_per_report');

        return max(1, is_int($max) ? $max : 6);
    }

    public static function tenantMediaRetentionYears(): int
    {
        $annees = config('maintenance.tenant_media_retention_years');

        return max(1, is_int($annees) ? $annees : 5);
    }

    public static function accountingRetentionYears(): int
    {
        $annees = config('maintenance.accounting_retention_years');

        return max(10, is_int($annees) ? $annees : 10);
    }
}
