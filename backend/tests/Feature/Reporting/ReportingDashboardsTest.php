<?php

declare(strict_types=1);

use App\Modules\Reporting\Queries\Cards\AgencyAlertsCard;
use App\Modules\Reporting\Queries\Cards\AgencyKpisCard;
use App\Modules\Reporting\Queries\Cards\AgencyPayoutsCard;
use App\Modules\Reporting\Queries\Cards\AgingCard;
use App\Modules\Reporting\Queries\Cards\LandlordCard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;

function requetesCarte(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
});

it('la carte des loyers donne l\'appelé, l\'encaissé et les honoraires du mois, égaux au grand livre', function (): void {
    R::parcours($this);

    $novembre = $this->getJson(R::url($this->org, '/home/agency-kpis?month=2026-11'))->assertOk()->json('data');
    $decembre = $this->getJson(R::url($this->org, '/home/agency-kpis?month=2026-12'))->assertOk()->json('data');

    expect($novembre['rent_called']['amount'])->toBe(70000)
        ->and($novembre['rent_collected']['amount'])->toBe(70000)
        ->and($novembre['collection_rate_basis_points'])->toBe(10000)
        ->and($novembre['fees_net']['amount'])->toBe(0)
        ->and($novembre['period_closed'])->toBeTrue()
        ->and($decembre['fees_net']['amount'])->toBe(4900)
        ->and($decembre['rent_collected']['amount'])->toBe(0);
    $this->getJson(R::url($this->org, '/home/agency-kpis?month=2026-13'))->assertUnprocessable();
});

it('la carte des reversements montre le dû aux mandants, les retenues et les virements en attente', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $carte = $this->getJson(R::url($this->org, '/home/agency-payouts'))->assertOk()->json('data');

    expect($carte['payable_total']['amount'])->toBe(70000)
        ->and($carte['mandants_with_payable'])->toBe(1)
        ->and($carte['top_mandants'][0]['party_id'])->toBe($this->mandant->id)
        ->and($carte['active_holds'])->toBe(0)
        ->and($carte['pending_items'])->toBe(0);

    $lot = F::lotValide($this);
    expect($this->getJson(R::url($this->org, '/home/agency-payouts'))->json('data.pending_items'))->toBe(1)
        ->and($this->getJson(R::url($this->org, '/home/agency-payouts'))->json('data.payable_total.amount'))->toBe(0)
        ->and($this->getJson(R::url($this->org, '/home/agency-payouts'))->json('data.in_transit_total.amount'))->toBe(64120);
    expect($lot['batch'])->not->toBeEmpty();
});

it('l\'ancienneté des impayés range les créances par tranche', function (): void {
    C::emises($this->org, $this->bail, $this);

    $carte = $this->getJson(R::url($this->org, '/finance/aging'))->assertOk()->json('data');

    expect(collect($carte['buckets'])->pluck('bucket')->all())->toBe(['0_30', '31_60', '61_90', 'over_90'])
        ->and($carte['total']['amount'])->toBe(70000)
        ->and($carte['buckets'][0]['amount']['amount'])->toBe(70000)
        ->and($carte['count'])->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2027-01-20 10:00:00'));
    $plus = $this->getJson(R::url($this->org, '/finance/aging'))->assertOk()->json('data');
    expect($plus['buckets'][2]['amount']['amount'])->toBe(70000)->and($plus['buckets'][0]['amount']['amount'])->toBe(0);
});

it('les alertes signalent les comptes rendus à produire pour la dernière période échue', function (): void {
    R::parcours($this);

    $avant = $this->getJson(R::url($this->org, '/home/agency-alerts'))->assertOk()->json('data.reports_due');
    expect($avant['period'])->toBe(['start' => '2026-12-01', 'end' => '2026-12-31'])
        ->and($avant['count'])->toBe(1)
        ->and($avant['mandant_ids'])->toBe([$this->mandant->id]);

    R::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);
    expect($this->getJson(R::url($this->org, '/home/agency-alerts'))->json('data.reports_due.count'))->toBe(0);

    $liste = $this->getJson(R::url($this->org, '/management-reports'))->assertOk();
    expect($liste->json('meta.due.mandants'))->toBe([]);
});

