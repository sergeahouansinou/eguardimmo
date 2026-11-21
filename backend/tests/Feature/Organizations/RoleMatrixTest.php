<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Data\RoleDomainData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Support\RoleMatrix;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

const SONDES_DU_CODE = [
    'messaging_external' => ['lecture' => 'messaging.conversations.index', 'ecriture' => 'messaging.conversations.store'],
    'support_access' => ['lecture' => 'messaging.support_access.index', 'ecriture' => 'messaging.support_access.refuse'],
    'campaigns' => ['lecture' => 'notifications.campaigns.index', 'ecriture' => 'notifications.campaigns.store'],
    'campaigns_send' => ['ecriture' => 'notifications.campaigns.schedule'],
];

/**
 * @return list<LaravelRoute>
 */
function routesEquipe(): array
{
    $routes = array_filter(
        Route::getRoutes()->getRoutes(),
        fn (LaravelRoute $r): bool => str_starts_with($r->uri(), 'api/v1/org/{organization}') && is_string($r->getName()),
    );
    usort($routes, fn (LaravelRoute $a, LaravelRoute $b): int => $a->getName() <=> $b->getName());

    return array_values($routes);
}

function estLecture(LaravelRoute $route): bool
{
    return in_array('GET', $route->methods(), true);
}

/**
 * @return list<string>
 */
function rolesDuMiddleware(LaravelRoute $route): array
{
    foreach (app('router')->gatherRouteMiddleware($route) as $middleware) {
        if (is_string($middleware) && str_contains($middleware, 'EnterOrganization')) {
            $roles = str_contains($middleware, ':') ? explode(',', Str::after($middleware, ':')) : array_map(fn (MemberRole $r): string => $r->value, MemberRole::cases());
            sort($roles);

            return $roles;
        }
    }

    return [];
}

function aDeuxFacteurs(LaravelRoute $route): bool
{
    foreach (app('router')->gatherRouteMiddleware($route) as $middleware) {
        if (is_string($middleware) && (str_contains($middleware, 'RequireConfirmedTwoFactor') || str_contains($middleware, 'RequireTwoFactorInAgency'))) {
            return true;
        }
    }

    return false;
}

/**
 * @return list<string>
 */
function rolesAttendus(RoleDomainData $domaine, bool $lecture): array
{
    $roles = array_values(array_map(fn (MemberRole $r): string => $r->value, array_filter(MemberRole::cases(), fn (MemberRole $r): bool => $domaine->allows($r, $lecture))));
    sort($roles);

    return $roles;
}

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->comptes = [
        MemberRole::Owner->value => M::titulaire($this->org),
        MemberRole::Admin->value => M::membre($this->org, MemberRole::Admin),
        MemberRole::Manager->value => M::membre($this->org, MemberRole::Manager),
        MemberRole::Accountant->value => M::membre($this->org, MemberRole::Accountant),
    ];
});

it('rattache chaque route /org/{organization} à exactement un domaine, et chaque domaine à au moins une route', function (): void {
    $orphelines = [];
    $ambigues = [];
    $vues = [];

    foreach (routesEquipe() as $route) {
        $nom = (string) $route->getName();
        $domaines = array_values(array_filter(RoleMatrix::domains(), fn (RoleDomainData $d): bool => $d->matches($nom)));

        match (count($domaines)) {
            0 => $orphelines[] = $nom,
            1 => $vues[$domaines[0]->key] = true,
            default => $ambigues[] = $nom.' : '.implode(', ', array_map(fn (RoleDomainData $d): string => $d->key, $domaines)),
        };
    }

    $vides = array_values(array_diff(array_map(fn (RoleDomainData $d): string => $d->key, RoleMatrix::domains()), array_keys($vues)));
    $cles = array_map(fn (RoleDomainData $d): string => $d->key, RoleMatrix::domains());

    expect($orphelines)->toBe([])->and($ambigues)->toBe([])->and($vides)->toBe([])->and(array_unique($cles))->toEqual($cles);
});

it('les rôles du middleware de chaque route sont ceux de son domaine pour sa méthode', function (): void {
    $ecarts = [];

    foreach (routesEquipe() as $route) {
        $domaine = RoleMatrix::domainOf((string) $route->getName());

        if ($domaine === null) {
            continue;
        }

        $attendus = $domaine->enforcedInCode
            ? array_map(fn (MemberRole $r): string => $r->value, MemberRole::cases())
            : rolesAttendus($domaine, estLecture($route));
        sort($attendus);
        $reels = rolesDuMiddleware($route);

        $reels === $attendus || $ecarts[] = sprintf('%s [%s] : middleware %s, matrice %s', $route->getName(), $domaine->key, implode(',', $reels), implode(',', $attendus));
    }

    expect($ecarts)->toBe([]);
});

it('la double authentification déclarée par un domaine est exigée par ses routes d\'écriture, et par elles seules', function (): void {
    $ecarts = [];
    $exigees = [];

    foreach (routesEquipe() as $route) {
        $domaine = RoleMatrix::domainOf((string) $route->getName());

        if ($domaine === null) {
            continue;
        }

        if (aDeuxFacteurs($route)) {
            $domaine->twoFactor() || $ecarts[] = "{$route->getName()} [{$domaine->key}] exige la double authentification, la matrice ne la déclare pas";
            $exigees[$domaine->key] = true;
        }
    }

    foreach (RoleMatrix::domains() as $domaine) {
        ! $domaine->twoFactor() || isset($exigees[$domaine->key]) || $ecarts[] = "{$domaine->key} déclare la double authentification, aucune de ses routes ne l'exige";
    }

    expect($ecarts)->toBe([]);
});

