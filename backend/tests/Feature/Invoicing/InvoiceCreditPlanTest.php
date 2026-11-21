<?php

declare(strict_types=1);

use App\Modules\Invoicing\Data\CreditLineData;
use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Support\CreditPlan;
use App\Shared\Http\ApiProblem;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

function avoirDeQuantite(object $test, Invoice $facture, string $ligne, int $quantite, string $cle)
{
    return $test->postJson(C::url($test->org, "/{$facture->id}/credit-notes"), [
        'reason' => 'Rectification', 'full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => $quantite]], 'idempotency_key' => $cle,
    ]);
}

it('le cumul des nets crédités d\'une ligne ne dépasse jamais son net d\'origine, même avec des arrondis au demi supérieur', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie, [C::ligne(1, ['quantity_milli' => 3000])]);
    $ligne = L::dans($this->org, fn (): string => $facture->lines()->firstOrFail()->id);
    expect(L::dans($this->org, fn () => $facture->lines()->firstOrFail()->net_amount))->toBe(3);

    foreach (range(1, 3) as $i) {
        avoirDeQuantite($this, $facture, $ligne, 500, "avoir-arrondi-{$i}")->assertCreated()->assertJsonPath('data.total_net.amount', 1);
    }

    avoirDeQuantite($this, $facture, $ligne, 500, 'avoir-arrondi-4')->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_outstanding');

    $cumul = L::dans($this->org, fn () => (int) InvoiceLine::query()->whereIn('invoice_id', Invoice::query()->where('credited_invoice_id', $facture->id)->pluck('id'))->sum('net_amount'));
    expect($cumul)->toBeLessThanOrEqual(3);
});

it('un net déjà crédité supérieur au net d\'origine est refusé, jamais un net négatif', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie, [C::ligne(1, ['quantity_milli' => 3000])]);
    $ligne = L::dans($this->org, fn (): string => $facture->lines()->firstOrFail()->id);

    foreach (range(1, 3) as $i) {
        avoirDeQuantite($this, $facture, $ligne, 500, "avoir-solde-{$i}")->assertCreated();
    }

    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Solde', 'full' => true, 'idempotency_key' => 'avoir-solde-final'])
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_outstanding');

    $deja = ['gross' => 0, 'tax' => 0, 'quantities' => [$ligne => 1000], 'nets' => [$ligne => 5]];
    $demande = new CreditNoteData('Solde', false, [new CreditLineData($ligne, 500)], 'avoir-net-negatif');

    expect(fn () => L::dans($this->org, fn () => app(CreditPlan::class)->lines($facture, $demande, $deja)))
        ->toThrow(ApiProblem::class);
});
