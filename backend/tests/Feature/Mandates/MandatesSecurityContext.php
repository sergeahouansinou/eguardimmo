<?php

declare(strict_types=1);

namespace Tests\Feature\Mandates;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use LogicException;

final class MandatesSecurityContext
{
    /**
     * Toutes les routes d'organisation nommées `mandates.*`, lues dans le routeur : une route ajoutée plus tard entre d'elle-même
     * dans les contrôles. Les routes `mandates.owner.*` (espace propriétaire) ont leurs propres tests (tests/Feature/Owner).
     *
     * @return list<array{name: string, method: string, write: bool}>
     */
    public static function routes(): array
    {
        $routes = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            $nom = (string) $route->getName();

            if (str_starts_with($nom, 'mandates.') && ! str_starts_with($nom, 'mandates.owner.') && ! str_starts_with($nom, 'mandates.term-defaults.')) {
                $methode = strtolower(array_values(array_diff($route->methods(), ['HEAD']))[0]);
                $routes[] = ['name' => $nom, 'method' => $methode, 'write' => $methode !== 'get'];
            }
        }

        usort($routes, fn (array $a, array $b): int => $a['name'] <=> $b['name']);

        return $routes;
    }

    /**
     * @param  list<array{name: string, method: string, write: bool}>  $routes
     * @return list<array{name: string, method: string, write: bool}>
     */
    public static function ecritures(array $routes): array
    {
        return array_values(array_filter($routes, fn (array $r): bool => $r['write']));
    }

    /**
     * @param  array{name: string, method: string, write: bool}  $route
     */
    public static function url(array $route, Organization $organisation, string $mandat): string
    {
        $valeurs = [
            'organization' => $organisation->id,
            'mandate' => $mandat,
            'mandateUnit' => (string) Str::uuid7(),
            'document' => (string) Str::uuid7(),
        ];

        return route($route['name'], array_intersect_key($valeurs, array_flip(Route::getRoutes()->getByName($route['name'])?->parameterNames() ?? [])), false);
    }

    /**
     * Corps valide de chaque écriture : une route sans corps déclaré fait échouer les tests, pour qu'aucune ne passe inaperçue.
     *
     * @param  array{name: string, method: string, write: bool}  $route
     * @return array<string, mixed>
     */
    public static function corps(array $route, Unit $lot, Party $partie): array
    {
        return match ($route['name']) {
            'mandates.store' => MandatesContext::payload($lot, $partie),
            'mandates.update' => ['lock_version' => 1, 'note' => 'Note'],
            'mandates.activate' => ['lock_version' => 1, 'signed_on' => '2026-11-10'],
            'mandates.suspend', 'mandates.resume', 'mandates.archive', 'mandates.restore', 'mandates.units.destroy' => ['lock_version' => 1],
            'mandates.terminate' => ['lock_version' => 1, 'notice_given_on' => '2026-11-10', 'effective_on' => '2027-03-01', 'reason' => 'Mutation'],
            'mandates.renew' => ['lock_version' => 1, 'months' => 12],
            'mandates.terms.amend' => ['lock_version' => 1, 'effective_on' => '2026-12-01', 'fee_basis_points' => 600],
            'mandates.units.store' => ['lock_version' => 1, 'unit_id' => $lot->id],
            'mandates.documents.store' => ['stored_file_id' => (string) Str::uuid7(), 'kind' => 'other'],
            'mandates.documents.destroy' => [],
            'mandates.end-request.dismiss' => ['note' => 'Mutation'],
            'mandates.units.end' => ['lock_version' => 1, 'end_date' => '2026-12-31'],
            default => throw new LogicException("Aucun corps de test pour la route {$route['name']}."),
        };
    }

    /**
     * @param  array{name: string, method: string, write: bool}  $route
     */
    public static function appeler(mixed $test, array $route, Organization $organisation, string $mandat, Unit $lot, Party $partie): TestResponse
    {
        $corps = $route['write'] ? self::corps($route, $lot, $partie) : [];

        return $test->json($route['method'], self::url($route, $organisation, $mandat), $corps);
    }

    /**
     * @param  list<string>  $echecs
     * @param  array{name: string, method: string, write: bool}  $route
     */
    public static function constater(array &$echecs, string $contexte, array $route, TestResponse $reponse, int $statut, ?string $code): void
    {
        $recu = $reponse->json('code');

        if ($reponse->getStatusCode() !== $statut || ($code !== null && $recu !== $code)) {
            $echecs[] = sprintf('%s %s : attendu %d %s, reçu %d %s', $contexte, $route['name'], $statut, $code ?? '-', $reponse->getStatusCode(), (string) $recu);
        }
    }

    public static function jetonOperateur(User $compte): string
    {
        $compte->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
        activerDeuxFacteurs($compte);

        return $compte->createToken('console', ['operator'])->plainTextToken;
    }

    public static function changer(): void
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
    }
}
