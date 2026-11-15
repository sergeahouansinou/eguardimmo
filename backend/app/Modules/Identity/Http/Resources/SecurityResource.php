<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property User $resource
 */
final class SecurityResource extends JsonResource
{
    public const CODES_DE_SECOURS_TOTAL = 8;

    /**
     * @param  Collection<int, PersonalAccessToken>  $devices
     */
    public function __construct(User $user, private readonly Collection $devices)
    {
        parent::__construct($user);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->resource;
        $deuxFacteurs = $user->hasConfirmedTwoFactor();
        $parMotDePasse = EnsureRecentReauthentication::confirmedUntil($request, EnsureRecentReauthentication::CLE_MOT_DE_PASSE);
        $parCode = EnsureRecentReauthentication::confirmedUntil($request, EnsureRecentReauthentication::CLE_2FA);
        $courant = $request->user()?->currentAccessToken();

        return [
            'email' => $user->email,
            'email_verified' => $user->email_verified_at !== null,
            'has_password' => $user->password !== null,
            'two_factor' => [
                'enabled' => $deuxFacteurs,
                'enabled_at' => $deuxFacteurs ? $user->two_factor_confirmed_at?->toIso8601String() : null,
                'backup_codes_remaining' => $deuxFacteurs ? count($user->recoveryCodes()) : 0,
                'backup_codes_total' => $deuxFacteurs ? self::CODES_DE_SECOURS_TOTAL : 0,
            ],
            'linked_accounts' => array_map(function (SocialProvider $fournisseur) use ($user): array {
                $identite = $user->socialIdentities->firstWhere('provider', $fournisseur);

                return [
                    'provider' => $fournisseur->value,
                    'linked' => $identite !== null,
                    'email' => $identite?->email,
                    'linked_at' => $identite?->created_at?->toIso8601String(),
                ];
            }, SocialProvider::cases()),
            'devices' => $this->devices->map(fn (PersonalAccessToken $jeton): array => [
                'id' => $jeton->id,
                'name' => $jeton->name,
                'type' => 'mobile',
                'last_activity_at' => ($jeton->last_used_at ?? $jeton->created_at)?->toIso8601String(),
                'current' => $courant instanceof PersonalAccessToken && $courant->id === $jeton->id,
            ])->values()->all(),
            'confirmed_until' => $this->latest($parMotDePasse, $parCode)?->toIso8601String(),
            'confirmed_with_code_until' => $parCode?->toIso8601String(),
        ];
    }

    private function latest(?CarbonInterface $a, ?CarbonInterface $b): ?CarbonInterface
    {
        if ($a === null || $b === null) {
            return $a ?? $b;
        }

        return $a->greaterThan($b) ? $a : $b;
    }
}
