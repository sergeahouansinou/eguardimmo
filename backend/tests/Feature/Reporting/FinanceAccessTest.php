<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->b = T::bailleur2025($this);
    $this->org = $this->b['org'];
    T::comme($this, $this->b['owner']);
});

/**
 * @return array<string, array{string, string}> méthode et chemin relatif de chaque route financière
 */
function routesFinance(): array
{
    return [
        'revenue-expenses' => ['GET', '/finance/revenue-expenses?from=2025-01-01&to=2025-04-30'],
        'occupancy' => ['GET', '/finance/occupancy?from=2025-01-01&to=2025-04-30'],
        'profitability' => ['GET', '/finance/profitability?year=2025'],
        'forecast' => ['GET', '/finance/forecast'],
        'export prêts' => ['GET', '/exports/prets-immobiliers?from=2025-01-01&to=2025-12-31'],
        'export rentabilité' => ['GET', '/exports/rentabilite-par-bien?year=2025'],
        'hypothèses' => ['PUT', '/finance/forecast/assumptions'],
    ];
}

function appelFinance(object $test, $org, string $methode, string $chemin, int $version = 0): TestResponse
{
    $corps = $methode === 'PUT' ? ['lock_version' => $version, 'indexation_rate' => '1.5', 'expense_growth_rate' => '2', 'vacancies' => [], 'one_off_expenses' => []] : [];

    return $test->json($methode, R::url($org, $chemin), $corps);
}

it('401 sans session sur chaque route financière', function (): void {
    $this->flushHeaders();
    auth()->forgetGuards();

    foreach (routesFinance() as $nom => [$methode, $chemin]) {
        appelFinance($this, $this->org, $methode, $chemin)->assertUnauthorized();
    }
});

it('404 organization_not_found pour un compte d\'une autre organisation, sur chaque route', function (): void {
    T::comme($this, T::membre(C::organisation(OrganizationKind::Individual), MemberRole::Owner));

    foreach (routesFinance() as [$methode, $chemin]) {
        appelFinance($this, $this->org, $methode, $chemin)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('le jeton opérateur est refusé partout', function (): void {
    $jeton = X::jetonOperateur(L::membre($this->org, MemberRole::Admin));
    X::changer();

    foreach (routesFinance() as [$methode, $chemin]) {
        $this->withToken($jeton)->json($methode, R::url($this->org, $chemin), [])->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('les quatre rôles lisent ; hypothèses et exports sont refusés au gestionnaire (role_forbidden)', function (): void {
    $version = 0;

    foreach ([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant] as $role) {
        T::comme($this, $role === MemberRole::Owner ? $this->b['owner'] : T::membre($this->org, $role));

        foreach (['revenue-expenses', 'occupancy', 'profitability', 'forecast'] as $nom) {
            [$methode, $chemin] = routesFinance()[$nom];
            appelFinance($this, $this->org, $methode, $chemin)->assertOk();
        }

        foreach (['export prêts', 'export rentabilité', 'hypothèses'] as $nom) {
            [$methode, $chemin] = routesFinance()[$nom];
            $reponse = appelFinance($this, $this->org, $methode, $chemin, $version);

            if ($role === MemberRole::Manager) {
                $reponse->assertForbidden()->assertJsonPath('code', 'role_forbidden');

                continue;
            }

            $reponse->assertOk();
            $methode === 'PUT' && $version = (int) $reponse->json('data.lock_version');
        }

        $this->flushHeaders();
    }
});

it('une agence lit revenus et occupation, mais profitabilité, prévisionnel, hypothèses et exports répondent 403 reporting_landlord_only', function (): void {
    $agence = C::organisation(OrganizationKind::Agency);
    T::comme($this, L::titulaire($agence));

    foreach (['revenue-expenses', 'occupancy'] as $nom) {
        [$methode, $chemin] = routesFinance()[$nom];
        appelFinance($this, $agence, $methode, $chemin)->assertOk();
    }

    foreach (['profitability', 'forecast', 'export prêts', 'export rentabilité', 'hypothèses'] as $nom) {
        [$methode, $chemin] = routesFinance()[$nom];
        appelFinance($this, $agence, $methode, $chemin)->assertForbidden()->assertJsonPath('code', 'reporting_landlord_only');
    }
});

it('chaque réponse chiffrée est privée : Cache-Control no-store, private', function (): void {
    foreach (routesFinance() as [$methode, $chemin]) {
        $cache = (string) appelFinance($this, $this->org, $methode, $chemin)->headers->get('Cache-Control');

        expect($cache)->toContain('no-store')->toContain('private');
    }
});

it('une période absente, inversée ou de plus de 36 mois est refusée (422), une année hors bornes aussi', function (): void {
    $this->getJson(R::url($this->org, '/finance/revenue-expenses'))->assertStatus(422);
    $this->getJson(R::url($this->org, '/finance/revenue-expenses?from=2025-05-01&to=2025-04-30'))->assertStatus(422)->assertJsonValidationErrors(['to']);
    $this->getJson(R::url($this->org, '/finance/occupancy?from=2022-01-01&to=2025-01-01'))->assertStatus(422)->assertJsonValidationErrors(['to']);
    $this->getJson(R::url($this->org, '/finance/occupancy?from=2022-01-01&to=2024-12-31'))->assertOk();
    $this->getJson(R::url($this->org, '/finance/profitability'))->assertStatus(422)->assertJsonValidationErrors(['year']);
    $this->getJson(R::url($this->org, '/finance/profitability?year=1999'))->assertStatus(422)->assertJsonPath('code', 'profitability_period_invalid');
    $this->getJson(R::url($this->org, '/finance/profitability?year=2026'))->assertStatus(422)->assertJsonPath('code', 'profitability_period_invalid');
    $this->getJson(R::url($this->org, '/finance/profitability?year=2025'))->assertOk();
});

it('un type d\'export inconnu répond 404 export_type_unknown', function (): void {
    $this->getJson(R::url($this->org, '/exports/rent-called?from=2025-01-01&to=2025-04-30'))->assertNotFound()->assertJsonPath('code', 'export_type_unknown');
});

it('les exports sont limités à 10 par minute et par utilisateur (429)', function (): void {
    for ($i = 0; $i < 10; $i++) {
        $this->get(R::url($this->org, '/exports/rentabilite-par-bien?year=2025'))->assertOk();
    }

    $this->get(R::url($this->org, '/exports/rentabilite-par-bien?year=2025'))->assertStatus(429);
});
