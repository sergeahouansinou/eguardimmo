<?php

declare(strict_types=1);

use App\Modules\Invoicing\Models\Invoice;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

dataset('taux interdits sur des honoraires', [
    'taux réduit' => [['tax_category' => 'S', 'tax_rate_key' => 'fr_vat_reduced']],
    'taux intermédiaire' => [['tax_category' => 'S', 'tax_rate_key' => 'fr_vat_intermediate']],
    'taux super réduit' => [['tax_category' => 'S', 'tax_rate_key' => 'fr_vat_super_reduced']],
    'taux zéro' => [['tax_category' => 'Z', 'tax_rate_key' => 'fr_vat_zero']],
    'exonération' => [['tax_category' => 'E', 'tax_rate_key' => 'fr_vat_exempt']],
    'hors champ en régime normal' => [['tax_category' => 'O', 'tax_rate_key' => 'fr_vat_outside_scope']],
]);

it('refuse un taux ou une catégorie hors liste blanche sur des honoraires de gestion', function (array $surcharge): void {
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, $surcharge)]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');
})->with('taux interdits sur des honoraires');

it('refuse aussi à la mise à jour du brouillon et à l\'émission d\'un brouillon déjà enregistré', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');
    $version = $this->getJson(C::url($this->org, "/{$id}"))->json('data.lock_version');

    $this->patchJson(C::url($this->org, "/{$id}"), [
        'recipient_party_id' => $this->partie->id,
        'lock_version' => $version,
        'lines' => [C::ligne(10000, ['tax_rate_key' => 'fr_vat_reduced'])],
    ])->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');

    L::dans($this->org, fn () => Invoice::query()->whereKey($id)->first()->lines()->update(['tax_rate_key' => 'fr_vat_reduced']));
    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');
});

it('accepte les taux intermédiaire et réduit sur une prestation de service, jamais le super réduit', function (): void {
    $service = C::nature('service');

    foreach (['fr_vat_intermediate' => 10000, 'fr_vat_reduced' => 5500] as $cle => $taux) {
        $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['item_term_id' => $service, 'tax_rate_key' => $cle])]))
            ->assertCreated()->assertJsonPath('data.lines.0.tax_rate_pcm', $taux);
    }

    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['item_term_id' => $service, 'tax_rate_key' => 'fr_vat_super_reduced'])]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');
});

it('l\'autoliquidation exige un destinataire société avec numéro de TVA', function (): void {
    $ligne = [C::ligne(10000, ['tax_category' => 'AE', 'tax_rate_key' => 'fr_vat_reverse_charge'])];

    $this->postJson(C::url($this->org), C::brouillon($this->partie, $ligne))->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');
    $this->postJson(C::url($this->org), C::brouillon(C::entreprise($this->org), $ligne))->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_not_allowed');

    $assujettie = C::entreprise($this->org, 'FR23732829320');
    $id = $this->postJson(C::url($this->org), C::brouillon($assujettie, $ligne))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()->assertJsonPath('data.total_tax.amount', 0)->assertJsonPath('data.taxes.0.category', 'AE');
});
