<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

final class CampaignsContext
{
    public const string AUJOURDHUI = '2026-11-19 10:00:00';

    public const string SECRET_WEBHOOK = 'secret-de-webhook-de-test';

    public static function fournisseur(): void
    {
        config([
            'notifications.campaigns.provider' => 'mailtrap',
            'notifications.campaigns.bulk_mailer' => 'array',
            'notifications.campaigns.from_address' => 'diffusion@agence.test',
            'notifications.campaigns.unsubscribe_key' => 'cle-de-desinscription-de-test-0123456789',
            'notifications.campaigns.webhook_secrets.mailtrap' => self::SECRET_WEBHOOK,
            'notifications.urls.tenant' => 'https://locataire.eguardimmo.test',
            'notifications.urls.owner' => 'https://proprietaire.eguardimmo.test',
        ]);
    }

    public static function url(Organization $organisation, string $suite = ''): string
    {
        return "/api/v1/org/{$organisation->id}/campaigns{$suite}";
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function appeler(mixed $test, Organization $organisation, ?User $compte, string $methode, string $suite = '', array $corps = [], bool $preuve = false): TestResponse
    {
        O::navigateurAgence($test);

        if ($preuve) {
            O::preuve($test);
        }

        O::comme($test, $compte);

        return $test->json($methode, self::url($organisation, $suite), $corps);
    }

    /**
     * @param  array<string, mixed>  $surcharge
     * @return array<string, mixed>
     */
    public static function corps(array $surcharge = []): array
    {
        return ['subject' => 'Coupure d\'eau mardi', 'body' => 'Bonjour {{ Prénom }}, l\'eau sera coupée mardi pour {Bien}.', 'audience' => 'tenants', 'building_ids' => [], 'copy_to_history' => true, ...$surcharge];
    }

    /**
     * Locataire avec compte, bail en cours et e-mail principal.
     *
     * @return array{user: User, party: Party, lease: Lease}
     */
    public static function locataire(Organization $organisation, ?string $email = null, ?User $compte = null): array
    {
        $locataire = T::locataire($organisation, compte: $compte);

        if ($email !== null) {
            T::emailPrincipal($organisation, $locataire['party'], $email);
        }

        return $locataire;
    }

    public static function creer(mixed $test, Organization $organisation, User $compte, array $surcharge = []): string
    {
        return (string) self::appeler($test, $organisation, $compte, 'POST', '', self::corps($surcharge))->assertCreated()->json('data.id');
    }

    public static function envoyer(mixed $test, Organization $organisation, User $compte, string $id): TestResponse
    {
        return self::appeler($test, $organisation, $compte, 'POST', "/{$id}/send", [], true);
    }

    public static function titulaire(Organization $organisation): User
    {
        return L::titulaire($organisation);
    }

    /**
     * @return Collection<int, CampaignDelivery>
     */
    public static function envois(Organization $organisation, string $campagne): Collection
    {
        return L::dans($organisation, fn () => CampaignDelivery::query()->where('campaign_id', $campagne)->orderBy('id')->get());
    }

    public static function pdf(string $nom = 'avis.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($nom, "%PDF-1.4\n% avis aux locataires\n");
    }
}
