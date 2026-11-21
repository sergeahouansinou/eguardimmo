<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

final class OwnerInvitationCode
{
    public const int LONGUEUR = 6;

    public const int ESSAIS_MAX = 5;

    public static function generate(): string
    {
        return str_pad((string) random_int(0, 10 ** self::LONGUEUR - 1), self::LONGUEUR, '0', STR_PAD_LEFT);
    }

    /**
     * Haché avec APP_KEY et l'identifiant de l'invitation : six chiffres ne se retrouvent pas sans la clé.
     */
    public static function hash(string $invitationId, #[\SensitiveParameter] string $code): string
    {
        return hash_hmac('sha256', $invitationId.'|'.$code, self::cle());
    }

    public static function matches(string $invitationId, ?string $hashStocke, #[\SensitiveParameter] string $code): bool
    {
        return $hashStocke !== null && hash_equals($hashStocke, self::hash($invitationId, $code));
    }

    private static function cle(): string
    {
        $cle = config('app.key');

        return is_string($cle) && $cle !== '' ? $cle : throw new \RuntimeException('APP_KEY doit être renseignée.');
    }
}
