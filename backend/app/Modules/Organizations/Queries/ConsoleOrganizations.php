<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Organizations\Data\ConsoleOrganizationData;
use App\Modules\Organizations\Data\ConsoleOrganizationFilters;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;

/**
 * Lecture de plateforme des organisations : état, effectif et titulaire, jamais le contenu de l'organisation.
 */
final class ConsoleOrganizations
{
    /**
     * @return CursorPaginator<int, Organization>
     */
    public function page(ConsoleOrganizationFilters $filtres): CursorPaginator
    {
        return Organization::query()
            ->when($filtres->kind !== null, fn (Builder $q): Builder => $q->where('kind', $filtres->kind))
            ->when($filtres->state === 'suspended', fn (Builder $q): Builder => $q->whereNotNull('suspended_at'))
            ->when($filtres->state === 'active', fn (Builder $q): Builder => $q->whereNull('suspended_at'))
            ->when($filtres->namePrefix !== null, fn (Builder $q): Builder => $q->where('name', 'like', addcslashes((string) $filtres->namePrefix, '\\%_').'%'))
            ->when($filtres->onlyIds !== null, fn (Builder $q): Builder => $q->whereIn('id', (array) $filtres->onlyIds))
            ->orderByDesc('id')
            ->cursorPaginate($filtres->perPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }

    public function find(string $id): Organization
    {
        $organisation = Str::isUuid($id) ? Organization::query()->find(strtolower($id)) : null;

        return $organisation ?? throw ErrorCode::OrganizationNotFound->problem();
    }

    /**
     * @param  array{first_name: string, last_name: string, account_id: string|null}|null  $owner
     */
    public function data(Organization $organisation, int $effectif, ?string $plan, ?string $statut, ?array $owner = null, bool $detailed = false): ConsoleOrganizationData
    {
        return new ConsoleOrganizationData(
            $organisation->id, $organisation->name, $organisation->kind->value, $organisation->country, $organisation->created_at,
            $organisation->suspended_at, $organisation->suspension_reason?->value, $organisation->two_factor_required,
            $effectif, $plan, $statut, $owner, $detailed,
        );
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, int> effectif actif par organisation
     */
    public function activeMemberCounts(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        /** @var array<string, int> $nombres */
        $nombres = AcrossOrganizations::query(OrganizationMember::class)
            ->whereIn('organization_id', $ids)
            ->where('status', MemberStatus::Active)
            ->selectRaw('organization_id, count(*) as total')
            ->groupBy('organization_id')
            ->pluck('total', 'organization_id')
            ->map(fn (mixed $n): int => (int) $n)
            ->all();

        return $nombres;
    }

    /**
     * @return array{first_name: string, last_name: string, account_id: string|null}|null
     */
    public function owner(string $organizationId): ?array
    {
        $titulaire = AcrossOrganizations::query(OrganizationMember::class)
            ->where('organization_id', $organizationId)
            ->where('role', MemberRole::Owner)
            ->where('status', MemberStatus::Active)
            ->orderBy('joined_at')
            ->first();

        return $titulaire === null ? null : ['first_name' => $titulaire->first_name, 'last_name' => $titulaire->last_name, 'account_id' => $titulaire->user_id];
    }
}
