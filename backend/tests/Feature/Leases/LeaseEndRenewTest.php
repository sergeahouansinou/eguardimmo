<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseRenewed;
use App\Modules\Leases\Events\LeaseTermsRevised;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
    $this->au_terme = fn (array $attributs = []) => E::bail($this->org, ['starts_on' => '2023-11-16', 'ends_on' => '2026-11-16', ...$attributs]);
});

/**
 * @return array{component_term_id: string, amount: int, vat_bp: null, indexed: null, close: false}
 */
function leaseEndChangement(string $composante, int $centimes): array
{
    return ['component_term_id' => L::composante($composante)->id, 'amount' => $centimes, 'vat_bp' => null, 'indexed' => null, 'close' => false];
}

it('prolonge le terme de la durée du régime et incrémente la version', function (): void {
    ['bail' => $bail, 'lot' => $lot] = ($this->au_terme)();

    $renouvele = E::renouveler($this->org, $bail, E::renouvellement($bail));

    expect($renouvele->ends_on?->toDateString())->toBe('2029-11-16')
        ->and(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2029-11-16', 'version' => 2, 'status' => 'signed'])
        ->and(E::lignes($this->org, $bail)['terms'])->toBe([['from' => '2023-11-16', 'to' => null]])
        ->and(DB::table('lease_unit_locks')->where('unit_id', $lot->id)->value('last_value'))->toBe(1);
});

it('prend la durée demandée, jamais en dessous du minimum du régime', function (): void {
    ['bail' => $bail] = ($this->au_terme)();

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail, ['mois' => 12])), 'lease_period_invalid', 422);
    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-16');

    E::renouveler($this->org, $bail, E::renouvellement($bail, ['mois' => 48]));

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2030-11-16');
});

it('renouvelle avant le jour du terme un bail à terme fixe', function (): void {
    ['bail' => $bail] = ($this->au_terme)(['ends_on' => '2026-12-20']);

    E::renouveler($this->org, $bail, E::renouvellement($bail));

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2029-12-20');
});

it('révise les composantes avec la raison renewal à la date du terme, en une seule version', function (): void {
    Event::fake([LeaseRenewed::class, LeaseTermsRevised::class]);
    ['bail' => $bail, 'loyer' => $loyer] = ($this->au_terme)();

    E::renouveler($this->org, $bail, E::renouvellement($bail, ['changements' => [leaseEndChangement('rent', 66500)]]), $this->titulaire->id);

    expect(T::historique($this->org, $bail, 'rent'))->toBe([['from' => '2023-11-16', 'to' => '2026-11-16', 'amount' => 65000], ['from' => '2026-11-16', 'to' => null, 'amount' => 66500]])
        ->and(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2029-11-16', 'version' => 2])
        ->and(DB::table('lease_terms')->where('replaces_id', $loyer->id)->value('reason'))->toBe('renewal');

    Event::assertDispatched(LeaseRenewed::class, fn (LeaseRenewed $e): bool => $e->previousEndsOn === '2026-11-16' && $e->endsOn === '2029-11-16');
    Event::assertDispatched(LeaseTermsRevised::class);
});

it('annule la prolongation quand la révision des composantes est refusée', function (): void {
    Event::fake([LeaseRenewed::class]);
    ['bail' => $bail] = ($this->au_terme)();

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail, ['changements' => [leaseEndChangement('charges_provision', 5000)]])), 'lease_term_not_found', 404);

    expect(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2026-11-16', 'version' => 1]);
    Event::assertNotDispatched(LeaseRenewed::class);
});

it('refuse un bail reconduit tacitement tant que son terme n\'est pas arrivé, ou sans terme', function (): void {
    ['bail' => $sans] = ($this->au_terme)(['tacit_renewal' => true, 'ends_on' => null]);
    ['bail' => $futur] = ($this->au_terme)(['tacit_renewal' => true, 'ends_on' => '2026-12-20']);

    E::refus(fn () => E::renouveler($this->org, $sans, E::renouvellement($sans)), 'lease_renewal_not_allowed', 409);
    E::refus(fn () => E::renouveler($this->org, $futur, E::renouvellement($futur)), 'lease_renewal_not_allowed', 409);

    expect(E::champs($this->org, $futur)['ends_on'])->toBe('2026-12-20');
});

it('renouvelle un bail tacite arrivé à son terme le jour même', function (): void {
    ['bail' => $bail] = ($this->au_terme)(['tacit_renewal' => true]);

    E::renouveler($this->org, $bail, E::renouvellement($bail));

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2029-11-16');
});

it('refuse un terme dépassé', function (): void {
    ['bail' => $bail] = ($this->au_terme)(['ends_on' => '2026-11-15']);

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)), 'lease_renewal_not_allowed', 409);

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-15');
});

it('refuse un renouvellement quand un préavis est enregistré', function (): void {
    ['bail' => $bail] = ($this->au_terme)(['jurisdiction_data' => ['tense_zone' => true]]);
    $apres = E::poser($this->org, $bail, E::preavis($bail, ['recu' => '2026-11-10', 'depart' => '2026-12-20']));

    E::refus(fn () => E::renouveler($this->org, $apres, E::renouvellement($apres)), 'lease_renewal_not_allowed', 409);

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-16');
});

it('refuse de renouveler un bail mobilité arrivé à son maximum', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['regime_key' => 'fr.residential.mobility', 'starts_on' => '2026-01-16', 'duration_months' => 10, 'ends_on' => '2026-11-16']);

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail, ['mois' => 1])), 'lease_renewal_not_allowed', 409);
    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)), 'lease_renewal_not_allowed', 409);

    expect(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2026-11-16', 'version' => 1]);
});