it('chaque domaine, appelé par chacun des quatre rôles, répond comme la matrice le déclare (403 role_forbidden ou non)', function (): void {
    $representantes = [];

    foreach (routesEquipe() as $route) {
        $domaine = RoleMatrix::domainOf((string) $route->getName());

        if ($domaine === null) {
            continue;
        }

        $sorte = estLecture($route) ? 'lecture' : 'ecriture';
        $retenue = SONDES_DU_CODE[$domaine->key][$sorte] ?? null;

        // Ces domaines refusent dans le code, parfois après la recherche de la ressource : on sonde une route dont le refus vient d'abord.
        // `messaging_moderation` n'est pas sondé (le refus suppose un fil existant) : StaffConversationTest le couvre.
        // `planning_task_progress` non plus (le refus suppose une tâche existante) : tests/Feature/Planning/TasksTest.php le couvre.
        if ($domaine->enforcedInCode && $retenue !== $route->getName()) {
            continue;
        }

        $representantes[$domaine->key][$sorte] ??= $route;
    }

    $entrees = [
        'organizations.activity.index' => ['subject_type' => 'party', 'subject_id' => (string) Str::uuid7()],
        'messaging.conversations.index' => ['kind' => 'tenant'],
        'messaging.conversations.store' => ['kind' => 'tenant', 'party_id' => (string) Str::uuid7(), 'lease_id' => (string) Str::uuid7(), 'subject' => 'Sujet', 'body' => 'Bonjour', 'client_id' => (string) Str::uuid7()],
    ];
    $echecs = [];

    foreach ($this->comptes as $role => $compte) {
        M::basculer($this, $compte);
        Cache::flush();

        foreach ($representantes as $cle => $parSorte) {
            $domaine = collect(RoleMatrix::domains())->firstWhere('key', $cle);

            foreach ($parSorte as $sorte => $route) {
                $parametres = [];
                foreach ($route->parameterNames() as $nom) {
                    $parametres[$nom] = $nom === 'organization' ? $this->org->id : (string) Str::uuid7();
                }

                $methode = array_values(array_diff($route->methods(), ['HEAD']))[0];
                $reponse = $this->json($methode, route((string) $route->getName(), $parametres, false), $entrees[$route->getName()] ?? []);
                $refuse = $reponse->getStatusCode() === 403 && $reponse->json('code') === 'role_forbidden';
                $attendu = ! $domaine->allows(MemberRole::from($role), $sorte === 'lecture');

                if ($refuse !== $attendu || $reponse->getStatusCode() >= 500) {
                    $echecs[] = sprintf('%s %s [%s] : attendu %s, reçu %d %s', $role, $route->getName(), $cle, $attendu ? 'refus' : 'accès', $reponse->getStatusCode(), (string) $reponse->json('code'));
                }
            }
        }
    }

    expect($echecs)->toBe([]);
});

it('GET /roles : tout membre lit la matrice statique et son propre rôle, sans donnée d\'équipe', function (string $role): void {
    M::basculer($this, $this->comptes[$role]);

    $reponse = $this->getJson("/api/v1/org/{$this->org->id}/roles")->assertOk();
    $domaines = $reponse->json('data.domains');

    expect($reponse->json('data.current_role'))->toBe($role)
        ->and(array_keys($reponse->json('data')))->toBe(['current_role', 'domains'])
        ->and(array_column($domaines, 'key'))->toBe(array_map(fn (RoleDomainData $d): string => $d->key, RoleMatrix::domains()))
        ->and(array_keys($domaines[0]))->toBe(['key', 'levels', 'two_factor'])
        ->and(array_keys($domaines[0]['levels']))->toBe(['owner', 'admin', 'manager', 'accountant'])
        ->and(json_encode($reponse->json()))->not->toContain($this->comptes[$role]->email)->not->toContain($this->org->id);
})->with(['owner', 'admin', 'manager', 'accountant']);

it('GET /roles : 401 sans session, 404 hors organisation, 403 operator_token_forbidden pour un jeton opérateur', function (): void {
    $url = "/api/v1/org/{$this->org->id}/roles";

    $this->getJson($url)->assertUnauthorized();

    $jetonMembre = X::jetonOperateur(M::membre($this->org, MemberRole::Admin));
    X::changer();
    $this->withToken($jetonMembre)->getJson($url)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');

    $jetonEtranger = X::jetonOperateur(User::factory()->create());
    X::changer();
    $this->withToken($jetonEtranger)->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    $this->flushHeaders();
    M::basculer($this, M::titulaire(M::organisation()));
    $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('GET /roles : répond aussi dans une organisation individuelle, avec la même matrice', function (): void {
    $solo = M::organisation(OrganizationKind::Individual);
    M::basculer($this, M::titulaire($solo));

    $reponse = $this->getJson("/api/v1/org/{$solo->id}/roles")->assertOk();

    expect($reponse->json('data.current_role'))->toBe('owner')
        ->and(count($reponse->json('data.domains')))->toBe(count(RoleMatrix::domains()));
});

it('GET /roles : décrit le niveau de chaque rôle (écriture avec double authentification, lecture seule, aucun accès)', function (): void {
    M::basculer($this, $this->comptes['accountant']);

    $domaines = collect($this->getJson("/api/v1/org/{$this->org->id}/roles")->assertOk()->json('data.domains'))->keyBy('key');

    expect($domaines['parties_sensitive']['levels'])->toBe(['owner' => 'write_two_factor', 'admin' => 'write_two_factor', 'manager' => 'write_two_factor', 'accountant' => 'none'])
        ->and($domaines['parties_sensitive']['two_factor'])->toBeTrue()
        ->and($domaines['team']['levels']['accountant'])->toBe('read')
        ->and($domaines['owner_funds']['levels']['manager'])->toBe('prepare')
        ->and($domaines['team']['two_factor'])->toBeFalse();
});
