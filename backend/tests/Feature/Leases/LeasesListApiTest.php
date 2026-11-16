<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\LeasePhaseResolver;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

/**
 * @return array<string, Lease>
 */
function leaseReadPhases(object $test): array
{
    $preavis = ['notice_given_by' => 'tenant', 'notice_departure_on' => '2027-02-01', 'termination_reason' => 'Mutation professionnelle'];

    return [
        'draft' => L::bail($test->org, ['reference' => 'BL-2026-0001']),
        'upcoming' => R::bailSigne($test->org, ['reference' => 'BL-2026-0002', 'starts_on' => '2026-12-01', 'ends_on' => '2029-12-01']),
        'running' => R::bailSigne($test->org, ['reference' => 'BL-2026-0003', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']),
        'running-ouvert' => R::bailSigne($test->org, ['reference' => 'BL-2026-0004', 'starts_on' => '2026-11-16', 'ends_on' => null]),
        'running-fin-demain' => R::bailSigne($test->org, ['reference' => 'BL-2026-0005', 'starts_on' => '2026-01-01', 'ends_on' => '2026-11-17']),
        'running-preavis-futur' => R::bailSigne($test->org, ['reference' => 'BL-2026-0006', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'notice_received_on' => '2026-11-17', ...$preavis]),
        'notice' => R::bailSigne($test->org, ['reference' => 'BL-2026-0007', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'notice_received_on' => '2026-11-16', ...$preavis]),
        'ended-borne' => R::bailSigne($test->org, ['reference' => 'BL-2026-0008', 'starts_on' => '2026-01-01', 'ends_on' => '2026-11-16']),
        'ended-passe' => R::bailSigne($test->org, ['reference' => 'BL-2026-0009', 'starts_on' => '2025-01-01', 'ends_on' => '2026-01-01']),
        'running-resilie-futur' => R::bailSigne($test->org, ['reference' => 'BL-2026-0010', 'status' => LeaseStatus::Terminated, 'ends_on' => '2027-06-01']),
        'ended-resilie' => R::bailSigne($test->org, ['reference' => 'BL-2026-0012', 'status' => LeaseStatus::Terminated, 'ends_on' => '2026-06-01']),
        'ended-resilie-sans-fin' => R::bailSigne($test->org, ['reference' => 'BL-2026-0013', 'status' => LeaseStatus::Terminated, 'ends_on' => null]),
        'cancelled' => R::bailSigne($test->org, ['reference' => 'BL-2026-0011', 'status' => LeaseStatus::Cancelled]),
    ];
}

it('exige un jeton, l\'appartenance à l\'organisation et laisse lire un comptable sur chaque route du bail', function (): void {
    $bail = R::bailSigne($this->org);
    $lot = L::lot($this->org);
    $partie = L::partie($this->org);
    $routes = [
        '',
        "/{$bail->id}",
        "/{$bail->id}/terms",
        "/occupancy?units[]={$lot->id}",
        "/tenancies?parties[]={$partie->id}",
    ];

    foreach ($routes as $chemin) {
        $this->getJson(R::url($this->org, $chemin))->assertUnauthorized();
    }

    R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));

    foreach ($routes as $chemin) {
        $this->getJson(R::url($this->org, $chemin))->assertOk();
    }

    R::changerDeCompte($this, L::titulaire(L::organisation()));

    foreach ($routes as $chemin) {
        $this->getJson(R::url($this->org, $chemin))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('refuse le bail d\'une autre organisation et un identifiant qui n\'est pas un uuid', function (): void {
    $autre = L::organisation();
    $baildAutre = R::bailSigne($autre);
    $this->actingAs($this->titulaire);

    foreach (['', '/terms'] as $suffixe) {
        $this->getJson(R::url($this->org, "/{$baildAutre->id}{$suffixe}"))->assertNotFound()->assertJsonPath('code', 'lease_not_found');
        $this->getJson(R::url($this->org, "/pas-un-uuid{$suffixe}"))->assertNotFound();
    }
});

it('liste les baux d\'une organisation seulement, avec phase, lot principal et locataires', function (): void {
    $lot = L::lot($this->org);
    $locataire = L::partie($this->org);
    $bail = R::bailSigne($this->org, ['reference' => 'BL-2026-0001', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    R::occuper($this->org, $bail, $lot);
    R::lier($this->org, $bail, $locataire);
    R::bailSigne(L::organisation(), ['reference' => 'BL-2026-0001']);
    $this->actingAs($this->titulaire);

    $reponse = $this->getJson(R::url($this->org))->assertOk();

    expect($reponse->json('data'))->toHaveCount(1);
    $reponse
        ->assertJsonPath('data.0.id', $bail->id)
        ->assertJsonPath('data.0.reference', 'BL-2026-0001')
        ->assertJsonPath('data.0.status', 'signed')
        ->assertJsonPath('data.0.phase', 'running')
        ->assertJsonPath('data.0.starts_on', '2026-01-01')
        ->assertJsonPath('data.0.end_date', '2028-12-31')
        ->assertJsonPath('data.0.main_unit.id', $lot->id)
        ->assertJsonPath('data.0.main_unit.reference', $lot->reference)
        ->assertJsonPath('data.0.tenants.0.id', $locataire->id)
        ->assertJsonPath('data.0.tenants.0.display_name', $locataire->display_name)
        ->assertJsonPath('data.0.lock_version', 1)
        ->assertJsonPath('data.0.archived_at', null);
});

it('filtre par phase en reprenant exactement le calcul de LeasePhaseResolver', function (): void {
    $baux = leaseReadPhases($this);
    $this->actingAs($this->titulaire);
    $resolveur = app(LeasePhaseResolver::class);
    $attendu = [
        'draft' => ['draft'],
        'upcoming' => ['upcoming'],
        'running' => ['running', 'running-ouvert', 'running-fin-demain', 'running-preavis-futur', 'running-resilie-futur'],
        'notice' => ['notice'],
        'ended' => ['ended-borne', 'ended-passe', 'ended-resilie', 'ended-resilie-sans-fin', 'cancelled'],
    ];

    foreach ($baux as $cle => $bail) {
        expect($resolveur->at($bail, now())->value)->toBe($cle === 'cancelled' ? 'ended' : explode('-', $cle)[0]);
    }

    foreach ($attendu as $phase => $cles) {
        $references = collect($this->getJson(R::url($this->org, "?phase={$phase}&per_page=100"))->assertOk()->json('data'))->pluck('reference')->sort()->values()->all();

        expect($references)->toBe(collect($cles)->map(fn (string $cle): string => $baux[$cle]->reference)->sort()->values()->all())
            ->and(collect($this->getJson(R::url($this->org, "?phase={$phase}"))->json('data'))->pluck('phase')->unique()->all())->toBe([$phase]);
    }

    $this->getJson(R::url($this->org, '?phase=inconnue'))->assertUnprocessable();
    expect(array_map(fn (LeasePhase $p): string => $p->value, LeasePhase::cases()))->toBe(array_keys($attendu));
});

it('filtre par lot, partie, référence et archivage', function (): void {
    $lot = L::lot($this->org);
    $partie = L::partie($this->org);
    $a = R::bailSigne($this->org, ['reference' => 'BL-2026-0010']);
    $b = R::bailSigne($this->org, ['reference' => 'BL-2026-0020']);
    $archive = R::bailSigne($this->org, ['reference' => 'BL-2026-0030', 'archived_at' => now()]);
    R::occuper($this->org, $a, $lot, ['is_main' => false]);
    R::lier($this->org, $b, $partie);
    $this->actingAs($this->titulaire);
    $references = fn (string $requete): array => collect($this->getJson(R::url($this->org, $requete))->assertOk()->json('data'))->pluck('reference')->sort()->values()->all();

    expect($references(''))->toBe(['BL-2026-0010', 'BL-2026-0020'])
        ->and($references("?unit={$lot->id}"))->toBe(['BL-2026-0010'])
        ->and($references("?party={$partie->id}"))->toBe(['BL-2026-0020'])
        ->and($references('?q=bl-2026-002'))->toBe(['BL-2026-0020'])
        ->and($references('?q=%25'))->toBe([])
        ->and($references('?archived=1'))->toBe(['BL-2026-0030'])
        ->and($references('?archived=0'))->toBe(['BL-2026-0010', 'BL-2026-0020']);

    $this->getJson(R::url($this->org, '?unit=abc'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '?party=abc'))->assertUnprocessable();
    expect($archive->archived_at)->not->toBeNull();
});

it('pagine par curseur sans sauter ni répéter de bail quand plusieurs commencent le même jour', function (): void {
    foreach (range(1, 7) as $i) {
        R::bailSigne($this->org, ['reference' => sprintf('BL-2026-%04d', $i), 'starts_on' => $i <= 4 ? '2026-02-01' : '2026-03-01']);
    }

    $this->actingAs($this->titulaire);
    $vues = [];
    $curseur = null;
    $pages = 0;

    do {
        $reponse = $this->getJson(R::url($this->org, '?per_page=2'.($curseur === null ? '' : '&cursor='.$curseur)))->assertOk();
        $vues = [...$vues, ...collect($reponse->json('data'))->pluck('id')->all()];
        $curseur = $reponse->json('meta.next_cursor');
        $pages++;
    } while ($curseur !== null && $pages < 10);

    $attendu = Lease::query()->withoutGlobalScopes()->orderByDesc('starts_on')->orderByDesc('id')->pluck('id')->all();

    expect($pages)->toBe(4)
        ->and($vues)->toBe($attendu);

    $this->getJson(R::url($this->org, '?cursor=n-importe-quoi'))->assertUnprocessable();
    $this->getJson(R::url($this->org, '?per_page=101'))->assertUnprocessable();
});

it('ne charge pas les lots et parties bail par bail', function (): void {
    $this->actingAs($this->titulaire);
    $mesure = function (int $nombre): int {
        foreach (range(1, $nombre) as $i) {
            $bail = R::bailSigne($this->org, ['reference' => sprintf('BL-2026-%d%03d', $nombre, $i)]);
            R::occuper($this->org, $bail, L::lot($this->org));
            R::lier($this->org, $bail, L::partie($this->org));
        }

        return R::requetesDuBail(fn () => $this->getJson(R::url($this->org, '?per_page=100'))->assertOk());
    };

    $peu = $mesure(2);
    $beaucoup = $mesure(8);

    expect($beaucoup)->toBe($peu);
});