it('borne la prolongation d\'un bail mobilité à dix mois au total', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['regime_key' => 'fr.residential.mobility', 'starts_on' => '2026-05-16', 'duration_months' => 6, 'ends_on' => '2026-11-16']);

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail, ['mois' => 5])), 'lease_renewal_not_allowed', 409);

    E::renouveler($this->org, $bail, E::renouvellement($bail, ['mois' => 4]));

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2027-03-16');
});

it('refuse quand un autre bail signé occupe le lot dès le terme, sans rien écrire', function (): void {
    Event::fake([LeaseRenewed::class]);
    ['bail' => $bail, 'lot' => $lot] = ($this->au_terme)();
    S::insererBailSigne($this->org->id, $lot->id, '2027-06-01');

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)), 'lease_overlap', 409);

    expect(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2026-11-16', 'version' => 1]);
    Event::assertNotDispatched(LeaseRenewed::class);
});

it('accepte un autre bail qui commence exactement à la nouvelle fin ou sur un autre lot', function (): void {
    ['bail' => $bail, 'lot' => $lot] = ($this->au_terme)();
    S::insererBailSigne($this->org->id, $lot->id, '2029-11-16');
    S::insererBailSigne($this->org->id, L::lot($this->org)->id, '2026-11-16');

    E::renouveler($this->org, $bail, E::renouvellement($bail));

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2029-11-16');
});

it('relit les occupations après le verrou des lots : un bail concurrent validé entre-temps est vu', function (): void {
    ['bail' => $bail, 'lot' => $lot] = ($this->au_terme)();

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::listen(function ($requete) use (&$declenchee, $niveau, $lot): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($requete->sql, 'from "lease_unit_locks"')) {
            return;
        }

        $declenchee = true;
        S::insererBailSigne($this->org->id, $lot->id, '2027-01-01');
    });

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)), 'lease_overlap', 409);

    expect($declenchee)->toBeTrue()
        ->and(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-16')
        ->and(DB::table('lease_unit_locks')->where('unit_id', $lot->id)->count())->toBe(0);
});

it('vérifie la version sur la ligne verrouillée : une écriture concurrente avant le verrou est vue', function (): void {
    ['bail' => $bail] = ($this->au_terme)();

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::beforeExecuting(function (string $sql) use (&$declenchee, $niveau, $bail): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('leases')->where('id', $bail->id)->update(['lock_version' => 5]);
    });

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail)), 'lease_stale_version', 409);

    expect($declenchee)->toBeTrue()
        ->and(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-16');
});

it('refuse une version périmée', function (): void {
    ['bail' => $bail] = ($this->au_terme)();

    E::refus(fn () => E::renouveler($this->org, $bail, E::renouvellement($bail, ['version' => 3])), 'lease_stale_version', 409);

    expect(E::champs($this->org, $bail)['version'])->toBe(1);
});

it('refuse un bail brouillon, terminé, annulé ou archivé', function (): void {
    ['bail' => $brouillon] = ($this->au_terme)(['status' => LeaseStatus::Draft, 'signed_on' => null]);
    E::refus(fn () => E::renouveler($this->org, $brouillon, E::renouvellement($brouillon)), 'lease_not_signed', 409);

    foreach ([LeaseStatus::Terminated, LeaseStatus::Cancelled] as $statut) {
        ['bail' => $clos] = ($this->au_terme)();
        E::statut($this->org, $clos, $statut);
        E::refus(fn () => E::renouveler($this->org, $clos, E::renouvellement($clos)), 'lease_already_terminated', 409);
    }

    ['bail' => $archive] = ($this->au_terme)(['archived_at' => now()]);
    E::refus(fn () => E::renouveler($this->org, $archive, E::renouvellement($archive)), 'lease_archived', 409);
});

it('cloisonne par organisation', function (): void {
    ['bail' => $bail] = ($this->au_terme)();
    $autre = L::organisation();

    E::refus(fn () => E::renouveler($autre, $bail, E::renouvellement($bail)), 'lease_not_found', 404);

    expect(E::champs($this->org, $bail)['ends_on'])->toBe('2026-11-16');
});

it('émet l\'événement après le commit, identifiants et dates seulement', function (): void {
    $vus = [];
    Event::listen(LeaseRenewed::class, function (LeaseRenewed $e) use (&$vus): void {
        $vus[] = [$e->leaseId, $e->organizationId, $e->previousEndsOn, $e->endsOn, DB::transactionLevel()];
    });
    ['bail' => $bail] = ($this->au_terme)();
    $niveau = DB::transactionLevel();

    DB::transaction(function () use ($bail, &$vus): void {
        E::renouveler($this->org, $bail, E::renouvellement($bail));

        expect($vus)->toBe([]);
    });

    expect($vus)->toBe([[$bail->id, $this->org->id, '2026-11-16', '2029-11-16', $niveau]]);
});

it('journalise le renouvellement avec l\'auteur transmis', function (): void {
    ['bail' => $bail] = ($this->au_terme)();

    E::renouveler($this->org, $bail, E::renouvellement($bail), $this->titulaire->id);

    $journal = AuditLog::query()->where('subject_id', $bail->id)->where('action', 'leases.lease.renewed')->firstOrFail();

    expect($journal->actor_user_id)->toBe($this->titulaire->id)
        ->and($journal->metadata)->toBe(['previous_ends_on' => '2026-11-16', 'ends_on' => '2029-11-16', 'terms_revised' => 0])
        ->and(AuditLog::query()->where('subject_id', $bail->id)->where('action', 'like', '%updated')->exists())->toBeTrue();
});
