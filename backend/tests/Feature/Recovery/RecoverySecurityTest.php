<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Support\LinkTokens;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Recovery\RecoveryContext as X;

beforeEach(function (): void {
    X::preparer($this);
});

/**
 * Toutes les routes `recovery.` de l'espace organisation lues dans le routeur : une route ajoutée plus tard entre d'elle-même dans les contrôles.
 *
 * @return list<array{name: string, method: string, write: bool}>
 */
function recoveryRoutes(): array
{
    $routes = [];

    foreach (Route::getRoutes()->getRoutes() as $route) {
        $nom = (string) $route->getName();

        if (str_starts_with($nom, 'recovery.') && $nom !== 'recovery.downloads.show') {
            $methode = strtolower(array_values(array_diff($route->methods(), ['HEAD']))[0]);
            $routes[] = ['name' => $nom, 'method' => $methode, 'write' => $methode !== 'get'];
        }
    }

    usort($routes, fn (array $a, array $b): int => $a['name'] <=> $b['name']);

    return $routes;
}

/**
 * @param  array{name: string, method: string, write: bool}  $route
 * @param  array<string, string>  $ids
 */
function recoveryUrl(array $route, object $org, array $ids): string
{
    $valeurs = ['organization' => $org->id, 'case' => $ids['case'], 'item' => $ids['item'], 'bundle' => $ids['bundle'], 'transmission' => $ids['transmission']];

    return route($route['name'], array_intersect_key($valeurs, array_flip(Route::getRoutes()->getByName($route['name'])?->parameterNames() ?? [])), false);
}

/**
 * @param  array{name: string, method: string, write: bool}  $route
 * @return array<string, mixed>
 */
function recoveryBody(array $route, string $bailId, string $partieId, string $creanceId): array
{
    return match ($route['name']) {
        'recovery.cases.store' => ['lease_id' => $bailId, 'debtor_party_id' => $partieId, 'installment_ids' => [$creanceId]],
        'recovery.cases.items.store' => ['installment_ids' => [$creanceId]],
        'recovery.cases.status' => ['status' => 'closed'],
        'recovery.cases.acts.store' => ['type' => 'note', 'performed_on' => '2026-11-10'],
        'recovery.bundles.transmissions.store' => ['recipient_party_id' => $partieId],
        default => [],
    };
}

/**
 * @return array<string, string>
 */
function recoveryUnknownIds(): array
{
    return ['case' => (string) Str::uuid7(), 'item' => (string) Str::uuid7(), 'bundle' => (string) Str::uuid7(), 'transmission' => (string) Str::uuid7()];
}

it('exige un jeton sur chaque route', function (): void {
    $s = X::impayes($this);
    auth()->forgetGuards();

    foreach (recoveryRoutes() as $route) {
        $this->json($route['method'], recoveryUrl($route, $s['org'], recoveryUnknownIds()), recoveryBody($route, $s['bail']->id, $s['locataire']->id, $s['ids'][0]))->assertUnauthorized();
    }

    expect(count(recoveryRoutes()))->toBe(15);
});

it('lit pour propriétaire, administrateur, gestionnaire et comptable ; écrit pour les trois premiers seulement', function (): void {
    foreach (recoveryRoutes() as $route) {
        $middlewares = Route::getRoutes()->getByName($route['name'])?->gatherMiddleware() ?? [];

        expect($middlewares)->toContain('auth:sanctum')->toContain('space:organization')
            ->toContain($route['write'] ? 'organization:owner,admin,manager' : 'organization:owner,admin,manager,accountant')
            ->toContain($route['write'] ? 'throttle:60,1' : 'throttle:120,1,recovery-lecture');
    }
});

it('laisse au comptable la lecture et lui refuse toute écriture', function (): void {
    $s = X::dossier($this);
    $comptable = L::membre($s['org'], MemberRole::Accountant);
    activerDeuxFacteurs($comptable);
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($comptable);
    $ids = recoveryUnknownIds();

    foreach (recoveryRoutes() as $route) {
        $reponse = $this->json($route['method'], recoveryUrl($route, $s['org'], $ids), recoveryBody($route, $s['bail']->id, $s['locataire']->id, $s['ids'][1]));

        $route['write']
            ? $reponse->assertForbidden()->assertJsonPath('code', 'role_forbidden')
            : expect($reponse->json('code'))->not->toBe('role_forbidden', $route['name']);
    }

    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(1)
        ->and(L::dans($s['org'], fn () => RecoveryCaseItem::query()->count()))->toBe(3);
    $this->getJson(X::url($s['org'], '/cases'))->assertOk()->assertJsonCount(1, 'data');
});

