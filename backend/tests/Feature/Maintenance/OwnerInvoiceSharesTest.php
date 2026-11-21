<?php

declare(strict_types=1);

use App\Modules\Maintenance\Data\OwnerInvoiceShareData;
use App\Modules\Maintenance\PublicApi\SupplierInvoiceDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->id = C::travauxTermines($this, $this->scene);
    $this->facture = C::facture($this, $this->scene, $this->id)->assertCreated()->json('data.id');
    $this->propriete = L::dans($this->scene['org'], fn (): string => $this->scene['unit']->property_id);
    $this->lire = fn (array $ids): array => L::dans($this->scene['org'], fn (): array => app(SupplierInvoiceDirectory::class)->ownerShares($ids));
    $this->parBien = fn (string $de, string $a): array => L::dans($this->scene['org'], fn (): array => app(SupplierInvoiceDirectory::class)->ownerSharesForProperty($this->propriete, CarbonImmutable::parse($de), CarbonImmutable::parse($a)));
});

it('une facture sans part imputée au propriétaire n\'a aucune part lue', function (): void {
    expect(($this->lire)([$this->facture]))->toBe([])->and(($this->parBien)('2026-01-01', '2027-01-01'))->toBe([]);
});

it('lit la part du propriétaire, son bien et sa date, jamais celle d\'une facture annulée ou inconnue', function (): void {
    $imputation = $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$this->facture}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-part'])->assertCreated()->json('data.id');

    $parts = ($this->lire)([$this->facture, (string) Str::uuid7()]);

    expect($parts)->toHaveCount(1)->and($parts[0])->toBeInstanceOf(OwnerInvoiceShareData::class)
        ->and($parts[0]->invoiceId)->toBe($this->facture)->and($parts[0]->ownerShare->getAmount())->toBe('24000')
        ->and($parts[0]->propertyId)->toBe($this->propriete)->and($parts[0]->invoiceOn)->toBe('2026-11-20')
        ->and(($this->parBien)('2026-11-01', '2026-12-01'))->toHaveCount(1)
        ->and(($this->parBien)('2026-11-21', '2026-12-01'))->toBe([])
        ->and(($this->parBien)('2026-10-01', '2026-11-20'))->toBe([])
        ->and(($this->lire)([]))->toBe([]);

    $this->postJson(C::url($this->scene['org'], "/allocations/{$imputation}/cancel"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$this->facture}/cancel"))->assertOk();

    expect(($this->lire)([$this->facture]))->toBe([])->and(($this->parBien)('2026-01-01', '2027-01-01'))->toBe([]);
});
