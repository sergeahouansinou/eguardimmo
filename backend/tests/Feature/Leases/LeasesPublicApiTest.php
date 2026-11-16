<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\Data\OccupancyData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\MissingOrganizationContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->autre = L::organisation();
});

function leasePubDate(string $jour): CarbonImmutable
{
    return CarbonImmutable::parse($jour);
}

function leasePubCode(Closure $appel): string
{
    try {
        $appel();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return 'aucune erreur';
}

/**
 * @param  array<string, mixed>  $attributs
 */
function leasePubBail(object $org, array $attributs = []): Lease
{
    return L::bail($org, ['status' => LeaseStatus::Signed, 'signed_on' => '2025-12-15', ...$attributs]);
}

function leasePubLot(object $org, Lease $bail, string $unitId, string $de = '2026-01-01', ?string $a = null, bool $principal = true): LeaseUnit
{
    return L::dans($org, fn (): LeaseUnit => LeaseUnit::factory()->create([
        'lease_id' => $bail->id, 'unit_id' => $unitId, 'valid_from' => $de, 'valid_to' => $a, 'is_main' => $principal,
    ]));
}

function leasePubLigne(object $org, Lease $bail, string $cle, int $centimes, string $de = '2026-01-01', ?string $a = null): LeaseTerm
{
    return L::dans($org, fn (): LeaseTerm => LeaseTerm::factory()->create([
        'lease_id' => $bail->id,
        'component_term_id' => L::composante($cle)->id,
        'amount' => Money::EUR($centimes),
        'valid_from' => $de,
        'valid_to' => $a,
    ]));
}

function leasePubPartie(object $org, Lease $bail, LeasePartyRole $role, string $de = '2026-01-01', ?string $a = null): LeaseParty
{
    return L::dans($org, fn (): LeaseParty => LeaseParty::factory()->create([
        'lease_id' => $bail->id, 'party_id' => Str::uuid7()->toString(), 'role' => $role, 'valid_from' => $de, 'valid_to' => $a,
    ]));
}

it('lit un bail avec ses lots, le principal d\'abord, sans exposer de modèle', function (): void {
    $bail = leasePubBail($this->org, ['reference' => 'BL-2026-0010', 'ends_on' => '2029-01-01']);
    $annexe = Str::uuid7()->toString();
    $principal = Str::uuid7()->toString();
    leasePubLot($this->org, $bail, $annexe, principal: false);
    leasePubLot($this->org, $bail, $principal);

    $donnee = L::dans($this->org, fn (): LeaseData => app(LeaseDirectory::class)->find($bail->id));

    expect($donnee)->toBeInstanceOf(LeaseData::class)
        ->and($donnee->id)->toBe($bail->id)
        ->and($donnee->reference)->toBe('BL-2026-0010')
        ->and($donnee->status)->toBe(LeaseStatus::Signed)
        ->and($donnee->startsOn)->toBe('2026-01-01')
        ->and($donnee->endsOn)->toBe('2029-01-01')
        ->and($donnee->signedOn)->toBe('2025-12-15')
        ->and($donnee->dueDay)->toBe(5)
        ->and($donnee->currency)->toBe('EUR')
        ->and($donnee->isArchived)->toBeFalse()
        ->and(array_map(fn ($lot): string => $lot->unitId, $donnee->units))->toBe([$principal, $annexe])
        ->and($donnee->units[0]->isMain)->toBeTrue()
        ->and($donnee->units[1]->isMain)->toBeFalse();
});

it('lit plusieurs baux dans l\'ordre demandé, sans doublon, et refuse l\'ensemble si un seul est inconnu', function (): void {
    $a = leasePubBail($this->org);
    $b = leasePubBail($this->org);

    $baux = L::dans($this->org, fn (): array => app(LeaseDirectory::class)->findMany([$b->id, $a->id, $b->id]));

    expect(array_map(fn (LeaseData $bail): string => $bail->id, $baux))->toBe([$b->id, $a->id])
        ->and(L::dans($this->org, fn (): array => app(LeaseDirectory::class)->findMany([])))->toBe([])
        ->and(leasePubCode(fn () => L::dans($this->org, fn () => app(LeaseDirectory::class)->findMany([$a->id, fake()->uuid()]))))->toBe('lease_not_found')
        ->and(leasePubCode(fn () => L::dans($this->org, fn () => app(LeaseDirectory::class)->findMany([$a->id, 'pas-un-uuid']))))->toBe('lease_not_found');
});

it('refuse par lease_not_found le bail d\'une autre organisation, partout', function (): void {
    $bail = leasePubBail($this->org);
    $jour = leasePubDate('2026-06-01');

    $appels = [
        fn () => app(LeaseDirectory::class)->find($bail->id),
        fn () => app(LeaseDirectory::class)->findMany([$bail->id]),
        fn () => app(LeaseSchedule::class)->billing($bail->id),
        fn () => app(LeaseSchedule::class)->linesBetween($bail->id, $jour, $jour),
        fn () => app(LeaseParticipants::class)->partiesOf($bail->id),
        fn () => app(LeaseParticipants::class)->tenantsAt($bail->id, $jour),
    ];

    foreach ($appels as $appel) {
        expect(leasePubCode(fn () => L::dans($this->autre, $appel)))->toBe('lease_not_found')
            ->and(leasePubCode(fn () => L::dans($this->org, $appel)))->toBe('aucune erreur');
    }

    expect(leasePubCode(fn () => L::dans($this->autre, fn () => app(LeaseDirectory::class)->find(fake()->uuid()))))->toBe('lease_not_found')
        ->and(leasePubCode(fn () => L::dans($this->autre, fn () => app(LeaseDirectory::class)->find('pas-un-uuid'))))->toBe('lease_not_found');
});

it('lève l\'exception du cloisonnement sans contexte d\'organisation', function (): void {
    $bail = leasePubBail($this->org);
    $jour = leasePubDate('2026-06-01');

    $appels = [
        'find' => fn () => app(LeaseDirectory::class)->find($bail->id),
        'find non uuid' => fn () => app(LeaseDirectory::class)->find('pas-un-uuid'),
        'findMany' => fn () => app(LeaseDirectory::class)->findMany([$bail->id]),
        'findMany vide' => fn () => app(LeaseDirectory::class)->findMany([]),
        'occupancyAt' => fn () => app(LeaseDirectory::class)->occupancyAt([Str::uuid7()->toString()], $jour),
        'occupancyAt vide' => fn () => app(LeaseDirectory::class)->occupancyAt([], $jour),
        'billing' => fn () => app(LeaseSchedule::class)->billing($bail->id),
        'linesBetween' => fn () => app(LeaseSchedule::class)->linesBetween($bail->id, $jour, $jour),
        'activeBetween' => fn () => app(LeaseSchedule::class)->activeBetween($jour, $jour, null, 10),
        'partiesOf' => fn () => app(LeaseParticipants::class)->partiesOf($bail->id),
        'tenantsAt' => fn () => app(LeaseParticipants::class)->tenantsAt($bail->id, $jour),
    ];

    foreach ($appels as $nom => $appel) {
        expect($appel, $nom)->toThrow(MissingOrganizationContext::class);
    }
});

it('donne les baux signés qui occupent un lot, périodes semi-ouvertes à la veille, au jour et au lendemain', function (): void {
    $lot = Str::uuid7()->toString();
    $libre = Str::uuid7()->toString();
    $bail = leasePubBail($this->org, ['reference' => 'BL-2026-0020', 'starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    leasePubLot($this->org, $bail, $lot, '2026-03-01', '2026-09-01');
    $quand = fn (string $jour, ?array $lots = null): array => L::dans($this->org, fn (): array => app(LeaseDirectory::class)->occupancyAt($lots ?? [$lot, $libre], leasePubDate($jour)));

    expect($quand('2026-02-28'))->toBe([])
        ->and($quand('2026-03-01'))->toHaveCount(1)
        ->and($quand('2026-08-31'))->toHaveCount(1)
        ->and($quand('2026-09-01'))->toBe([])
        ->and($quand('2026-06-01', []))->toBe([]);

    $occupation = $quand('2026-06-01')[0];

    expect($occupation)->toBeInstanceOf(OccupancyData::class)
        ->and($occupation->unitId)->toBe($lot)
        ->and($occupation->leaseId)->toBe($bail->id)
        ->and($occupation->leaseReference)->toBe('BL-2026-0020')
        ->and($occupation->isMain)->toBeTrue()
        ->and($occupation->validFrom)->toBe('2026-03-01')
        ->and($occupation->validTo)->toBe('2026-09-01');
});

it('n\'occupe pas un lot par un bail brouillon, clos, terminé, hors de sa période ou d\'une autre organisation', function (): void {
    $lot = Str::uuid7()->toString();
    $brouillon = L::bail($this->org);
    $termine = leasePubBail($this->org, ['status' => LeaseStatus::Terminated, 'ends_on' => '2026-05-01']);
    $fini = leasePubBail($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2026-06-01']);
    $parti = leasePubBail($this->org, ['notice_received_on' => '2026-04-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-06-01', 'termination_reason' => 'Mutation']);
    $futur = leasePubBail($this->org, ['starts_on' => '2026-07-01', 'ends_on' => '2029-07-01']);
    $etranger = leasePubBail($this->autre);

    foreach ([[$brouillon, $this->org], [$termine, $this->org], [$fini, $this->org], [$parti, $this->org], [$futur, $this->org], [$etranger, $this->autre]] as [$bail, $org]) {
        leasePubLot($org, $bail, $lot, '2024-01-01');
    }

    $quand = fn (string $jour): array => L::dans($this->org, fn (): array => app(LeaseDirectory::class)->occupancyAt([$lot], leasePubDate($jour)));

    expect($quand('2026-05-31'))->toHaveCount(0 + 2)
        ->and(array_map(fn (OccupancyData $o): string => $o->leaseId, $quand('2026-05-31')))->toEqualCanonicalizing([$fini->id, $parti->id])
        ->and(array_map(fn (OccupancyData $o): string => $o->leaseId, $quand('2026-06-01')))->toBe([])
        ->and(array_map(fn (OccupancyData $o): string => $o->leaseId, $quand('2026-07-01')))->toBe([$futur->id]);
});

it('expose les modalités de facturation avec la fin effective, le plus tôt de la fin du bail et du départ annoncé', function (): void {
    $simple = leasePubBail($this->org, ['due_day' => 10, 'billing_timing' => 'arrears', 'periodicity' => 'quarterly', 'ends_on' => '2029-01-01']);
    $parti = leasePubBail($this->org, ['ends_on' => '2029-01-01', 'notice_received_on' => '2026-04-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-07-01', 'termination_reason' => 'Mutation']);
    $sansFin = leasePubBail($this->org, ['ends_on' => null]);
    $api = fn (Lease $bail): LeaseBillingData => L::dans($this->org, fn (): LeaseBillingData => app(LeaseSchedule::class)->billing($bail->id));

    expect($api($simple))->toBeInstanceOf(LeaseBillingData::class)
        ->and($api($simple)->dueDay)->toBe(10)
        ->and($api($simple)->billingTiming->value)->toBe('arrears')
        ->and($api($simple)->periodicity->value)->toBe('quarterly')
        ->and($api($simple)->currency)->toBe('EUR')
        ->and($api($simple)->startsOn)->toBe('2026-01-01')
        ->and($api($simple)->status)->toBe(LeaseStatus::Signed)
        ->and($api($simple)->effectiveEndsOn)->toBe('2029-01-01')
        ->and($api($parti)->effectiveEndsOn)->toBe('2026-07-01')
        ->and($api($sansFin)->effectiveEndsOn)->toBeNull();
});

it('donne les lignes de composantes en vigueur avec leur sens système et leur somme', function (): void {
    $bail = leasePubBail($this->org);
    leasePubLigne($this->org, $bail, 'rent', 65000);
    leasePubLigne($this->org, $bail, 'charges_provision', 8000);
    leasePubLigne($this->org, $bail, 'deposit', 65000);

    $lignes = L::dans($this->org, fn (): array => app(LeaseSchedule::class)->linesBetween($bail->id, leasePubDate('2026-03-01'), leasePubDate('2026-03-31')));
    $parSens = collect($lignes)->mapWithKeys(fn (LeaseTermLineData $l): array => [$l->semantic->value => $l->amount->getAmount()])->all();
    $appele = array_reduce(
        array_filter($lignes, fn (LeaseTermLineData $l): bool => in_array($l->semantic, [LeaseComponentSemantic::Rent, LeaseComponentSemantic::ChargesProvision], true)),
        fn (Money $somme, LeaseTermLineData $l): Money => $somme->add($l->amount),
        Money::EUR(0),
    );

    expect($lignes)->toHaveCount(3)
        ->and($lignes[0])->toBeInstanceOf(LeaseTermLineData::class)
        ->and($parSens)->toEqual(['rent' => '65000', 'charges_provision' => '8000', 'deposit' => '65000'])
        ->and($appele->equals(Money::EUR(73000)))->toBeTrue()
        ->and(collect($lignes)->pluck('componentKey')->sort()->values()->all())->toBe(['charges_provision', 'deposit', 'rent'])
        ->and($lignes[0]->leaseId)->toBe($bail->id)
        ->and($lignes[0]->vatBp)->toBe(0)
        ->and($lignes[0]->validFrom)->toBe('2026-01-01')
        ->and($lignes[0]->validTo)->toBeNull();
});

it('applique la période semi-ouverte aux lignes : veille, jour et lendemain de la révision', function (): void {
    $bail = leasePubBail($this->org);
    leasePubLigne($this->org, $bail, 'rent', 65000, '2026-01-01', '2026-07-01');
    leasePubLigne($this->org, $bail, 'rent', 67000, '2026-07-01');
    $au = fn (string $de, string $a): array => L::dans($this->org, fn (): array => app(LeaseSchedule::class)->linesBetween($bail->id, leasePubDate($de), leasePubDate($a)));
    $montants = fn (array $lignes): array => array_map(fn (LeaseTermLineData $l): string => $l->amount->getAmount(), $lignes);

    expect($montants($au('2026-06-30', '2026-06-30')))->toBe(['65000'])
        ->and($montants($au('2026-07-01', '2026-07-01')))->toBe(['67000'])
        ->and($montants($au('2026-07-02', '2026-07-02')))->toBe(['67000'])
        ->and($montants($au('2026-06-01', '2026-06-30')))->toBe(['65000'])
        ->and($montants($au('2026-06-01', '2026-07-01')))->toBe(['65000', '67000'])
        ->and($montants($au('2025-12-01', '2025-12-31')))->toBe([])
        ->and(leasePubCode(fn () => $au('2026-07-02', '2026-07-01')))->toBe('lease_period_invalid');
});

it('parcourt les baux signés actifs par identifiant croissant, par pages', function (): void {
    $baux = [];

    foreach (range(1, 5) as $i) {
        $baux[] = leasePubBail($this->org);
    }

    leasePubBail($this->org, ['status' => LeaseStatus::Draft, 'signed_on' => null]);
    leasePubBail($this->org, ['status' => LeaseStatus::Terminated, 'ends_on' => '2026-05-01']);
    leasePubBail($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2026-01-01']);
    leasePubBail($this->org, ['starts_on' => '2026-08-01', 'ends_on' => '2029-08-01']);
    leasePubBail($this->autre);
    $attendus = collect($baux)->pluck('id')->sort()->values()->all();
    $page = fn (?string $apres, int $limite): array => L::dans($this->org, fn (): array => app(LeaseSchedule::class)->activeBetween(leasePubDate('2026-06-01'), leasePubDate('2026-06-30'), $apres, $limite));

    $premiere = $page(null, 2);
    $deuxieme = $page($premiere[1]->leaseId, 2);
    $troisieme = $page($deuxieme[1]->leaseId, 2);
    $vide = $page($troisieme[0]->leaseId, 2);
    $ids = fn (array $p): array => array_map(fn (LeaseBillingData $b): string => $b->leaseId, $p);

    expect($premiere)->toHaveCount(2)
        ->and($premiere[0])->toBeInstanceOf(LeaseBillingData::class)
        ->and($deuxieme)->toHaveCount(2)
        ->and($troisieme)->toHaveCount(1)
        ->and($vide)->toBe([])
        ->and([...$ids($premiere), ...$ids($deuxieme), ...$ids($troisieme)])->toBe($attendus)
        ->and(leasePubCode(fn () => $page('pas-un-uuid', 2)))->toBe('lease_not_found')
        ->and(leasePubCode(fn () => L::dans($this->org, fn () => app(LeaseSchedule::class)->activeBetween(leasePubDate('2026-06-30'), leasePubDate('2026-06-01'), null, 2))))->toBe('lease_period_invalid');
});

it('exclut des baux actifs celui dont la fin ou le départ tombe au début de l\'intervalle', function (): void {
    $fin = leasePubBail($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2026-06-01']);
    $depart = leasePubBail($this->org, ['notice_received_on' => '2026-04-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-06-01', 'termination_reason' => 'Mutation']);
    $dedans = leasePubBail($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2026-06-02']);
    $actifs = fn (string $de, string $a): array => array_map(
        fn (LeaseBillingData $b): string => $b->leaseId,
        L::dans($this->org, fn (): array => app(LeaseSchedule::class)->activeBetween(leasePubDate($de), leasePubDate($a), null, 50)),
    );

    expect($actifs('2026-06-01', '2026-06-30'))->toBe([$dedans->id])
        ->and($actifs('2026-05-31', '2026-05-31'))->toEqualCanonicalizing([$fin->id, $depart->id, $dedans->id]);
});

it('donne les parties du bail, et les locataires présents à une date sans ceux qui sont sortis', function (): void {
    $bail = leasePubBail($this->org);
    $reste = leasePubPartie($this->org, $bail, LeasePartyRole::Tenant);
    $sort = leasePubPartie($this->org, $bail, LeasePartyRole::Tenant, '2026-01-01', '2026-06-01');
    $arrive = leasePubPartie($this->org, $bail, LeasePartyRole::Tenant, '2026-06-01');
    $garant = leasePubPartie($this->org, $bail, LeasePartyRole::Guarantor);
    $occupant = leasePubPartie($this->org, $bail, LeasePartyRole::Occupant);
    $locataires = fn (string $jour): array => array_map(
        fn (LeasePartyData $p): string => $p->partyId,
        L::dans($this->org, fn (): array => app(LeaseParticipants::class)->tenantsAt($bail->id, leasePubDate($jour))),
    );

    $toutes = L::dans($this->org, fn (): array => app(LeaseParticipants::class)->partiesOf($bail->id));

    expect($toutes)->toHaveCount(5)
        ->and($toutes[0])->toBeInstanceOf(LeasePartyData::class)
        ->and(array_map(fn (LeasePartyData $p): string => $p->partyId, $toutes))->toEqualCanonicalizing(array_map(fn (LeaseParty $p): string => $p->party_id, [$reste, $sort, $arrive, $garant, $occupant]))
        ->and($locataires('2026-05-31'))->toEqualCanonicalizing([$reste->party_id, $sort->party_id])
        ->and($locataires('2026-06-01'))->toEqualCanonicalizing([$reste->party_id, $arrive->party_id])
        ->and($locataires('2025-12-31'))->toBe([]);
});

it('lit la garantie d\'un garant avec son plafond en montant et devise', function (): void {
    $bail = leasePubBail($this->org);
    $locataire = leasePubPartie($this->org, $bail, LeasePartyRole::Tenant);
    $garant = L::dans($this->org, fn (): LeaseParty => LeaseParty::factory()->create([
        'lease_id' => $bail->id,
        'party_id' => Str::uuid7()->toString(),
        'role' => LeasePartyRole::Guarantor,
        'guarantees_party_id' => $locataire->party_id,
        'guarantee_limit_amount' => Money::EUR(1200000),
        'guarantee_ends_on' => '2029-01-01',
    ]));

    $lignes = L::dans($this->org, fn (): array => app(LeaseParticipants::class)->partiesOf($bail->id));
    $caution = collect($lignes)->firstWhere('partyId', $garant->party_id);

    expect($caution->role)->toBe(LeasePartyRole::Guarantor)
        ->and($caution->guaranteesPartyId)->toBe($locataire->party_id)
        ->and($caution->guaranteeLimit->equals(Money::EUR(1200000)))->toBeTrue()
        ->and($caution->guaranteeEndsOn)->toBe('2029-01-01')
        ->and(collect($lignes)->firstWhere('partyId', $locataire->party_id)->guaranteeLimit)->toBeNull();
});

it('ne laisse fuiter aucun modèle : types de retour et valeurs renvoyées', function (): void {
    $bail = leasePubBail($this->org);
    leasePubLot($this->org, $bail, Str::uuid7()->toString());
    leasePubLigne($this->org, $bail, 'rent', 65000);
    leasePubPartie($this->org, $bail, LeasePartyRole::Tenant);
    $jour = leasePubDate('2026-06-01');

    $estModele = function (mixed $valeur) use (&$estModele): bool {
        return match (true) {
            $valeur instanceof Model => true,
            is_array($valeur) => array_filter($valeur, $estModele) !== [],
            is_object($valeur) && str_starts_with($valeur::class, 'App\\Modules\\') => array_filter(get_object_vars($valeur), $estModele) !== [],
            default => false,
        };
    };

    $retours = L::dans($this->org, fn (): array => [
        app(LeaseDirectory::class)->find($bail->id),
        app(LeaseDirectory::class)->findMany([$bail->id]),
        app(LeaseDirectory::class)->occupancyAt([Str::uuid7()->toString()], $jour),
        app(LeaseSchedule::class)->billing($bail->id),
        app(LeaseSchedule::class)->linesBetween($bail->id, $jour, $jour),
        app(LeaseSchedule::class)->activeBetween($jour, $jour, null, 10),
        app(LeaseParticipants::class)->partiesOf($bail->id),
        app(LeaseParticipants::class)->tenantsAt($bail->id, $jour),
    ]);

    expect(array_filter($retours, $estModele))->toBe([]);

    foreach ([LeaseDirectory::class, LeaseSchedule::class, LeaseParticipants::class] as $classe) {
        foreach ((new ReflectionClass($classe))->getMethods(ReflectionMethod::IS_PUBLIC) as $methode) {
            $type = (string) $methode->getReturnType();

            if ($methode->isConstructor()) {
                continue;
            }

            expect(is_a($type, Model::class, true), "{$classe}::{$methode->getName()}")->toBeFalse();
            expect($type === 'array' || str_starts_with($type, 'App\\Modules\\Leases\\Data\\'), "{$classe}::{$methode->getName()} renvoie {$type}")->toBeTrue();
        }
    }

    foreach ([LeaseData::class, LeaseBillingData::class, LeaseTermLineData::class, LeasePartyData::class, OccupancyData::class] as $dto) {
        foreach ((new ReflectionClass($dto))->getProperties() as $propriete) {
            $type = (string) $propriete->getType();
            expect(is_a(ltrim($type, '?'), Model::class, true), "{$dto}::{$propriete->getName()}")->toBeFalse();
        }
    }
});
