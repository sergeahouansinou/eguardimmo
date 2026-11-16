<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\AddLeaseUnit;
use App\Modules\Leases\Actions\EndLeaseUnit;
use App\Modules\Leases\Data\EndLeaseUnitData;
use App\Modules\Leases\Data\NewLeaseUnitChangeData;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Queries\UnitOccupations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesQueryTrace as Q;
use Tests\Feature\Leases\LeaseUnitsContext as U;

/*
 * Sous REPEATABLE READ (MySQL), la première lecture non verrouillante d'une transaction fige l'instantané : une occupation
 * relue ensuite n'y voit pas un bail validé entre-temps. Chaque Action qui décide d'un chevauchement ne lit donc, avant
 * le verrou des lots, que `FOR UPDATE`. La preuve réelle exige MySQL 8.4 à deux connexions ; ici l'ordre des requêtes.
 */
beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
    $this->verifier = function (callable $appel): void {
        $ordre = Q::split(Q::run($appel));

        expect($ordre['avant'])->not->toContain(Q::READ)
            ->and($ordre['avant'])->toContain(Q::LOCKED_READ)
            ->and($ordre['apres'])->toContain(Q::READ);
    };
});

it('marque les lectures verrouillantes : une lecture simple se distingue d\'un FOR UPDATE', function (): void {
    $ordre = Q::run(function (): void {
        L::dans($this->org, function (): void {
            DB::transaction(function (): void {
                Lease::query()->lockForUpdate()->first();
                Lease::query()->first();
            });
        });
    });

    expect(array_map(fn (array $e): string => $e[0], $ordre))->toBe([Q::BEGIN, Q::LOCKED_READ, Q::READ]);
});

it('signature : bail et lignes de lots se lisent FOR UPDATE, l\'occupation après le verrou des lots', function (): void {
    ['bail' => $bail] = S::brouillon($this->org);

    ($this->verifier)(fn () => S::appliquer($this, $bail));
});

it('ajout d\'un lot à un bail signé : verrou du lot avant toute lecture du lot ou des lignes', function (): void {
    $bail = U::signe($this->org, L::lot($this->org));
    $annexe = L::lot($this->org);

    ($this->verifier)(fn () => L::dans($this->org, fn () => app(AddLeaseUnit::class)->handle($bail, new NewLeaseUnitChangeData($bail->lock_version, $annexe->id, false, '2026-06-01'))));
});

it('remplacement du lot principal d\'un bail signé : la ligne fermée se lit FOR UPDATE, le verrou précède le reste', function (): void {
    $lot = L::lot($this->org);
    $relais = L::lot($this->org);
    $bail = U::signe($this->org, $lot);
    $ligne = U::ligne($this->org, $bail, $lot);

    ($this->verifier)(fn () => L::dans($this->org, fn () => app(EndLeaseUnit::class)->handle($bail, $ligne->id, new EndLeaseUnitData($bail->lock_version, '2026-09-01', $relais->id))));
});

it('renouvellement : les lignes de lots ouvertes se lisent FOR UPDATE avant le verrou', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    ($this->verifier)(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)));
});

it('résiliation qui prolonge l\'occupation : verrou des lots avant la relecture des occupations', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['tacit_renewal' => true, 'ends_on' => null]);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    ($this->verifier)(fn () => E::resilier($this->org, $apres, E::fin($apres, ['fin' => '2027-06-01'])));
});

it('remplacement d\'un préavis qui prolonge l\'occupation : verrou des lots avant la relecture des occupations', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['tacit_renewal' => true, 'ends_on' => null]);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    ($this->verifier)(fn () => E::poser($this->org, $apres, E::preavis($apres, ['remplace' => true, 'depart' => '2027-06-01'])));
});

it('lit les occupations par jointure explicite, jamais par sous-requête', function (): void {
    $lot = L::lot($this->org);
    S::bailSigneSur($this->org, $lot);
    $lectures = [];
    DB::listen(function ($requete) use (&$lectures): void {
        $lectures[] = strtolower($requete->sql);
    });

    L::dans($this->org, fn () => app(UnitOccupations::class)->of([$lot->id]));

    $occupations = array_values(array_filter($lectures, fn (string $sql): bool => str_contains($sql, 'from "lease_units"')));

    expect($occupations)->toHaveCount(1)
        ->and($occupations[0])->toContain('inner join "leases"')
        ->and($occupations[0])->not->toContain('exists (');
});

it('ne prend aucun verrou de lot quand la fin du bail recule', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['tacit_renewal' => true, 'ends_on' => null]);

    $ordre = Q::run(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-06-01', 'amiable' => true, 'motif' => 'Accord', 'par' => NoticeGivenBy::Tenant])));

    expect(array_column($ordre, 0))->not->toContain(Q::LOCK);
});
