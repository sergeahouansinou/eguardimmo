<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Maintenance\Models\SupplierInvoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

/**
 * @param  array<string, mixed>  $scene
 * @param  array<string, mixed>  $surcharges
 */
function enregistrerFacture(object $test, array $scene, string $id, array $surcharges = [], ?string $fichier = null): TestResponse
{
    return $test->postJson(C::url($scene['org'], "/interventions/{$id}/invoices"), [
        'number' => 'F-'.bin2hex(random_bytes(3)),
        'invoice_on' => '2026-11-20',
        'file_id' => $fichier ?? C::fichier($test, $scene, $id, 'invoice'),
        'declared_gross' => 24000,
        'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]],
        'idempotency_key' => 'facture-'.bin2hex(random_bytes(4)),
        ...$surcharges,
    ]);
}

it('refuse une facture avant la fin des travaux', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);

    enregistrerFacture($this, $scene, $id, ['invoice_on' => '2026-11-18'])->assertConflict()->assertJsonPath('code', 'intervention_transition_invalid');
});

it('contrôle les totaux et la TVA saisie, avec une tolérance d\'arrondi', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);

    enregistrerFacture($this, $scene, $id, ['declared_gross' => 25000])->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_totals_invalid');
    enregistrerFacture($this, $scene, $id, ['declared_gross' => 23000, 'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 3000]]])->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_totals_invalid');
    enregistrerFacture($this, $scene, $id, ['taxes' => [['tax_rate_key' => 'inconnu', 'base' => 20000, 'tax' => 4000]]])->assertUnprocessable()->assertJsonPath('code', 'maintenance_tax_rate_unknown');
    enregistrerFacture($this, $scene, $id, ['invoice_on' => '2026-11-19', 'declared_gross' => 24003, 'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4003]]])->assertCreated()
        ->assertJsonPath('data.total_gross.amount', 24003);
});

it('refuse un doublon par numéro du prestataire ou par empreinte du PDF', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $pdf = C::fichier($this, $scene, $id, 'invoice');

    enregistrerFacture($this, $scene, $id, ['number' => 'F-100'], $pdf)->assertCreated();
    enregistrerFacture($this, $scene, $id, ['number' => 'F-100'])->assertConflict()->assertJsonPath('code', 'supplier_invoice_duplicate');
    enregistrerFacture($this, $scene, $id, ['number' => 'F-101'], $pdf)->assertConflict()->assertJsonPath('code', 'supplier_invoice_duplicate');
    expect(SupplierInvoice::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('rejoue une facture avec la même clé sans écrire deux fois', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $pdf = C::fichier($this, $scene, $id, 'invoice');
    $corps = ['number' => 'F-200', 'idempotency_key' => 'cle-facture-200'];

    $premiere = enregistrerFacture($this, $scene, $id, $corps, $pdf)->assertCreated()->assertJsonPath('data.replayed', false);
    enregistrerFacture($this, $scene, $id, $corps, $pdf)->assertOk()->assertJsonPath('data.replayed', true)->assertJsonPath('data.id', $premiere->json('data.id'));

    expect(SupplierInvoice::query()->withoutGlobalScopes()->count())->toBe(1)
        ->and(C::solde($scene['org'], AccountRole::WorksPending))->toBe(24000)
        ->and(C::solde($scene['org'], AccountRole::SupplierPayable))->toBe(24000);
});

it('une facture au-dessus du montant engagé s\'enregistre mais ne s\'impute pas', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);

    $facture = enregistrerFacture($this, $scene, $id, ['declared_gross' => 30000, 'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 25000, 'tax' => 5000]]])
        ->assertCreated()->assertJsonPath('data.exceeds_approved_amount', true)->json('data.id');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => 30000, 'idempotency_key' => 'imputation-depasse'])
        ->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_exceeds_approval');
});

it('impute en plusieurs parts distinctes sans dépasser le TTC, rejoue et contrepasse', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    $url = C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations");

    $part = $this->postJson($url, ['target' => 'owner', 'share_amount' => 10000, 'idempotency_key' => 'imputation-a'])->assertCreated()->assertJsonPath('data.replayed', false);
    $this->postJson($url, ['target' => 'owner', 'share_amount' => 10000, 'idempotency_key' => 'imputation-a'])->assertOk()->assertJsonPath('data.replayed', true)->assertJsonPath('data.id', $part->json('data.id'));
    $this->postJson($url, ['target' => 'owner', 'share_amount' => 11000, 'idempotency_key' => 'imputation-a'])->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    $this->postJson($url, ['target' => 'owner', 'share_amount' => 14001, 'idempotency_key' => 'imputation-b'])->assertUnprocessable()->assertJsonPath('code', 'allocation_exceeds_invoice');

    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(14000);
    $this->getJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}"))->assertJsonPath('data.status', 'recorded');

    $this->postJson($url, ['target' => 'owner', 'share_amount' => 14000, 'idempotency_key' => 'imputation-c'])->assertCreated();
    $this->getJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}"))->assertJsonPath('data.status', 'allocated');
    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(0);

    $this->postJson(C::url($scene['org'], "/allocations/{$part->json('data.id')}/cancel"))->assertOk()->assertJsonPath('data.share_amount.amount', 10000);
    $this->getJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}"))->assertJsonPath('data.status', 'recorded');
    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(10000);
});

