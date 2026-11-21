<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use LogicException;

final class LeasesSecurityContext
{
    public const PREFIXES_EQUIPE = ['leases.documents.', 'leases.insurance', 'leases.notice-requests.'];

    /**
     * Toutes les routes d'organisation nommées `leases.*`, lues dans le routeur : une route ajoutée plus tard entre d'elle-même dans les contrôles.
     * Les routes de l'équipe de gestion seule (documents, assurance, demandes de congé : lecture comprise) ont leurs contrôles dans LeasesTeamSpaceSecurityTest. Les routes `leases.tenant.*` (espace locataire, ADR 0024) ont leurs propres contrôles dans tests/Feature/Tenant, les routes `leases.owner.*` dans tests/Feature/Owner.
     *
     * @return list<array{name: string, method: string, write: bool}>
     */
    public static function routes(bool $equipe = false): array
    {
        $routes = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            $nom = (string) $route->getName();

            if (str_starts_with($nom, 'leases.') && ! str_starts_with($nom, 'leases.tenant.') && ! str_starts_with($nom, 'leases.owner.') && self::estEquipe($nom) === $equipe) {
                $methode = strtolower(array_values(array_diff($route->methods(), ['HEAD']))[0]);
                $routes[] = ['name' => $nom, 'method' => $methode, 'write' => $methode !== 'get'];
            }
        }

        usort($routes, fn (array $a, array $b): int => $a['name'] <=> $b['name']);

        return $routes;
    }

    public static function estEquipe(string $nom): bool
    {
        return array_any(self::PREFIXES_EQUIPE, fn (string $prefixe): bool => str_starts_with($nom, $prefixe));
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
    public static function url(array $route, Organization $organisation, string $bail, Unit $lot, Party $partie): string
    {
        $valeurs = [
            'organization' => $organisation->id,
            'lease' => $bail,
            'leaseParty' => (string) Str::uuid7(),
            'leaseUnit' => (string) Str::uuid7(),
            'document' => (string) Str::uuid7(),
            'submission' => (string) Str::uuid7(),
            'noticeRequest' => (string) Str::uuid7(),
        ];
        $url = route($route['name'], array_intersect_key($valeurs, array_flip(Route::getRoutes()->getByName($route['name'])?->parameterNames() ?? [])), false);

        $requete = match ($route['name']) {
            'leases.occupancy' => ['units' => [$lot->id], 'date' => '2026-11-16'],
            'leases.tenancies' => ['parties' => [$partie->id]],
            'leases.regimes' => ['unit' => $lot->id],
            default => [],
        };

        return $requete === [] ? $url : $url.'?'.http_build_query($requete);
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
            'leases.store' => LeaseDraftContext::payload($lot, $partie),
            'leases.update' => ['lock_version' => 1, 'note' => 'Note'],
            'leases.duplicate' => ['starts_on' => '2026-12-01'],
            'leases.sign' => ['signed_on' => '2026-11-10', 'lock_version' => 1],
            'leases.cancel', 'leases.renew' => ['lock_version' => 1],
            'leases.archive', 'leases.restore' => [],
            'leases.terms.revise' => ['lock_version' => 1, 'effective_on' => '2026-07-01', 'reason' => 'revision', 'changes' => [['component_term_id' => (string) Str::uuid7(), 'amount' => 66500]]],
            'leases.parties.store' => ['lock_version' => 1, 'party_id' => $partie->id, 'role' => 'tenant'],
            'leases.parties.end' => ['lock_version' => 1, 'valid_to' => '2026-12-01'],
            'leases.units.store' => ['lock_version' => 1, 'unit_id' => $lot->id, 'valid_from' => '2026-12-01'],
            'leases.units.end' => ['lock_version' => 1, 'valid_to' => '2026-12-01'],
            'leases.notice' => ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation'],
            'leases.terminate' => ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true, 'termination_reason' => 'Accord', 'requested_by' => 'tenant'],
            'leases.documents.store' => ['stored_file_id' => (string) Str::uuid7(), 'kind' => 'other'],
            'leases.documents.destroy', 'leases.insurance-submissions.accept', 'leases.insurance.reminder' => [],
            'leases.insurance-submissions.reject' => ['reason' => 'unreadable'],
            'leases.notice-requests.acknowledge' => ['received_on' => '2026-11-10'],
            default => throw new LogicException("Aucun corps de test pour la route {$route['name']}."),
        };
    }

    /**
     * @param  array{name: string, method: string, write: bool}  $route
     */
    public static function appeler(mixed $test, array $route, Organization $organisation, string $bail, Unit $lot, Party $partie): TestResponse
    {
        $corps = $route['write'] ? self::corps($route, $lot, $partie) : [];

        return $test->json($route['method'], self::url($route, $organisation, $bail, $lot, $partie), $corps);
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