it('la liste des comptes rendus porte les lignes à produire en `meta.due`', function (): void {
    R::parcours($this);

    $liste = $this->getJson(R::url($this->org, '/management-reports'))->assertOk();

    expect($liste->json('data'))->toBe([])
        ->and($liste->json('meta.due.mandants.0.party_id'))->toBe($this->mandant->id)
        ->and($liste->json('meta.due.period.start'))->toBe('2026-12-01');
});

it('l\'accueil bailleur compte les faits : lots vacants, interventions ouvertes, baux à échéance', function (): void {
    ['lot' => $vacant] = C::bail($this->org);
    L::dans($this->org, fn () => DB::table('leases')->where('id', DB::table('lease_units')->where('unit_id', $vacant->id)->value('lease_id'))->update(['status' => 'terminated']));

    $carte = $this->getJson(R::url($this->org, '/home/landlord'))->assertOk()->json('data');

    expect($carte['vacant_units'])->toBe(1)
        ->and($carte['open_interventions'])->toBe(0)
        ->and($carte['leases_ending'])->toBeInt()
        ->and($carte['rent_called']['currency'])->toBe('EUR');
});

it('chaque carte fait au plus 8 requêtes, quel que soit le nombre de baux, de lots et de mandants', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $aujourdhui = CarbonImmutable::today();
    $cartes = [
        'kpis' => fn () => app(AgencyKpisCard::class)->of(null, $aujourdhui),
        'payouts' => fn () => app(AgencyPayoutsCard::class)->of($aujourdhui),
        'alerts' => fn () => app(AgencyAlertsCard::class)->of($aujourdhui),
        'landlord' => fn () => app(LandlordCard::class)->of(null, $aujourdhui),
        'aging' => fn () => app(AgingCard::class)->of($aujourdhui),
    ];
    $urls = ['/home/agency-kpis', '/home/agency-payouts', '/home/agency-alerts', '/home/landlord', '/finance/aging'];

    $mesure = fn (): array => array_map(fn (Closure $carte): int => requetesCarte(fn () => L::dans($this->org, $carte)), $cartes);
    $http = fn (): array => array_map(fn (string $u): int => requetesCarte(fn () => $this->getJson(R::url($this->org, $u))->assertOk()), $urls);
    $mesure();
    $avant = $mesure();
    $httpAvant = $http();

    foreach ($avant as $carte => $n) {
        expect($n)->toBeLessThanOrEqual(8, "carte {$carte}");
    }

    foreach (range(1, 3) as $i) {
        $autre = L::dans($this->org, fn () => M::partie($this->org));
        ['bail' => $bail2, 'lot' => $lot2] = C::bail($this->org);
        M::actif($this->org, $lot2, $autre);
        C::emises($this->org, $bail2, $this);
    }

    expect($mesure())->toBe($avant)->and($http())->toBe($httpAvant);
});

it('les faits d\'une autre organisation ne comptent jamais dans les cartes', function (): void {
    $paysage = fn (): array => [
        $this->getJson(R::url($this->org, '/home/landlord'))->assertOk()->json('data'),
        $this->getJson(R::url($this->org, '/home/agency-alerts'))->assertOk()->json('data'),
    ];
    $avant = $paysage();
    $autre = C::organisation(nom: 'Autre agence');
    ['bail' => $etranger, 'lot' => $lotEtranger] = C::bail($autre);
    $mandat = L::dans($autre, fn () => M::actif($autre, $lotEtranger, M::partie($autre)));
    L::dans($autre, fn () => DB::table('leases')->where('id', $etranger->id)->update(['status' => 'terminated']));
    L::dans($autre, fn () => DB::table('mandates')->where('id', $mandat->id)->update(['ends_on' => '2026-12-20']));

    expect($paysage())->toBe($avant);
    MandatesSecurityContext::changer();
    $this->actingAs(L::titulaire($autre));
    $chezLautre = $this->getJson(R::url($autre, '/home/agency-alerts'))->assertOk()->json('data');
    expect($chezLautre['mandates_to_renew']['count'])->toBe(1)->and($chezLautre['mandates_to_renew']['next'][0]['id'])->toBe($mandat->id);
});
