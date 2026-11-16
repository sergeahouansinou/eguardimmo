<?php

declare(strict_types=1);

use App\Modules\Leases\Actions\SignLease;
use App\Modules\Leases\Data\SignLeaseData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Events\LeaseTerminated;
use App\Modules\Leases\Models\LeaseTerm;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

it('résilie à la date de départ du préavis : statut, fin, lignes fermées, version', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    $resilie = E::resilier($this->org, $apres, E::fin($apres));
    $champs = E::champs($this->org, $bail);
    $lignes = E::lignes($this->org, $bail);

    expect($resilie->status)->toBe(LeaseStatus::Terminated)
        ->and($champs)->toMatchArray(['status' => 'terminated', 'ends_on' => '2027-02-10', 'version' => 3, 'departure_on' => '2027-02-10', 'given_by' => 'tenant'])
        ->and($lignes['units'])->toBe([['from' => '2026-01-01', 'to' => '2027-02-10']])
        ->and($lignes['parties'])->toBe([['from' => '2026-01-01', 'to' => '2027-02-10']])
        ->and($lignes['terms'])->toBe([['from' => '2026-01-01', 'to' => '2027-02-10']]);
});

it('ne touche pas aux lignes passées et ne supprime rien', function (): void {
    ['bail' => $bail, 'lot' => $lot, 'loyer' => $loyer] = E::bail($this->org);
    $ancien = L::lot($this->org);
    R::occuper($this->org, $bail, $ancien, ['is_main' => false, 'valid_from' => '2026-01-01', 'valid_to' => '2026-03-01']);
    R::terme($this->org, $bail, 'charges_provision', ['valid_from' => '2026-01-01', 'valid_to' => '2026-06-01']);
    $avant = E::lignes($this->org, $bail);

    $apres = E::poser($this->org, $bail, E::preavis($bail));
    E::resilier($this->org, $apres, E::fin($apres));
    $lignes = E::lignes($this->org, $bail);

    expect($avant['units'])->toHaveCount(2)
        ->and($lignes['units'])->toBe([['from' => '2026-01-01', 'to' => '2026-03-01'], ['from' => '2026-01-01', 'to' => '2027-02-10']])
        ->and($lignes['terms'])->toBe([['from' => '2026-01-01', 'to' => '2026-06-01'], ['from' => '2026-01-01', 'to' => '2027-02-10']])
        ->and(DB::table('lease_units')->where('lease_id', $bail->id)->count())->toBe(2)
        ->and(DB::table('lease_parties')->where('lease_id', $bail->id)->count())->toBe(1)
        ->and(DB::table('lease_terms')->where('lease_id', $bail->id)->count())->toBe(2)
        ->and($lot->id)->not->toBe($ancien->id)
        ->and(L::dans($this->org, fn () => LeaseTerm::query()->findOrFail($loyer->id)->valid_to?->toDateString()))->toBe('2027-02-10');
});

it('ferme à la date de fin une ligne dont la fin prévue la dépasse', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    R::terme($this->org, $bail, 'charges_provision', ['valid_from' => '2026-01-01', 'valid_to' => '2028-01-01']);

    $apres = E::poser($this->org, $bail, E::preavis($bail));
    E::resilier($this->org, $apres, E::fin($apres));

    expect(E::lignes($this->org, $bail)['terms'])->toBe([['from' => '2026-01-01', 'to' => '2027-02-10'], ['from' => '2026-01-01', 'to' => '2027-02-10']]);
});

it('libère les lots à la date de fin : un autre bail peut alors être signé', function (): void {
    ['bail' => $bail, 'lot' => $lot] = E::bail($this->org, ['tacit_renewal' => true, 'ends_on' => null]);
    ['bail' => $suivant] = S::brouillon($this->org, ['starts_on' => '2027-02-10', 'duration_months' => 36, 'tacit_renewal' => false], $lot);
    $signer = fn () => L::dans($this->org, fn () => app(SignLease::class)->handle($suivant, new SignLeaseData('2026-11-10', null, $suivant->lock_version)));

    E::refus($signer, 'lease_overlap', 409);

    $apres = E::poser($this->org, $bail, E::preavis($bail));
    E::resilier($this->org, $apres, E::fin($apres));

    expect($signer()->status)->toBe(LeaseStatus::Signed);
});

