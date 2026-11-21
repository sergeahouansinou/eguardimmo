<?php

declare(strict_types=1);

use App\Modules\Properties\Models\Property;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Investments\InvestmentsContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->b = T::bailleur2025($this);
    $this->org = $this->b['org'];
    T::comme($this, $this->b['owner']);
});

/**
 * @return list<list<string>>
 */
function lignesCsv(string $corps): array
{
    $texte = ltrim($corps, "\u{FEFF}");

    return array_map(fn (string $l): array => array_map(fn (string $c): string => trim($c, '"'), explode(';', $l)), array_values(array_filter(explode("\r\n", $texte), fn (string $l): bool => $l !== '')));
}

function pretExporte(object $test): string
{
    return $test->postJson(I::url($test->org, '/loans'), [
        'property_id' => $test->b['property'], 'lender_label' => 'Banque du Nord', 'contract_reference' => 'PRET-2026-0042', 'purpose' => 'acquisition',
        'principal' => 1200000, 'nominal_rate' => '12', 'first_due_on' => '2025-12-31', 'term_months' => 3,
    ], ['Idempotency-Key' => 'pret-export-0001'])->assertCreated()->json('data.id');
}

it('prêts immobiliers : une ligne par échéance de la fenêtre, montants en unités mineures, en-tête française, entêtes de non-cache', function (): void {
    pretExporte($this);

    $reponse = $this->get(R::url($this->org, '/exports/prets-immobiliers?from=2025-12-01&to=2025-12-31'))->assertOk();
    $lignes = lignesCsv($reponse->getContent());

    expect($reponse->headers->get('Content-Type'))->toContain('text/csv')
        ->and($reponse->headers->get('Content-Disposition'))->toContain('prets-immobiliers.csv')
        ->and((string) $reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')
        ->and($lignes[0])->toBe(['bien', 'lot', 'echeance', 'mensualite_minor', 'interets_minor', 'assurance_minor', 'total_minor', 'devise'])
        ->and($lignes)->toHaveCount(2)
        ->and(array_slice($lignes[1], 1))->toBe(['', '2025-12-31', '408027', '12000', '0', '408027', 'EUR'])
        ->and($reponse->getContent())->not->toContain('PRET-2026-0042')->not->toContain('Banque du Nord');
});

it('prêts immobiliers : borne haute incluse, la veille exclut l\'échéance du 31 décembre', function (): void {
    pretExporte($this);

    expect(lignesCsv($this->get(R::url($this->org, '/exports/prets-immobiliers?from=2025-12-01&to=2025-12-30'))->getContent()))->toHaveCount(1)
        ->and(lignesCsv($this->get(R::url($this->org, '/exports/prets-immobiliers?from=2026-01-01&to=2026-02-28'))->getContent()))->toHaveCount(3);
});

it('rentabilité par bien : mêmes chiffres que l\'écran, rendements en points de base, cellule texte préfixée contre l\'injection de formule', function (): void {
    $this->postJson(I::url($this->org, '/acquisitions'), ['property_id' => $this->b['property'], 'acquired_on' => '2024-06-01', 'price' => 900000, 'acquisition_costs' => 70000, 'agency_fees' => 30000, 'initial_works' => 100000], ['Idempotency-Key' => 'acq-export-0001'])->assertCreated();
    L::dans($this->org, fn (): int => Property::query()->whereKey($this->b['property'])->update(['name' => '=HYPERLINK("http://x")']));

    $lignes = lignesCsv($this->get(R::url($this->org, '/exports/rentabilite-par-bien?year=2025'))->assertOk()->getContent());

    expect($lignes[0][0])->toBe('bien')->and($lignes)->toHaveCount(2)
        ->and($lignes[1][0])->toStartWith("'=HYPERLINK")
        ->and(array_slice($lignes[1], 2))->toBe(['property', '1100000', '27857', '0', '0', '0', '0', '253', '253', '253', '', 'EUR']);
});

it('exports : en-têtes d\'erreur, validation, plafond de lignes et journal sans donnée financière', function (): void {
    $this->getJson(R::url($this->org, '/exports/prets-immobiliers'))->assertStatus(422);
    $this->getJson(R::url($this->org, '/exports/prets-immobiliers?from=0001-01-01&to=9999-12-31'))->assertStatus(422)->assertJsonValidationErrors(['to']);
    $this->getJson(R::url($this->org, '/exports/prets-immobiliers?from=2023-01-01&to=2026-01-01'))->assertStatus(422)->assertJsonValidationErrors(['to']);
    $this->getJson(R::url($this->org, '/exports/rentabilite-par-bien'))->assertStatus(422);
    $this->getJson(R::url($this->org, '/exports/rentabilite-par-bien?year=1999'))->assertStatus(422)->assertJsonPath('code', 'profitability_period_invalid');

    $this->get(R::url($this->org, '/exports/rentabilite-par-bien?year=2025'))->assertOk();
    $entree = AuditLog::query()->where('organization_id', $this->org->id)->where('action', 'reporting.export.generated')->firstOrFail();

    expect($entree->metadata)->toBe(['type' => 'rentabilite-par-bien', 'rows' => 1]);
    $this->get(R::url($this->org, '/exports/prets-immobiliers?from=2023-01-01&to=2025-12-31'))->assertOk();

    config(['reporting.export_max_rows' => 0]);
    $this->getJson(R::url($this->org, '/exports/rentabilite-par-bien?year=2025'))->assertStatus(422)->assertJsonPath('code', 'export_too_large');
});
