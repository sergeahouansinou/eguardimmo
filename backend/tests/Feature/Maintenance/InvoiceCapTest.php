<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\SupplierInvoice;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->id = C::travauxTermines($this, $this->scene);
});

function imputer(object $test, array $scene, string $id, string $facture, int $montant, string $cle): TestResponse
{
    return $test->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => $montant, 'idempotency_key' => $cle]);
}

it('deux factures de 240,00 sur un engagement de 240,00 : la seconde ne s\'impute pas', function (): void {
    $premiere = C::facture($this, $this->scene, $this->id)->assertCreated()->assertJsonPath('data.exceeds_approved_amount', false)->json('data.id');
    $seconde = C::facture($this, $this->scene, $this->id)->assertCreated()->assertJsonPath('data.exceeds_approved_amount', true)->json('data.id');

    imputer($this, $this->scene, $this->id, $seconde, 24000, 'imputation-seconde')->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_exceeds_approval');
    imputer($this, $this->scene, $this->id, $premiere, 24000, 'imputation-premiere')->assertCreated();
    imputer($this, $this->scene, $this->id, $seconde, 24000, 'imputation-seconde-bis')->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_exceeds_approval');
});

it('le dépassement se mesure sur la somme des factures non annulées, la facture en cours comprise', function (): void {
    $taxes = [['tax_rate_key' => 'fr_vat_normal', 'base' => 12500, 'tax' => 2500]];
    $a = C::facture($this, $this->scene, $this->id, ['taxes' => $taxes])->assertCreated()->assertJsonPath('data.exceeds_approved_amount', false)->json('data.id');
    $b = C::facture($this, $this->scene, $this->id, ['taxes' => $taxes])->assertCreated()->assertJsonPath('data.exceeds_approved_amount', true)->json('data.id');

    imputer($this, $this->scene, $this->id, $b, 15000, 'imputation-b')->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_exceeds_approval');

    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$a}/cancel"))->assertOk();
    imputer($this, $this->scene, $this->id, $b, 15000, 'imputation-b-libre')->assertCreated();
});

it('refuse de régler une facture qui dépasse l\'engagement tant qu\'un avenant accepté ne la couvre pas', function (): void {
    $facture = C::facture($this, $this->scene, $this->id, ['taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 25000, 'tax' => 5000]]])->assertCreated()->assertJsonPath('data.exceeds_approved_amount', true)->json('data.id');
    $url = C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$facture}/payments");
    $corps = ['amount' => 10000, 'method' => 'transfer', 'paid_on' => '2026-11-21'];

    $this->postJson($url, [...$corps, 'idempotency_key' => 'reglement-sans-avenant'])->assertUnprocessable()->assertJsonPath('code', 'supplier_invoice_exceeds_approval');

    $avenant = (string) C::devis($this, $this->scene, $this->id, 5000, ['kind' => 'supplement'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/quotes/{$avenant}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/quotes/{$avenant}/accept"))->assertOk();

    $this->postJson($url, [...$corps, 'idempotency_key' => 'reglement-avec-avenant'])->assertCreated();
});

it('rejoue une facture avec la même clé seulement si tout le contenu est identique', function (): void {
    $pdf = C::fichier($this, $this->scene, $this->id, 'invoice');
    $corps = ['number' => 'F-REJEU', 'idempotency_key' => 'cle-facture-rejeu'];

    C::facture($this, $this->scene, $this->id, $corps, $pdf)->assertCreated();
    C::facture($this, $this->scene, $this->id, $corps, $pdf)->assertOk()->assertJsonPath('data.replayed', true);
    C::facture($this, $this->scene, $this->id, [...$corps, 'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4003]]], $pdf)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    C::facture($this, $this->scene, $this->id, [...$corps, 'invoice_on' => '2026-11-19'], $pdf)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');
    C::facture($this, $this->scene, $this->id, [...$corps, 'due_on' => '2026-12-31'], $pdf)->assertConflict()->assertJsonPath('code', 'maintenance_idempotency_key_reused');

    expect(SupplierInvoice::query()->withoutGlobalScopes()->count())->toBe(1);
});

it('un devis aux montants démesurés répond 422, jamais 500', function (): void {
    $scene = C::agence();
    $id = C::enDevis($this, $scene);
    $fichier = C::fichier($this, $scene, $id, 'quote');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), [
        'reference' => 'DEV-GROS', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => $fichier,
        'lines' => [['label' => 'Démesure', 'quantity_milli' => 1000000000, 'unit_price' => 100000000000, 'tax_rate_key' => 'fr_vat_normal']],
    ])->assertUnprocessable()->assertJsonPath('code', 'quote_lines_invalid');

    $lignes = array_fill(0, 100, ['label' => 'Ligne', 'quantity_milli' => 1000, 'unit_price' => 99000000000, 'tax_rate_key' => 'fr_vat_normal']);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes"), [
        'reference' => 'DEV-SOMME', 'kind' => 'initial', 'issued_on' => '2026-11-17', 'file_id' => $fichier, 'lines' => $lignes,
    ])->assertUnprocessable()->assertJsonPath('code', 'quote_lines_invalid');
});
