<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\ArchiveLease;
use App\Modules\Leases\Actions\CancelLease;
use App\Modules\Leases\Actions\DuplicateLease;
use App\Modules\Leases\Actions\RestoreLease;
use App\Modules\Leases\Data\CancelLeaseData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Http\Requests\DuplicateLeaseRequest;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->bail = D::creer($this->org, D::payload($this->lot, $this->partie));
    $this->action = fn (string $classe, ?Lease $bail = null, ?int $version = null): Lease => L::dans($this->org, function () use ($classe, $bail, $version): Lease {
        $courant = Lease::query()->findOrFail(($bail ?? $this->bail)->id);

        return $classe === CancelLease::class
            ? app($classe)->handle($courant, new CancelLeaseData($version ?? $courant->lock_version))
            : app($classe)->handle($courant);
    });
    $this->etat = fn (array $attributs) => L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->update($attributs));
    $this->dupliquer = fn (string $debut = '2027-01-01', ?Lease $source = null): Lease => L::dans($this->org, fn (): Lease => app(DuplicateLease::class)->handle(
        Lease::query()->findOrFail(($source ?? $this->bail)->id),
        D::requete(DuplicateLeaseRequest::class, ['starts_on' => $debut])->toData(),
    ));
    $this->refus = fn (callable $appel): string => D::refus($appel);
});

it('annule un brouillon, une seule fois', function (): void {
    $this->actingAs($this->titulaire);

    $bail = ($this->action)(CancelLease::class);

    expect($bail->status)->toBe(LeaseStatus::Cancelled)
        ->and($bail->lock_version)->toBe(2)
        ->and(AuditLog::query()->where('subject_id', $this->bail->id)->where('action', 'lease.updated')->exists())->toBeTrue()
        ->and(($this->refus)(fn () => ($this->action)(CancelLease::class)))->toBe('lease_not_draft:409');
});

it('refuse d\'annuler un brouillon dont la version a changé depuis la lecture', function (): void {
    expect(($this->refus)(fn () => ($this->action)(CancelLease::class, null, 9)))->toBe('lease_stale_version:409')
        ->and(L::dans($this->org, fn (): LeaseStatus => Lease::query()->findOrFail($this->bail->id)->status))->toBe(LeaseStatus::Draft);
});

it('n\'annule pas un bail signé ou terminé', function (LeaseStatus $statut): void {
    ($this->etat)(['status' => $statut, 'signed_on' => '2026-02-15']);

    expect(($this->refus)(fn () => ($this->action)(CancelLease::class)))->toBe('lease_not_draft:409')
        ->and(L::dans($this->org, fn (): LeaseStatus => Lease::query()->findOrFail($this->bail->id)->status))->toBe($statut);
})->with([LeaseStatus::Signed, LeaseStatus::Terminated]);

it('archive et restaure un bail brouillon, annulé ou terminé, sans effet répété', function (LeaseStatus $statut): void {
    ($this->etat)(['status' => $statut, 'signed_on' => '2026-02-15', ...($statut === LeaseStatus::Terminated ? ['starts_on' => '2019-01-01', 'ends_on' => '2020-01-01'] : [])]);

    $archive = ($this->action)(ArchiveLease::class);
    $encore = ($this->action)(ArchiveLease::class);
    $restaure = ($this->action)(RestoreLease::class);
    $encoreRestaure = ($this->action)(RestoreLease::class);

    expect($archive->archived_at)->not->toBeNull()
        ->and($encore->archived_at?->toIso8601String())->toBe($archive->archived_at?->toIso8601String())
        ->and($restaure->archived_at)->toBeNull()
        ->and($encoreRestaure->archived_at)->toBeNull()
        ->and($restaure->status)->toBe($statut)
        ->and(AuditLog::query()->where('subject_id', $this->bail->id)->where('action', 'lease.updated')->count())->toBe(3);
})->with([
    'brouillon' => [LeaseStatus::Draft],
    'annulé' => [LeaseStatus::Cancelled],
    'terminé' => [LeaseStatus::Terminated],
]);

it('journalise l\'archivage avec la date posée', function (): void {
    ($this->action)(ArchiveLease::class);

    $ligne = AuditLog::query()->where('subject_id', $this->bail->id)->where('action', 'lease.updated')->firstOrFail();

    expect($ligne->changes)->toHaveKey('archived_at')
        ->and($ligne->changes['archived_at']['old'])->toBeNull()
        ->and($ligne->changes['archived_at']['new'])->not->toBeNull();
});

