<?php

declare(strict_types=1);

namespace Tests\Feature\Notifications;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;

final class NotificationsContext
{
    public const string URL = '/api/v1/notifications';

    /**
     * @return list<string> types reçus par le compte, dans l'ordre de création
     */
    public static function types(User $compte): array
    {
        return array_values(Notification::query()->where('user_id', $compte->id)->orderBy('id')->get()->map(fn (Notification $n): string => $n->type->value)->all());
    }

    public static function nombre(User $compte, ?NotificationType $type = null): int
    {
        return Notification::query()->where('user_id', $compte->id)->when($type !== null, fn ($q) => $q->where('type', $type?->value))->count();
    }

    public static function premiere(User $compte, NotificationType $type): Notification
    {
        return Notification::query()->where('user_id', $compte->id)->where('type', $type->value)->firstOrFail();
    }

    public static function equipe(Organization $organisation): array
    {
        return [
            'owner' => L::titulaire($organisation),
            'manager' => L::membre($organisation, MemberRole::Manager),
            'accountant' => L::membre($organisation, MemberRole::Accountant),
        ];
    }

    public static function retirer(Organization $organisation, User $compte): void
    {
        L::dans($organisation, fn (): int => OrganizationMember::query()->where('user_id', $compte->id)->update(['status' => MemberStatus::Disabled]));
    }

    /**
     * Ligne insérée directement, pour éprouver la lecture sans passer par un événement.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function ligne(User $compte, ?Organization $organisation, NotificationType $type, array $attributs = []): Notification
    {
        return Notification::factory()->create([
            'user_id' => $compte->id,
            'organization_id' => $organisation?->id,
            'audience' => $type->audience(),
            'type' => $type,
            'title' => $type->label(),
            'body' => 'Texte de la notification.',
            'link' => '/finances/impayes',
            'in_app' => true,
            ...$attributs,
        ]);
    }

    public static function comme(object $test, User $compte): object
    {
        return T::comme($test, $compte);
    }

    /**
     * @return array{plain: string, id: string}
     */
    public static function sessionMobile(User $compte, string $nom = 'Pixel 8'): array
    {
        $jeton = $compte->createToken($nom, ['mobile'], now()->addDays(30));

        return ['plain' => $jeton->plainTextToken, 'id' => (string) $jeton->accessToken->getKey()];
    }

    public static function jetonAppareil(): string
    {
        return Str::random(160);
    }
}