it('résilie à une date plus tardive que le départ du préavis', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::resilier($this->org, $apres, E::fin($apres, ['fin' => '2027-03-31']));

    expect(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2027-03-31', 'departure_on' => '2027-03-31']);
});

it('prend par défaut le terme du bail quand le départ du préavis le dépasse', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['ends_on' => '2027-01-15']);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::resilier($this->org, $apres, E::fin($apres));

    expect(E::champs($this->org, $bail))->toMatchArray(['ends_on' => '2027-01-15', 'status' => 'terminated']);
});

it('refuse une date antérieure au préavis légal sans résiliation amiable explicite, l\'accepte avec motif', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::refus(fn () => E::resilier($this->org, $apres, E::fin($apres, ['fin' => '2027-01-31'])), 'lease_notice_invalid', 422);
    E::refus(fn () => E::resilier($this->org, $apres, E::fin($apres, ['fin' => '2027-01-31', 'amiable' => true])), 'lease_notice_invalid', 422);

    expect(E::champs($this->org, $bail)['status'])->toBe('signed')
        ->and(E::lignes($this->org, $bail)['units'])->toBe([['from' => '2026-01-01', 'to' => null]]);

    E::resilier($this->org, $apres, E::fin($apres, ['fin' => '2027-01-31', 'amiable' => true, 'motif' => 'Accord amiable des parties']));

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'ends_on' => '2027-01-31', 'departure_on' => '2027-01-31', 'reason' => 'Accord amiable des parties']);
});

it('refuse sans préavis une résiliation qui n\'est pas amiable ou sans date', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail)), 'lease_period_invalid', 422);
    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-01-31'])), 'lease_notice_invalid', 422);
    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-01-31', 'amiable' => true, 'par' => NoticeGivenBy::Tenant])), 'lease_notice_invalid', 422);
    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-01-31', 'amiable' => true, 'motif' => 'Accord'])), 'lease_notice_invalid', 422);

    expect(E::champs($this->org, $bail)['status'])->toBe('signed');
});

it('enregistre une résiliation amiable sans préavis avec ses quatre champs ensemble', function (): void {
    ['bail' => $bail] = E::bail($this->org);

    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-01-31', 'amiable' => true, 'motif' => 'Accord des parties', 'par' => NoticeGivenBy::Landlord]));

    expect(E::champs($this->org, $bail))->toBe([
        'status' => 'terminated', 'version' => 2, 'given_by' => 'landlord', 'received_on' => '2026-11-16', 'departure_on' => '2027-01-31',
        'reason' => 'Accord des parties', 'ends_on' => '2027-01-31',
    ]);
});

it('refuse une fin qui ne suit pas le début, dépasse le terme ou précède une ligne programmée', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    R::terme($this->org, $bail, 'rent', ['valid_from' => '2027-06-01']);

    foreach (['2026-01-01', '2025-12-31', '2029-01-02', '2027-06-01'] as $fin) {
        E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail, ['fin' => $fin, 'amiable' => true, 'motif' => 'Accord', 'par' => NoticeGivenBy::Tenant])), 'lease_period_invalid', 422);
    }

    expect(E::champs($this->org, $bail)['status'])->toBe('signed')
        ->and(E::lignes($this->org, $bail)['units'])->toBe([['from' => '2026-01-01', 'to' => null]]);
});

it('refuse un bail déjà terminé sans rien modifier', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));
    $resilie = E::resilier($this->org, $apres, E::fin($apres));
    $avant = [E::champs($this->org, $bail), E::lignes($this->org, $bail)];

    E::refus(fn () => E::resilier($this->org, $resilie, E::fin($resilie, ['fin' => '2027-01-01', 'amiable' => true, 'motif' => 'Accord', 'par' => NoticeGivenBy::Tenant])), 'lease_already_terminated', 409);

    expect([E::champs($this->org, $bail), E::lignes($this->org, $bail)])->toBe($avant);
});

