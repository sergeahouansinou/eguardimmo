<?php

declare(strict_types=1);

namespace Tests\Feature\Messaging;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Organizations\Models\Organization;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Owner\OwnerContext as O;

final class SupportAccessContext
{
    public const string AUJOURDHUI = '2026-11-19 10:00:00';

    /**
     * @return array{user: User, jeton: string}
     */
    public static function operateur(string $nom = 'Julie Martin'): array
    {
        $operateur = User::factory()->create(['name' => $nom]);
        $operateur->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
        activerDeuxFacteurs($operateur);

        return ['user' => $operateur, 'jeton' => $operateur->createToken('console', ['operator'])->plainTextToken];
    }

    public static function demande(mixed $test, User $demandeur, ?Organization $organisation): string
    {
        auth()->forgetGuards();
        $corps = ['category' => 'billing', 'subject' => 'Écriture comptable à vérifier', 'body' => 'Bonjour, une écriture semble erronée.'];
        $corps += $organisation === null ? ['space' => 'marketplace'] : ['space' => 'organization', 'organization_id' => $organisation->id];

        return (string) $test->actingAs($demandeur, 'web')->postJson('/api/v1/support/tickets', $corps)->assertCreated()->json('data.id');
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function demanderAcces(mixed $test, string $jeton, string $ticket, array $corps = []): TestResponse
    {
        self::jeton($test);

        return $test->withToken($jeton)->postJson("/api/v1/console/support/tickets/{$ticket}/access-requests", avecPreuve($jeton, [
            'reason' => 'Vérifier le paramétrage de la facturation',
            'scopes' => ['settings', 'team'],
            'duration_hours' => 24,
            ...$corps,
        ]));
    }

    public static function urgence(mixed $test, string $jeton, string $ticket, string $fondement = 'security_incident'): TestResponse
    {
        self::jeton($test);

        return $test->withToken($jeton)->postJson("/api/v1/console/support/tickets/{$ticket}/emergency-access", avecPreuve($jeton, [
            'reason' => 'Compte administrateur potentiellement compromis',
            'basis' => $fondement,
        ]));
    }

    public static function organisation(mixed $test, Organization $organisation, User $compte, string $suite = '', string $methode = 'GET', array $corps = []): TestResponse
    {
        O::navigateurAgence($test);
        O::comme($test, $compte);

        return $test->json($methode, "/api/v1/org/{$organisation->id}/support-access{$suite}", $corps);
    }

    public static function console(mixed $test, string $jeton, string $organisation, string $ressource): TestResponse
    {
        self::jeton($test);

        return $test->withToken($jeton)->getJson("/api/v1/console/organizations/{$organisation}/{$ressource}");
    }

    /**
     * Accès actif posé directement : les parcours de demande et de consentement ont leurs propres tests.
     *
     * @param  list<string>  $perimetres
     */
    public static function accesActif(mixed $test, string $jeton, string $ticket, Organization $organisation, User $decideur, array $perimetres = ['settings', 'team'], int $heures = 24): string
    {
        $id = (string) self::demanderAcces($test, $jeton, $ticket, ['scopes' => $perimetres, 'duration_hours' => $heures])->assertCreated()->json('data.id');
        O::preuve($test);
        self::organisation($test, $organisation, $decideur, "/{$id}/accept", 'POST')->assertOk();

        return $id;
    }

    /**
     * Un jeton opérateur n'est lu que sur une requête sans origine d'application web : sinon Sanctum ne regarde que la session.
     */
    public static function jeton(mixed $test): void
    {
        auth()->forgetGuards();
        $test->withoutHeaders(['Origin', 'Referer', 'Authorization']);
    }

    public static function grant(string $id): SupportAccessGrant
    {
        return SupportAccessGrant::query()->findOrFail($id);
    }
}
