<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Str;

final class InvitationToken
{
    public const VALIDITE_JOURS = 7;

    public static function hash(string $jeton): string
    {
        return hash('sha256', $jeton);
    }

    public static function issue(OrganizationMember $membre): string
    {
        $jeton = Str::random(48);

        $membre->forceFill([
            'invitation_token_hash' => self::hash($jeton),
            'invitation_expires_at' => now()->addDays(self::VALIDITE_JOURS),
            'invited_at' => now(),
        ]);

        return $jeton;
    }

    public static function url(string $jeton): string
    {
        $base = config('identity.hub_url');

        return (is_string($base) ? rtrim($base, '/') : '').'/invitation/'.$jeton;
    }
}