it('refuse un bail brouillon, annulé ou archivé', function (): void {
    ['bail' => $brouillon] = E::bail($this->org, ['status' => LeaseStatus::Draft, 'signed_on' => null]);
    E::refus(fn () => E::resilier($this->org, $brouillon, E::fin($brouillon, ['fin' => '2027-01-31'])), 'lease_not_signed', 409);

    ['bail' => $annule] = E::bail($this->org);
    E::statut($this->org, $annule, LeaseStatus::Cancelled);
    E::refus(fn () => E::resilier($this->org, $annule, E::fin($annule, ['fin' => '2027-01-31'])), 'lease_already_terminated', 409);

    ['bail' => $archive] = E::bail($this->org, ['archived_at' => now()]);
    E::refus(fn () => E::resilier($this->org, $archive, E::fin($archive, ['fin' => '2027-01-31'])), 'lease_archived', 409);
});

it('refuse une version périmée', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    E::refus(fn () => E::resilier($this->org, $apres, E::fin($apres, ['version' => 1])), 'lease_stale_version', 409);

    expect(E::champs($this->org, $bail)['status'])->toBe('signed');
});

it('vérifie la version sur la ligne verrouillée : une écriture concurrente avant le verrou est vue', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));

    $niveau = DB::transactionLevel();
    $declenchee = false;
    DB::beforeExecuting(function (string $sql) use (&$declenchee, $niveau, $bail): void {
        if ($declenchee || DB::transactionLevel() <= $niveau || ! str_contains($sql, 'from "leases"')) {
            return;
        }

        $declenchee = true;
        DB::table('leases')->where('id', $bail->id)->update(['lock_version' => 9]);
    });

    E::refus(fn () => E::resilier($this->org, $apres, E::fin($apres)), 'lease_stale_version', 409);

    expect($declenchee)->toBeTrue()
        ->and(E::champs($this->org, $bail)['status'])->toBe('signed')
        ->and(E::lignes($this->org, $bail)['units'])->toBe([['from' => '2026-01-01', 'to' => null]]);
});

it('cloisonne par organisation', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));
    $autre = L::organisation();

    E::refus(fn () => E::resilier($autre, $apres, E::fin($apres)), 'lease_not_found', 404);

    expect(E::champs($this->org, $bail)['status'])->toBe('signed');
});

it('émet l\'événement après le commit avec les seuls identifiants et la date de fin', function (): void {
    $vus = [];
    Event::listen(LeaseTerminated::class, function (LeaseTerminated $e) use (&$vus): void {
        $vus[] = [$e->leaseId, $e->organizationId, $e->endsOn, DB::transactionLevel()];
    });
    ['bail' => $bail] = E::bail($this->org);
    $apres = E::poser($this->org, $bail, E::preavis($bail));
    $niveau = DB::transactionLevel();

    DB::transaction(function () use ($apres, &$vus): void {
        E::resilier($this->org, $apres, E::fin($apres));

        expect($vus)->toBe([]);
    });

    expect($vus)->toBe([[$bail->id, $this->org->id, '2027-02-10', $niveau]]);
});

it('n\'émet rien quand la résiliation est refusée', function (): void {
    Event::fake([LeaseTerminated::class]);
    ['bail' => $bail] = E::bail($this->org);

    E::refus(fn () => E::resilier($this->org, $bail, E::fin($bail)), 'lease_period_invalid', 422);

    Event::assertNotDispatched(LeaseTerminated::class);
});

it('journalise la résiliation et les lignes fermées, motif masqué', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    E::resilier($this->org, $bail, E::fin($bail, ['fin' => '2027-01-31', 'amiable' => true, 'motif' => 'Motif confidentiel amiable', 'par' => NoticeGivenBy::Tenant]));

    $journal = AuditLog::query()->where('subject_id', $bail->id)->where('action', 'leases.lease.terminated')->firstOrFail();

    expect($journal->metadata)->toBe(['ends_on' => '2027-01-31', 'amicable' => true, 'closed' => ['units' => 1, 'parties' => 1, 'terms' => 1]])
        ->and(AuditLog::query()->where('subject_id', $bail->id)->where('action', 'like', '%updated')->exists())->toBeTrue()
        ->and(AuditLog::query()->get()->toJson())->not->toContain('Motif confidentiel amiable');
});
