<?php

declare(strict_types=1);

use App\Modules\Organizations\Actions\UpdateLegalIdentity;
use App\Modules\Organizations\Data\UpdateLegalIdentityData;
use App\Modules\Organizations\Enums\VatRegime;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

function identiteAvec(?string $tva, string $nom = 'Agence du Port SAS'): UpdateLegalIdentityData
{
    return new UpdateLegalIdentityData(
        $nom,
        ['line1' => '12 quai des Chartrons', 'line2' => null, 'postal_code' => '33000', 'city' => 'Bordeaux', 'country' => 'FR'],
        '552100554', '55210055400013', $tva, 'SAS', 1000000, 'Bordeaux', 'CPI 3301 2016 000 012 345', 'CCI de Bordeaux Gironde', 'Galian', 11000000,
        VatRegime::Normal, false, null,
    );
}

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation(identite: false);
});

it('journalise la création puis chaque modification de l\'identité légale avec les seuls noms de champs', function (): void {
    L::dans($this->org, fn () => app(UpdateLegalIdentity::class)->handle($this->org, identiteAvec('FR40552100554')));
    L::dans($this->org, fn () => app(UpdateLegalIdentity::class)->handle($this->org, identiteAvec('FR99999999999', 'Agence du Quai SAS')));

    $lignes = AuditLog::query()->where('action', 'organizations.legal_identity.updated')->orderBy('occurred_at')->orderBy('id')->get();

    expect($lignes)->toHaveCount(2)
        ->and($lignes[0]->metadata['created'])->toBeTrue()
        ->and($lignes[0]->metadata['fields'])->toContain('legal_name', 'vat_number', 'siren')
        ->and($lignes[1]->metadata['created'])->toBeFalse()
        ->and($lignes[1]->metadata['fields'])->toEqualCanonicalizing(['legal_name', 'vat_number']);

    $brut = json_encode($lignes->map->metadata->all(), JSON_THROW_ON_ERROR);
    expect($brut)->not->toContain('FR99999999999')->not->toContain('Agence du Quai')->not->toContain('552100554');
});

it('un enregistrement identique ne journalise rien de plus', function (): void {
    L::dans($this->org, fn () => app(UpdateLegalIdentity::class)->handle($this->org, identiteAvec('FR40552100554')));
    L::dans($this->org, fn () => app(UpdateLegalIdentity::class)->handle($this->org, identiteAvec('FR40552100554')));

    expect(AuditLog::query()->where('action', 'organizations.legal_identity.updated')->count())->toBe(1);
});
