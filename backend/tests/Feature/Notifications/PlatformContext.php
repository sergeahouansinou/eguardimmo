<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\NotificationPreference;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Models\PushToken;
use App\Modules\Notifications\Push\FakeDriver;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Console\ConsoleContext;

final class PlatformContext
{
    public const string URL = '/api/v1/console/marketing/campaigns';

    public const string CONSOLE = '/api/v1/console';

    public const string AUJOURDHUI = '2026-11-25 09:00:00';

    /**
     * @return array{user: User, jeton: string}
     */
    public static function preparer(mixed $test): array
    {
        Storage::fake('local');
        CampaignsContext::fournisseur();
        config(['notifications.push.driver' => 'fake', 'notifications.urls.account' => 'https://compte.eguardimmo.test']);
        $test->travelTo(CarbonImmutable::parse(self::AUJOURDHUI));

        return ConsoleContext::operateur(['admin'], email: 'ops@eguardimmo.test');
    }

    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function email(array $surcharges = []): array
    {
        return [
            'channel' => 'email',
            'category' => 'marketing',
            'audience' => 'all_accounts',
            'subject' => 'Nouveautés de novembre',
            'html' => '<h1>Bonjour</h1><p>Découvrez les <a href="https://eguardimmo.com/nouveautes">nouveautés</a>.</p>',
            ...$surcharges,
        ];
    }

    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function push(array $surcharges = []): array
    {
        return [
            'channel' => 'push',
            'category' => 'service',
            'audience' => 'all_accounts',
            'push_title' => 'Maintenance prévue',
            'push_body' => 'Le service sera indisponible dimanche matin.',
            'link' => '/notifications',
            ...$surcharges,
        ];
    }

    /**
     * Envoi multipart, preuve fraîche comprise.
     *
     * @param  array<string, mixed>  $corps
     */
    public static function deposer(mixed $test, string $jeton, string $url, array $corps): TestResponse
    {
        ConsoleContext::reinitialiser($test);

        return $test->withToken($jeton)->post($url, avecPreuve($jeton, $corps), ['Accept' => 'application/json']);
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function creer(mixed $test, string $jeton, array $corps): string
    {
        return (string) ConsoleContext::ecrire($test, $jeton, 'POST', self::URL, $corps)->assertCreated()->json('data.id');
    }

    public static function envoyer(mixed $test, string $jeton, string $id, int $version = 1): TestResponse
    {
        return ConsoleContext::ecrire($test, $jeton, 'POST', self::URL."/{$id}/send", ['lock_version' => $version]);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function compte(string $email, array $attributs = []): User
    {
        return User::factory()->create(['email' => $email, ...$attributs]);
    }

    public static function preference(User $compte, NotificationType $type, NotificationChannel $canal, bool $actif = true): void
    {
        NotificationPreference::query()->updateOrCreate(['user_id' => $compte->id, 'type' => $type->value, 'channel' => $canal->value], ['enabled' => $actif]);
    }

    public static function abonne(string $email): User
    {
        $compte = self::compte($email);
        self::preference($compte, NotificationType::AccountMarketing, NotificationChannel::Email);

        return $compte;
    }

    public static function appareil(User $compte): PushToken
    {
        $session = NotificationsContext::sessionMobile($compte);
        $valeur = NotificationsContext::jetonAppareil();

        return PushToken::query()->create([
            'user_id' => $compte->id,
            'access_token_id' => $session['id'],
            'platform' => 'android',
            'token' => $valeur,
            'token_hash' => PushToken::hash($valeur),
        ]);
    }

    public static function pilote(): FakeDriver
    {
        return app(FakeDriver::class);
    }

    /**
     * @return Collection<string, PlatformCampaignDelivery> lignes d'envoi par compte
     */
    public static function envois(string $campagneId): Collection
    {
        return PlatformCampaignDelivery::query()->where('campaign_id', $campagneId)->get()->toBase()->keyBy('user_id');
    }

    public static function png(string $nom = 'logo.png', int $largeur = 4): UploadedFile
    {
        return UploadedFile::fake()->image($nom, $largeur, $largeur);
    }
}
