<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;

/**
 * Colonnes lues en SQL par Reporting dans les tables des autres modules (`Support/Reading`) : un renommage casse ce test, pas un écran.
 *
 * @return array<string, list<string>>
 */
function colonnesLues(): array
{
    return [
        'payout_holds' => ['released_at'],
        'payout_items' => ['status'],
        'mandates' => ['id', 'reference', 'status', 'ends_on'],
        'certificates' => ['id', 'replaces_id', 'expires_on'],
        'leases' => ['id', 'status', 'starts_on', 'ends_on'],
        'lease_units' => ['lease_id', 'unit_id', 'valid_from', 'valid_to'],
        'units' => ['id', 'archived_at'],
        'properties' => ['id', 'name'],
        'interventions' => ['id', 'reference', 'status'],
        'invoice_allocations' => ['id', 'intervention_id'],
        'recovery_cases' => ['lease_id', 'status'],
        'rent_receipts' => ['number', 'lease_id', 'issued_on', 'voided_at'],
    ];
}

it('chaque table lue par Reporting existe avec ses colonnes et son organization_id', function (string $table, array $colonnes): void {
    expect(Schema::hasTable($table))->toBeTrue("table {$table}")
        ->and(Schema::hasColumns($table, [...$colonnes, 'organization_id']))->toBeTrue("colonnes de {$table}");
})->with(fn () => array_map(fn (array $c): array => $c, array_map(null, array_keys(colonnesLues()), array_values(colonnesLues()))));

it('toute table lue par Reporting dans une autre table figure au contrat de schéma', function (): void {
    $sources = array_merge(...array_map(fn (string $d): array => glob($d.'/*.php') ?: [], [app_path('Modules/Reporting/Queries'), app_path('Modules/Reporting/Queries/Cards'), app_path('Modules/Reporting/Queries/Finance'), app_path('Modules/Reporting/Support'), app_path('Modules/Reporting/Support/Finance')]));
    $lues = [];

    foreach ($sources as $fichier) {
        preg_match_all("/(?:lecture|reading)->table\('([a-z_]+)'/", (string) file_get_contents($fichier), $m);
        $lues = [...$lues, ...$m[1]];
    }

    expect(count(array_unique($lues)))->toBeGreaterThan(8)->and(array_values(array_diff(array_unique($lues), array_keys(colonnesLues()))))->toBe([]);
});

it('les tables propres à Reporting portent organization_id et leurs clés d\'unicité', function (): void {
    foreach (['management_reports', 'management_report_lines', 'management_report_sequences', 'reporting_mandant_locks'] as $table) {
        expect(Schema::hasColumn($table, 'organization_id'))->toBeTrue($table);
    }

    $index = collect(Schema::getIndexes('management_reports'))->filter(fn (array $i): bool => $i['unique'])->map(fn (array $i): string => implode(',', $i['columns']))->all();

    expect($index)->toContain('organization_id,number')->toContain('organization_id,idempotency_key')->toContain('organization_id,open_key')->toContain('organization_id,rectification_key');
});