it('n\'archive pas un bail résilié tant que sa fin effective n\'est pas atteinte', function (array $dates): void {
    ($this->etat)(['status' => LeaseStatus::Terminated, 'signed_on' => '2026-02-15', ...$dates]);

    expect(($this->refus)(fn () => ($this->action)(ArchiveLease::class)))->toBe('lease_not_archivable:409')
        ->and(L::dans($this->org, fn (): bool => Lease::query()->findOrFail($this->bail->id)->archived_at === null))->toBeTrue();
})->with([
    'fin future' => fn () => ['starts_on' => '2026-01-01', 'ends_on' => now()->addMonths(6)->toDateString()],
    'départ annoncé futur avant une fin lointaine' => fn () => ['starts_on' => '2026-01-01', 'ends_on' => now()->addYear()->toDateString(), 'notice_received_on' => '2026-03-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => now()->addMonth()->toDateString(), 'termination_reason' => 'Congé du locataire'],
]);

it('n\'archive pas un bail signé en cours', function (): void {
    ($this->etat)(['status' => LeaseStatus::Signed, 'signed_on' => '2026-02-15']);

    expect(($this->refus)(fn () => ($this->action)(ArchiveLease::class)))->toBe('lease_not_archivable:409')
        ->and(L::dans($this->org, fn (): bool => Lease::query()->findOrFail($this->bail->id)->archived_at === null))->toBeTrue();
});

it('duplique un bail en nouveau brouillon à la date fournie', function (): void {
    ($this->etat)(['status' => LeaseStatus::Signed, 'signed_on' => '2026-02-15', 'note' => 'note du bail source', 'payment_method' => 'transfer', 'jurisdiction_data' => ['tense_zone' => true]]);
    $garant = L::partie($this->org);
    L::dans($this->org, fn () => LeaseParty::factory()->create(['lease_id' => $this->bail->id, 'party_id' => $garant->id, 'role' => 'guarantor', 'guarantees_party_id' => $this->partie->id, 'guarantee_limit_amount' => Money\Money::EUR(900000), 'guarantee_ends_on' => '2030-01-01']));
    $this->actingAs($this->titulaire);

    $copie = ($this->dupliquer)('2027-01-01');
    $copieLue = L::dans($this->org, fn (): Lease => Lease::query()->findOrFail($copie->id));

    expect($copieLue->id)->not->toBe($this->bail->id)
        ->and($copieLue->reference)->toBe('BL-'.now()->year.'-0002')
        ->and($copieLue->status)->toBe(LeaseStatus::Draft)
        ->and($copieLue->lock_version)->toBe(1)
        ->and($copieLue->starts_on->toDateString())->toBe('2027-01-01')
        ->and($copieLue->ends_on?->toDateString())->toBe('2030-01-01')
        ->and($copieLue->duration_months)->toBe(36)
        ->and($copieLue->regime_key)->toBe('fr.residential.unfurnished')
        ->and($copieLue->payment_method?->value)->toBe('transfer')
        ->and($copieLue->jurisdiction_data)->toBe(['tense_zone' => true])
        ->and($copieLue->signed_on)->toBeNull()
        ->and($copieLue->signed_file_id)->toBeNull()
        ->and($copieLue->notice_received_on)->toBeNull()
        ->and($copieLue->termination_reason)->toBeNull()
        ->and($copieLue->archived_at)->toBeNull()
        ->and($copieLue->created_by_user_id)->toBe($this->titulaire->id)
        ->and($copieLue->note)->toBeNull();

    $parties = L::dans($this->org, fn () => LeaseParty::query()->where('lease_id', $copie->id)->get());
    $caution = $parties->firstWhere('role.value', 'guarantor');

    expect($parties)->toHaveCount(2)
        ->and($parties->every(fn (LeaseParty $p): bool => $p->valid_from->toDateString() === '2027-01-01' && $p->valid_to === null))->toBeTrue()
        ->and($caution?->guarantees_party_id)->toBe($this->partie->id)
        ->and($caution?->guarantee_limit_amount?->getAmount())->toBe('900000')
        ->and($caution?->guarantee_ends_on?->toDateString())->toBe('2030-01-01')
        ->and(L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $copie->id)->where('unit_id', $this->lot->id)->where('is_main', true)->count()))->toBe(1)
        ->and(L::dans($this->org, fn (): int => Lease::query()->count()))->toBe(2);
});

