<?php

declare(strict_types=1);

namespace Tests\Feature\Owner;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\CurrentOrganization;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Tenant\TenantContext as T;

final class OwnerContext
{
    public const string AUJOURDHUI = '2026-11-19 10:00:00';

    /**
     * Sans origine déclarée, Sanctum ne démarre pas la session : la preuve 2FA de l'agent en dépend.
     */
    public const array ORIGINE = ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'];

    /**
     * Navigateur de l'agence : sans domaine déclaré et sans origine, Sanctum ne démarre pas la session, qui porte la preuve 2FA.
     */
    public static function navigateurAgence(mixed $test): void
    {
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
        $test->withHeaders(self::ORIGINE);
    }

    /**
     * Preuve 2FA fraîche dans une session neuve : un saut dans le temps ou un autre compte invalide la session précédente.
     */
    public static function preuve(mixed $test, string $methode = EnsureRecentReauthentication::METHODE_TOTP): void
    {
        $test->flushSession();
        $test->withSession([EnsureRecentReauthentication::CLE_2FA => now()->getTimestamp(), EnsureRecentReauthentication::CLE_METHODE_2FA => $methode]);
    }

    /**
     * Même rôle que `TenantContext::comme`, avec la garde de session que lit la preuve 2FA.
     */
    public static function comme(mixed $test, ?User $compte): mixed
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);

        return $compte === null ? $test : $test->actingAs($compte, 'web');
    }

    /**
     * Un mandant personne physique avec son e-mail principal.
     */
    public static function mandant(Organization $organisation, string $email = 'awa@exemple.fr', bool $societe = false): Party
    {
        $partie = L::dans($organisation, fn (): Party => $societe ? Party::factory()->company('SCI du Port')->create() : Party::factory()->create());
        T::emailPrincipal($organisation, $partie, $email);

        return $partie;
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function mandat(Organization $organisation, Party $mandant, MandateStatus $statut = MandateStatus::Active, array $attributs = []): Mandate
    {
        return M::mandat($organisation, M::lot($organisation), $mandant, $attributs, $statut);
    }

    /**
     * Accès posé directement en base, sans passer par l'invitation.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function acces(Organization $organisation, Party $mandant, User $compte, OwnerAccessRole $role = OwnerAccessRole::Holder, array $attributs = []): OwnerAccess
    {
        return L::dans($organisation, fn (): OwnerAccess => OwnerAccess::factory()->create([
            'mandant_party_id' => $mandant->id,
            'user_id' => $compte->id,
            'role' => $role,
            'person_party_id' => $role === OwnerAccessRole::CoOwner ? Party::factory()->create()->id : null,
            ...$attributs,
        ]));
    }

    /**
     * Un compte propriétaire complet : mandant, mandat actif et accès vivant.
     *
     * @return array{user: User, party: Party, mandate: Mandate, access: OwnerAccess}
     */
    public static function proprietaire(Organization $organisation, string $email = 'awa@exemple.fr', OwnerAccessRole $role = OwnerAccessRole::Holder, MandateStatus $statut = MandateStatus::Active): array
    {
        $compte = User::factory()->create(['email' => $email]);
        $mandant = self::mandant($organisation, $email, $role === OwnerAccessRole::Representative);

        return [
            'user' => $compte,
            'party' => $mandant,
            'mandate' => self::mandat($organisation, $mandant, $statut),
            'access' => self::acces($organisation, $mandant, $compte, $role),
        ];
    }

    public static function urlAcces(Organization $organisation, Party $partie, string $suite = ''): string
    {
        return "/api/v1/org/{$organisation->id}/parties/{$partie->id}/owner-access{$suite}";
    }
}
