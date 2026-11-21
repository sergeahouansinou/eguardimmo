<?php

declare(strict_types=1);

namespace Tests\Feature\Organizations;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;

final class ActivityContext
{
    public const string AUJOURDHUI = '2026-11-21 10:00:00';

    /**
     * @return array{org: Organization, owner: User, admin: User, manager: User, accountant: User}
     */
    public static function equipe(): array
    {
        M::semer();
        $org = M::organisation();

        return [
            'org' => $org,
            'owner' => M::titulaire($org),
            'admin' => M::membre($org, MemberRole::Admin),
            'manager' => M::membre($org, MemberRole::Manager),
            'accountant' => M::membre($org, MemberRole::Accountant),
        ];
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function entree(Organization|string|null $org, string $action, array $attributs = []): AuditLog
    {
        if (is_string($attributs['occurred_at'] ?? null)) {
            $attributs['occurred_at'] = CarbonImmutable::parse($attributs['occurred_at'], 'UTC');
        }

        return AuditLog::query()->create([
            'occurred_at' => CarbonImmutable::parse(self::AUJOURDHUI)->subMinutes(5),
            'action' => $action,
            'organization_id' => $org instanceof Organization ? $org->id : $org,
            'metadata' => [],
            'request_id' => (string) Str::uuid7(),
            ...$attributs,
        ]);
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/activity{$chemin}";
    }
}
