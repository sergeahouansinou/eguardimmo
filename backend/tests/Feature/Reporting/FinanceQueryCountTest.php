<?php

declare(strict_types=1);

use App\Modules\Investments\Models\PropertyAcquisition;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\TaxContext as T;

function requetesFinance(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

function ajouterBiens(object $test, int $nombre): void
{
    for ($i = 0; $i < $nombre; $i++) {
        ['lot' => $lot] = C::bail($test->org, ['starts_on' => '2025-01-01', 'ends_on' => '2028-01-01', 'signed_on' => '2024-12-15']);
        L::dans($test->org, fn (): PropertyAcquisition => PropertyAcquisition::query()->create([
            'property_id' => $lot->property_id, 'scope_key' => '*', 'acquired_on' => '2024-06-01', 'currency' => 'EUR',
            'price' => Money::EUR(900000), 'acquisition_costs' => Money::EUR(0), 'agency_fees' => Money::EUR(0), 'initial_works' => Money::EUR(0), 'idempotency_key' => 'acq-volume-'.Str::random(8), 'fingerprint' => hash('sha256', $lot->property_id),
        ]));
    }
}

it('chaque vue financière fait un nombre constant de requêtes pour 1, 10 et 100 biens', function (): void {
    T::preparer($this);
    $this->withoutMiddleware(ThrottleRequests::class);
    $this->b = T::bailleur2025($this);
    $this->org = $this->b['org'];
    T::comme($this, $this->b['owner']);
    $vues = [
        'revenue-expenses' => '/finance/revenue-expenses?from=2025-01-01&to=2025-12-31',
        'occupancy' => '/finance/occupancy?from=2025-01-01&to=2025-12-31',
        'profitability' => '/finance/profitability?year=2025',
        'forecast' => '/finance/forecast',
        'export prêts' => '/exports/prets-immobiliers?from=2025-01-01&to=2025-12-31',
        'export rentabilité' => '/exports/rentabilite-par-bien?year=2025',
    ];
    $mesurer = function () use ($vues): array {
        $compte = [];

        foreach ($vues as $nom => $chemin) {
            $this->get(R::url($this->org, $chemin))->assertOk();
            $compte[$nom] = requetesFinance(fn () => $this->get(R::url($this->org, $chemin))->assertOk());
        }

        return $compte;
    };

    ajouterBiens($this, 0);
    $un = $mesurer();
    ajouterBiens($this, 9);
    $dix = $mesurer();
    ajouterBiens($this, 90);
    $cent = $mesurer();

    expect($dix)->toBe($un)->and($cent)->toBe($un);
    expect(count($this->getJson(R::url($this->org, '/finance/occupancy?from=2025-01-01&to=2025-01-31'))->json('data.units')))->toBe(100)
        ->and(count($this->getJson(R::url($this->org, '/finance/profitability?year=2025'))->json('data.rows')))->toBe(100);
});
