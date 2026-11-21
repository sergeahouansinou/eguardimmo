<?php

declare(strict_types=1);

use App\Modules\Mandates\Actions\ActivateMandate;
use App\Modules\Mandates\Actions\AddMandateUnit;
use App\Modules\Mandates\Actions\RenewMandate;
use App\Modules\Mandates\Data\ActivateMandateData;
use App\Modules\Mandates\Data\AddMandateUnitData;
use App\Modules\Mandates\Data\RenewMandateData;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\UnitCoverages;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesQueryTrace as Q;

/*
 * Sous REPEATABLE READ (MySQL), la première lecture non verrouillante d'une transaction fige l'instantané : une couverture
 * relue ensuite n'y voit pas un mandat validé entre-temps. Chaque Action qui décide d'un chevauchement ne lit donc, avant
 * le verrou des lots, que `FOR UPDATE`. La preuve réelle exige MySQL 8.4 à deux connexions ; ici l'ordre des requêtes.
 */
beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->verifier = function (callable $appel): void {
        $ordre = Q::split(Q::run($appel));

        expect($ordre['avant'])->not->toContain(Q::READ)
            ->and($ordre['avant'])->toContain(Q::LOCKED_READ)
            ->and($ordre['apres'])->toContain(Q::READ);
    };
});

it('marque les lectures verrouillantes : une lecture simple se distingue d\'un FOR UPDATE', function (): void {
    $ordre = Q::run(function (): void {
        M::dans($this->org, function (): void {
            DB::transaction(function (): void {
                Mandate::query()->lockForUpdate()->first();
                Mandate::query()->first();
            });
        });
    });

    expect(array_map(fn (array $e): string => $e[0], $ordre))->toBe([Q::BEGIN, Q::LOCKED_READ, Q::READ]);
});

it('activation : mandat et lignes se lisent FOR UPDATE, la couverture après le verrou des lots', function (): void {
    $mandat = M::mandat($this->org, M::lot($this->org), $this->partie);

    ($this->verifier)(fn () => M::dans($this->org, fn () => app(ActivateMandate::class)->handle($mandat, new ActivateMandateData($mandat->lock_version, '2026-11-10', null))));
});

it('ajout d\'un lot à un mandat actif : verrou du lot avant toute lecture de la couverture', function (): void {
    $mandat = M::actif($this->org, M::lot($this->org), $this->partie);
    $annexe = M::lot($this->org);

    ($this->verifier)(fn () => M::dans($this->org, fn () => app(AddMandateUnit::class)->handle($mandat, new AddMandateUnitData($mandat->lock_version, $annexe->id, null))));
});

it('renouvellement : les lignes de lots ouvertes se lisent FOR UPDATE avant le verrou', function (): void {
    $mandat = M::actif($this->org, M::lot($this->org), $this->partie);

    ($this->verifier)(fn () => M::dans($this->org, fn () => app(RenewMandate::class)->handle($mandat, new RenewMandateData($mandat->lock_version, 12))));
});

it('lit les couvertures par jointure explicite, jamais par sous-requête', function (): void {
    $lot = M::lot($this->org);
    M::actif($this->org, $lot, $this->partie);
    $lectures = [];
    DB::listen(function ($requete) use (&$lectures): void {
        $lectures[] = strtolower($requete->sql);
    });

    M::dans($this->org, fn () => app(UnitCoverages::class)->of([$lot->id]));

    $couvertures = array_values(array_filter($lectures, fn (string $sql): bool => str_contains($sql, 'from "mandate_units"')));

    expect($couvertures)->toHaveCount(1)
        ->and($couvertures[0])->toContain('inner join "mandates"')
        ->and($couvertures[0])->not->toContain('exists (');
});