it('laisse le propriétaire, l\'administrateur et le gestionnaire atteindre chaque écriture', function (MemberRole $role): void {
    $s = X::impayes($this);
    $compte = $role === MemberRole::Owner ? L::titulaire($s['org']) : L::membre($s['org'], $role);
    activerDeuxFacteurs($compte);
    auth()->forgetGuards();
    app()->forgetInstance(CurrentOrganization::class);
    $this->actingAs($compte);

    foreach (recoveryRoutes() as $route) {
        if ($route['write']) {
            $reponse = $this->json($route['method'], recoveryUrl($route, $s['org'], recoveryUnknownIds()), recoveryBody($route, $s['bail']->id, $s['locataire']->id, $s['ids'][0]));

            expect($reponse->getStatusCode())->not->toBe(403, $route['name'])->not->toBe(401, $route['name']);
        }
    }
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);

it('ne montre rien d\'une autre organisation : 404 sur chaque route qui désigne une ressource, rien de modifié', function (): void {
    $etranger = X::transmis($this);
    $s = X::impayes($this, nom: 'Agence voisine');
    $item = L::dans($etranger['org'], fn () => RecoveryCaseItem::query()->firstOrFail()->id);
    $ids = ['case' => $etranger['case'], 'item' => $item, 'bundle' => $etranger['bundle'], 'transmission' => $etranger['transmission']];
    $avant = L::dans($etranger['org'], fn () => [RecoveryCase::query()->count(), RecoveryCaseItem::query()->whereNull('removed_at')->count(), RecoveryAct::query()->count(), RecoveryBundle::query()->count(), RecoveryTransmission::query()->count(), RecoveryTransmission::query()->whereNull('revoked_at')->count()]);
    Mail::fake();
    X::basculer($this, $s['org']);
    $verifiees = 0;

    foreach (recoveryRoutes() as $route) {
        $url = recoveryUrl($route, $s['org'], $ids);

        if (! preg_match('#/(cases|bundles|transmissions)/[0-9a-f-]{36}#', $url)) {
            continue;
        }

        $verifiees++;
        $reponse = $this->json($route['method'], $url, recoveryBody($route, $s['bail']->id, $s['locataire']->id, $s['ids'][0]));

        expect($reponse->getStatusCode())->toBe(404, $route['name'])
            ->and($reponse->json('code'))->toBeIn(['recovery_case_not_found', 'recovery_bundle_not_found', 'recovery_transmission_not_found'], $route['name']);
    }

    expect($verifiees)->toBe(12)
        ->and(L::dans($etranger['org'], fn () => [RecoveryCase::query()->count(), RecoveryCaseItem::query()->whereNull('removed_at')->count(), RecoveryAct::query()->count(), RecoveryBundle::query()->count(), RecoveryTransmission::query()->count(), RecoveryTransmission::query()->whereNull('revoked_at')->count()]))->toBe($avant);
    Mail::assertNothingSent();
});

it('ne mélange ni les listes, ni les impayés, ni les créances entre organisations', function (): void {
    $etranger = X::dossier($this);
    $s = X::impayes($this, nom: 'Agence voisine');

    $this->getJson(X::url($s['org'], '/cases'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(X::url($s['org'], '/cases?lease='.$etranger['bail']->id))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(X::url($s['org'], '/unpaid?lease='.$etranger['bail']->id))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(X::url($s['org'], '/unpaid'))->assertOk()->assertJsonCount(3, 'data');
    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$etranger['ids'][0]])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    X::ouvrir($this, $s['org'], $etranger['bail'], $etranger['locataire'], [$etranger['ids'][1]])->assertNotFound()->assertJsonPath('code', 'lease_not_found');
});

it('refuse un compte qui n\'appartient pas à l\'organisation', function (): void {
    $s = X::impayes($this);
    $autre = X::impayes($this, nom: 'Agence voisine');
    X::basculer($this, $autre['org']);

    foreach (recoveryRoutes() as $route) {
        $this->json($route['method'], recoveryUrl($route, $s['org'], recoveryUnknownIds()), recoveryBody($route, $s['bail']->id, $s['locataire']->id, $s['ids'][0]))
            ->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('refuse un identifiant qui n\'est pas un uuid', function (): void {
    $s = X::impayes($this);

    $this->getJson(X::url($s['org'], '/cases/pas-un-uuid'))->assertNotFound();
    $this->getJson(X::url($s['org'], '/bundles/12345/download'))->assertNotFound();
    $this->postJson(X::url($s['org'], '/transmissions/xyz/revoke'))->assertNotFound();
    $this->getJson(X::url($s['org'], '/unpaid?lease=pas-un-uuid'))->assertUnprocessable();
});

it('ne laisse rien fuir dans les erreurs : ni trace, ni chemin, ni classe PHP', function (): void {
    $s = X::dossier($this);
    $bundle = X::envoi($this, $s);
    $bailiff = X::bailiff($this, $s['org']);
    LinkTokens::generate();
    $reponses = [
        $this->postJson(X::url($s['org'], "/bundles/{$bundle}/transmissions"), ['recipient_party_id' => fake()->uuid()]),
        $this->postJson(X::url($s['org'], "/cases/{$s['case']}/status"), ['status' => 'open']),
        $this->postJson(X::url($s['org'], "/cases/{$s['case']}/items"), ['installment_ids' => ['x']]),
        $this->getJson(X::url($s['org'], '/cases/'.fake()->uuid())),
    ];

    foreach ($reponses as $reponse) {
        expect($reponse->getContent())->not->toContain('App\\')->not->toContain('/Users/')->not->toContain('vendor')->not->toContain('Stack trace')->not->toContain('SQLSTATE')
            ->and($reponse->headers->get('Content-Type'))->toContain('application/problem+json');
    }

    expect($bailiff)->toBeString();
});
