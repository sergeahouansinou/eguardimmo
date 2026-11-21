<?php

declare(strict_types=1);

namespace Tests\Feature\Privacy;

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication as Reauth;
use App\Modules\Identity\Models\User;
use Tests\Feature\Console\ConsoleContext as C;
use Tests\Feature\Tenant\TenantContext as T;

final class PrivacyContext
{
    public const string URL = '/api/v1/privacy/requests';

    public const string CONSOLE = '/api/v1/console/privacy-requests';

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function deposer(mixed $test, User $compte, string $type = 'access', array $corps = [], bool $avecPreuve = true): mixed
    {
        $preuve = $avecPreuve && in_array($type, ['access', 'portability', 'erasure'], true) ? ['password' => 'password'] : [];

        return T::comme($test, $compte)->postJson(self::URL, ['kind' => $type, ...$preuve, ...$corps]);
    }

    /**
     * Session web (Sanctum ne la démarre que pour une origine déclarée) portant une preuve de mot de passe récente : le téléchargement d'un export la réclame.
     */
    public static function avecPreuve(mixed $test, string $cle = Reauth::CLE_MOT_DE_PASSE): mixed
    {
        return self::navigateur($test)->withSession([$cle => now()->getTimestamp()]);
    }

    public static function navigateur(mixed $test): mixed
    {
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);

        return $test->withHeaders(['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/']);
    }

    /**
     * Demande déposée par le compte puis dont l'identité est constatée : prête à être traitée.
     *
     * @param  array{user: User, jeton: string}  $conformite
     */
    public static function ouverte(mixed $test, User $compte, array $conformite, string $type = 'access'): string
    {
        return (string) self::deposer($test, $compte, $type)->assertCreated()->json('data.id');
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function agir(mixed $test, array $operateur, string $id, string $action, array $corps = []): mixed
    {
        return C::ecrire($test, $operateur['jeton'], 'POST', self::CONSOLE."/{$id}/{$action}", $corps);
    }
}