it('un règlement ne dépasse jamais le reste dû et se contrepasse', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    $url = C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/payments");

    $this->postJson($url, ['amount' => 24001, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-trop'])->assertUnprocessable()->assertJsonPath('code', 'payment_exceeds_outstanding');
    $this->postJson($url, ['amount' => 5000, 'method' => 'transfer', 'paid_on' => '2026-11-19', 'idempotency_key' => 'reglement-avant'])->assertUnprocessable()->assertJsonPath('code', 'supplier_payment_invalid');

    $paiement = $this->postJson($url, ['amount' => 10000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-un'])->assertCreated()->json('data.id');
    $this->postJson($url, ['amount' => 10000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-un'])->assertOk()->assertJsonPath('data.id', $paiement);
    expect(C::solde($scene['org'], AccountRole::SupplierPayable))->toBe(14000);

    $this->postJson($url, ['amount' => 14001, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-deux'])->assertUnprocessable()->assertJsonPath('code', 'payment_exceeds_outstanding');
    $this->postJson(C::url($scene['org'], "/supplier-payments/{$paiement}/cancel"))->assertOk();
    expect(C::solde($scene['org'], AccountRole::SupplierPayable))->toBe(24000);
});

it('annule une facture non imputée et non réglée : l\'écriture est contrepassée', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    $imputation = $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-annul'])->assertCreated()->json('data.id');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/cancel"))->assertConflict()->assertJsonPath('code', 'supplier_invoice_status_invalid');
    $this->postJson(C::url($scene['org'], "/allocations/{$imputation}/cancel"))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/cancel"))->assertOk()->assertJsonPath('data.status', 'cancelled');

    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(0)
        ->and(C::solde($scene['org'], AccountRole::SupplierPayable))->toBe(0);
});

it('retient sur le dépôt de garantie après vétusté, bail terminé, nature à charge du locataire', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene, 20000, 'locksmith');
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    $url = C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations");
    $corps = ['target' => 'deposit', 'share_amount' => 10000, 'wear_basis_points' => 2500, 'basis_note' => 'Clé perdue, état des lieux de sortie.'];

    $this->postJson($url, [...$corps, 'idempotency_key' => 'depot-bail-actif'])->assertUnprocessable()->assertJsonPath('code', 'allocation_deposit_unavailable');

    C::resilier($scene['org'], $scene['lease']);
    $this->postJson($url, [...$corps, 'idempotency_key' => 'depot-sans-solde'])->assertUnprocessable()->assertJsonPath('code', 'allocation_deposit_unavailable');

    C::deposer($scene['org'], $scene['lease'], 50000);
    $this->postJson($url, [...$corps, 'idempotency_key' => 'depot-ok'])->assertCreated()
        ->assertJsonPath('data.share_amount.amount', 10000)->assertJsonPath('data.charged_amount.amount', 7500)->assertJsonPath('data.target', 'deposit');

    expect(C::depositSolde($scene['org'], $scene['lease']))->toBe(42500);
});

it('verrouille le bail avant de lire le solde du dépôt', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene, 20000, 'locksmith');
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    C::resilier($scene['org'], $scene['lease']);
    C::deposer($scene['org'], $scene['lease'], 50000);

    $requetes = [];
    DB::listen(function ($requete) use (&$requetes): void {
        $requetes[] = $requete->sql;
    });
    Lease::addGlobalScope('espion', function ($requete) use (&$requetes): void {
        $requetes[] = $requete->getQuery()->lock === null ? 'bail lu' : 'bail verrouillé';
    });

    try {
        $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'deposit', 'share_amount' => 10000, 'wear_basis_points' => 2500, 'basis_note' => 'Clé perdue.', 'idempotency_key' => 'depot-verrou'])->assertCreated();
    } finally {
        Lease::clearBootedModels();
    }

    $verrou = array_search('bail verrouillé', $requetes, true);
    $solde = array_key_first(array_filter($requetes, fn (string $sql): bool => str_contains($sql, 'sum(journal_lines.debit)')));
    expect($verrou)->not->toBeFalse()->and($solde)->not->toBeNull()->and($verrou)->toBeLessThan($solde);
});

it('annuler une imputation ou un règlement d\'une autre organisation donne 404 et ne change rien', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    $imputation = $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-etrangere'])->assertCreated()->json('data.id');
    $paiement = $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/payments"), ['amount' => 1000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-etranger'])->assertCreated()->json('data.id');
    $autre = C::agence();
    C::comme($this, $autre['owner']);

    $this->postJson(C::url($autre['org'], "/allocations/{$imputation}/cancel"))->assertNotFound();
    $this->postJson(C::url($autre['org'], "/supplier-payments/{$paiement}/cancel"))->assertNotFound();

    expect(DB::table('invoice_allocations')->where('id', $imputation)->value('cancelled_at'))->toBeNull()
        ->and(DB::table('supplier_payments')->where('id', $paiement)->value('cancelled_at'))->toBeNull();
});

it('refuse la retenue pour une nature qui n\'est pas à la charge du locataire', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);
    $facture = enregistrerFacture($this, $scene, $id)->assertCreated()->json('data.id');
    C::resilier($scene['org'], $scene['lease']);
    C::deposer($scene['org'], $scene['lease'], 50000);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'deposit', 'share_amount' => 10000, 'wear_basis_points' => 0, 'idempotency_key' => 'depot-plomberie'])
        ->assertUnprocessable()->assertJsonPath('code', 'allocation_not_chargeable');
});
