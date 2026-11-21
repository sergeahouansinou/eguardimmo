<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\InterventionQuote;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

it('recalcule les lignes côté serveur et refuse un TTC lu sur le PDF qui diffère', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), [
        'reference' => 'DEV-1', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => C::fichier($this, $scene, $id, 'quote'), 'declared_gross' => 99999,
        'lines' => [['label' => 'Main d\'œuvre', 'quantity_milli' => 2500, 'unit_price' => 4000, 'tax_rate_key' => 'fr_vat_normal']],
    ])->assertUnprocessable()->assertJsonPath('code', 'quote_total_mismatch');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), [
        'reference' => 'DEV-2', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => C::fichier($this, $scene, $id, 'quote'), 'declared_gross' => 12000,
        'lines' => [['label' => 'Main d\'œuvre', 'quantity_milli' => 2500, 'unit_price' => 4000, 'tax_rate_key' => 'fr_vat_normal']],
    ])->assertCreated()->assertJsonPath('data.total_net.amount', 10000)->assertJsonPath('data.total_tax.amount', 2000)->assertJsonPath('data.total_gross.amount', 12000)
        ->assertJsonPath('data.lines.0.net_amount', 10000)->assertJsonPath('data.lines.0.tax_rate_pcm', 20000);
});

it('ne prend du client ni statut ni montant : les totaux envoyés sont ignorés', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), [
        'reference' => 'DEV-3', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => C::fichier($this, $scene, $id, 'quote'),
        'status' => 'accepted', 'total_gross' => 1, 'total_net' => 1, 'organization_id' => fake()->uuid(),
        'lines' => [['label' => 'Pièce', 'quantity_milli' => 1000, 'unit_price' => 5000, 'tax_rate_key' => 'fr_vat_normal']],
    ])->assertCreated()->assertJsonPath('data.status', 'received')->assertJsonPath('data.total_gross.amount', 6000);
});

it('refuse une taxe inconnue et un PDF déjà rattaché à un autre devis', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);
    $fichier = C::fichier($this, $scene, $id, 'quote');
    $corps = fn (string $taux): array => ['reference' => 'DEV-'.bin2hex(random_bytes(2)), 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => $fichier, 'lines' => [['label' => 'x', 'quantity_milli' => 1000, 'unit_price' => 5000, 'tax_rate_key' => $taux]]];

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), $corps('inconnu'))->assertUnprocessable()->assertJsonPath('code', 'maintenance_tax_rate_unknown');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), $corps('fr_vat_normal'))->assertCreated();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), $corps('fr_vat_normal'))->assertUnprocessable()->assertJsonPath('code', 'intervention_file_invalid');
});

it('fige le devis dès qu\'il est soumis : plus de modification, refus possible', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);
    $devis = (string) C::devis($this, $scene, $id, 10000)->assertCreated()->json('data.id');
    $url = C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}");
    $corps = ['reference' => 'DEV-MAJ', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => C::fichier($this, $scene, $id, 'quote'), 'lines' => [['label' => 'x', 'quantity_milli' => 1000, 'unit_price' => 7000, 'tax_rate_key' => 'fr_vat_normal']]];

    $this->patchJson($url, $corps)->assertOk()->assertJsonPath('data.total_gross.amount', 8400);
    $this->postJson("{$url}/submit")->assertOk();
    $this->patchJson($url, $corps)->assertConflict()->assertJsonPath('code', 'quote_frozen');
    $this->postJson("{$url}/submit")->assertConflict()->assertJsonPath('code', 'quote_status_invalid');

    $this->postJson("{$url}/refuse")->assertOk();
    expect(InterventionQuote::query()->withoutGlobalScopes()->findOrFail($devis)->status->value)->toBe('refused');
});

it('refuse de soumettre un devis périmé', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);
    $devis = (string) C::devis($this, $scene, $id, 10000, ['valid_until' => '2026-11-18'])->assertCreated()->json('data.id');

    $this->travelTo(now()->addDays(2));
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertConflict()->assertJsonPath('code', 'quote_status_invalid');
});
