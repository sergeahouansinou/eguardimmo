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

it('brouillon, émission, règlement partiel puis solde', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    expect($facture->number)->toBe('FA-2026-0001')
        ->and((int) $facture->total_gross->getAmount())->toBe(12000)
        ->and(C::reste($this->org, $facture))->toBe(12000);

    C::regler($this, $this->org, $facture, 5000)->assertCreated();
    expect(C::reste($this->org, $facture))->toBe(7000)
        ->and(L::dans($this->org, fn () => Invoice::query()->find($facture->id)->status->value))->toBe('partially_paid');

    C::regler($this, $this->org, $facture, 7000)->assertCreated();
    expect(L::dans($this->org, fn () => Invoice::query()->find($facture->id)->status->value))->toBe('paid');
});
