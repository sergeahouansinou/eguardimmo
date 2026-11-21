<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\PublicApi\LedgerReader;
use Illuminate\Support\Str;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->autre = comptaOrganisation();
});

it('donne le total des débits de chaque écriture, sans inventer celle d\'une écriture inconnue', function (): void {
    $loyer = comptaPoster($this->org, comptaLoyer('e:1', Money::EUR(100000), '2026-09-01'));
    $paiement = comptaPoster($this->org, comptaPaiement('p:1', Money::EUR(60000), '2026-09-10'));
    $inconnue = (string) Str::uuid7();

    $totaux = comptaDans($this->org, fn (): array => app(LedgerReader::class)->entryDebitTotals([$loyer->id, $paiement->id, $inconnue]));

    expect($totaux)->toBe([$loyer->id => 100000, $paiement->id => 60000])
        ->and(comptaDans($this->org, fn (): array => app(LedgerReader::class)->entryDebitTotals([])))->toBe([]);
});

it('ne lit pas l\'écriture d\'une autre organisation', function (): void {
    $etrangere = comptaPoster($this->autre, comptaLoyer('e:9', Money::EUR(5000), '2026-09-01'));

    expect(comptaDans($this->org, fn (): array => app(LedgerReader::class)->entryDebitTotals([$etrangere->id])))->toBe([]);
});