it('ne copie que les lots, parties et composantes encore ouverts ou en vigueur', function (): void {
    $this->travelTo('2026-09-01');
    $ancien = L::partie($this->org);
    $autreLot = L::lot($this->org);
    L::dans($this->org, function () use ($ancien, $autreLot): void {
        LeaseTerm::query()->where('lease_id', $this->bail->id)->delete();
        LeaseParty::factory()->create(['lease_id' => $this->bail->id, 'party_id' => $ancien->id, 'role' => 'tenant', 'valid_to' => '2026-06-01']);
        LeaseUnit::factory()->create(['lease_id' => $this->bail->id, 'unit_id' => $autreLot->id, 'is_main' => false, 'valid_to' => '2026-06-01']);
        LeaseTerm::factory()->create(['lease_id' => $this->bail->id, 'component_term_id' => L::composante('rent')->id, 'amount' => Money\Money::EUR(60000), 'valid_from' => '2026-03-01', 'valid_to' => '2026-06-01']);
        LeaseTerm::factory()->create(['lease_id' => $this->bail->id, 'component_term_id' => L::composante('rent')->id, 'amount' => Money\Money::EUR(65000), 'valid_from' => '2026-06-01', 'vat_bp' => 1000, 'indexed' => true]);
        LeaseTerm::factory()->create(['lease_id' => $this->bail->id, 'component_term_id' => L::composante('charges_provision')->id, 'amount' => Money\Money::EUR(4000), 'valid_from' => '2026-12-01']);
    });

    $copie = ($this->dupliquer)('2027-01-01');
    $lignes = L::dans($this->org, fn () => LeaseTerm::query()->where('lease_id', $copie->id)->get());

    expect(L::dans($this->org, fn () => LeaseParty::query()->where('lease_id', $copie->id)->pluck('party_id')->all()))->toBe([$this->partie->id])
        ->and(L::dans($this->org, fn () => LeaseUnit::query()->where('lease_id', $copie->id)->pluck('unit_id')->all()))->toBe([$this->lot->id])
        ->and($lignes)->toHaveCount(1)
        ->and($lignes[0]->amount->getAmount())->toBe('65000')
        ->and($lignes[0]->vat_bp)->toBe(1000)
        ->and($lignes[0]->indexed)->toBeTrue()
        ->and($lignes[0]->valid_from->toDateString())->toBe('2027-01-01')
        ->and($lignes[0]->reason->value)->toBe('initial')
        ->and($lignes[0]->replaces_id)->toBeNull();
});

it('duplique aussi un bail archivé ou annulé', function (): void {
    ($this->etat)(['status' => LeaseStatus::Cancelled, 'archived_at' => now()]);

    expect(($this->dupliquer)()->status)->toBe(LeaseStatus::Draft);
});

it('revérifie lots et parties à la duplication', function (): void {
    L::dans($this->org, fn () => Unit::query()->findOrFail($this->lot->id)->update(['archived_at' => now()]));

    expect(($this->refus)(fn () => ($this->dupliquer)()))->toBe('lease_unit_not_available:422');

    L::dans($this->org, fn () => Unit::query()->findOrFail($this->lot->id)->update(['archived_at' => null]));
    L::dans($this->org, fn () => Party::query()->findOrFail($this->partie->id)->update(['anonymized_at' => now()]));

    expect(($this->refus)(fn () => ($this->dupliquer)()))->toBe('lease_party_not_available:422')
        ->and(L::dans($this->org, fn (): int => Lease::query()->count()))->toBe(1);
});

it('revérifie le plafond de dépôt à la duplication', function (): void {
    $autre = D::creer($this->org, D::payload($this->lot, $this->partie, ['regime_key' => 'fr.common_law', 'terms' => [
        ['component_term_id' => L::composante('rent')->id, 'amount' => 10000],
        ['component_term_id' => L::composante('deposit')->id, 'amount' => 50000],
    ]]));
    L::dans($this->org, fn () => Lease::query()->findOrFail($autre->id)->update(['regime_key' => 'fr.residential.mobility', 'duration_months' => 10]));

    expect(($this->refus)(fn () => ($this->dupliquer)('2027-01-01', $autre)))->toBe('lease_deposit_over_cap:422');
});

it('exige la date de début de la copie', function (): void {
    expect(D::refus(fn () => D::requete(DuplicateLeaseRequest::class, [])))->toBe('validation:starts_on')
        ->and(D::refus(fn () => D::requete(DuplicateLeaseRequest::class, ['starts_on' => '2027-13-01'])))->toBe('validation:starts_on')
        ->and(D::refus(fn () => D::requete(DuplicateLeaseRequest::class, ['starts_on' => '2027-01-01', 'status' => 'signed', 'reference' => 'X'])))->toBe('');
});

it('isole annulation, archivage, restauration et duplication par organisation', function (string $classe): void {
    $autre = L::organisation();
    $etranger = D::creer($autre, D::payload(L::lot($autre), L::partie($autre)));

    $complement = match ($classe) {
        DuplicateLease::class => [D::requete(DuplicateLeaseRequest::class, ['starts_on' => '2027-01-01'])->toData()],
        CancelLease::class => [new CancelLeaseData($etranger->lock_version)],
        default => [],
    };
    $refus = D::refus(fn () => L::dans($this->org, fn () => app($classe)->handle($etranger, ...$complement)));

    expect($refus)->toBe('lease_not_found:404')
        ->and(L::dans($autre, fn (): LeaseStatus => Lease::query()->findOrFail($etranger->id)->status))->toBe(LeaseStatus::Draft)
        ->and(L::dans($autre, fn (): int => Lease::query()->count()))->toBe(1);
})->with([CancelLease::class, ArchiveLease::class, RestoreLease::class, DuplicateLease::class]);
