<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->bail = (string) Str::uuid7();
    $this->partie = (string) Str::uuid7();
    $this->e1 = (string) Str::uuid7();
    $this->e2 = (string) Str::uuid7();
    $this->e3 = (string) Str::uuid7();
    $refs = fn (string $echeance): array => ['lease' => $this->bail, 'party' => $this->partie, 'item' => $echeance];

    comptaPoster($this->org, comptaLoyer('e:1', Money::EUR(100000), '2026-09-01', $refs($this->e1)));
    comptaPoster($this->org, comptaLoyer('e:2', Money::EUR(80000), '2026-10-01', $refs($this->e2)));
    comptaPoster($this->org, comptaPaiement('p:1', Money::EUR(60000), '2026-09-10', $refs($this->e1)));
});

it('donne le reste dû de plusieurs créances en une lecture, zéro pour une créance sans écriture', function (): void {
    $restes = comptaDans($this->org, fn (): array => app(LedgerReader::class)->outstandingMany(ItemType::Installment, [$this->e1, $this->e2, $this->e3], new Currency('EUR')));

    expect(array_keys($restes))->toBe([$this->e1, $this->e2, $this->e3])
        ->and($restes[$this->e1]->equals(Money::EUR(40000)))->toBeTrue()
        ->and($restes[$this->e2]->equals(Money::EUR(80000)))->toBeTrue()
        ->and($restes[$this->e3]->equals(Money::EUR(0)))->toBeTrue();
});

it('coïncide avec la lecture unitaire et respecte la date de valeur', function (): void {
    $euro = new Currency('EUR');
    $lecteur = fn (): LedgerReader => app(LedgerReader::class);
    $plusTot = comptaDans($this->org, fn (): array => $lecteur()->outstandingMany(ItemType::Installment, [$this->e1, $this->e2], $euro, CarbonImmutable::parse('2026-09-05')));
    $unitaire = comptaDans($this->org, fn (): Money => $lecteur()->outstanding(ItemType::Installment, $this->e1, $euro));
    $lot = comptaDans($this->org, fn (): array => $lecteur()->outstandingMany(ItemType::Installment, [$this->e1], $euro));

    expect($plusTot[$this->e1]->equals(Money::EUR(100000)))->toBeTrue()
        ->and($plusTot[$this->e2]->equals(Money::EUR(0)))->toBeTrue()
        ->and($lot[$this->e1]->equals($unitaire))->toBeTrue();
});

it('ne lit rien d\'une autre organisation', function (): void {
    $autre = comptaOrganisation();

    $restes = comptaDans($autre, fn (): array => app(LedgerReader::class)->outstandingMany(ItemType::Installment, [$this->e1], new Currency('EUR')));

    expect($restes[$this->e1]->equals(Money::EUR(0)))->toBeTrue();
});

it('une liste vide ne lit rien', function (): void {
    expect(comptaDans($this->org, fn (): array => app(LedgerReader::class)->outstandingMany(ItemType::Installment, [], new Currency('EUR'))))->toBe([]);
});
