<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class ContactUpdates
{
    /**
     * Vue de l'équipe, sous le contexte de son organisation.
     *
     * @return CursorPaginator<int, ContactUpdateRequest>
     */
    public function ofParty(string $partyId, int $parPage, ?string $curseur): CursorPaginator
    {
        $partie = (Str::isUuid($partyId) ? Party::query()->find($partyId) : null) ?? throw ErrorCode::PartyNotFound->problem();

        return ContactUpdateRequest::query()
            ->where('party_id', $partie->id)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $partyId, string $id): ContactUpdateRequest
    {
        return (Str::isUuid($id) ? ContactUpdateRequest::query()->where('party_id', $partyId)->whereKey($id)->first() : null) ?? throw ErrorCode::ContactUpdateNotFound->problem();
    }

    /**
     * Demandes d'un compte, toutes organisations confondues : la clé est la fiche rattachée au compte, jamais un identifiant du client.
     *
     * @return CursorPaginator<int, ContactUpdateRequest>
     */
    public function ofAccount(string $userId, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->mine($userId)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function purge(CarbonInterface $now): int
    {
        return AcrossOrganizations::query(ContactUpdateRequest::class)
            ->where('created_at', '<', $now->copy()->subDays(ContactUpdateRequest::RETENTION_DAYS))
            ->delete();
    }

    /**
     * @return Builder<ContactUpdateRequest>
     */
    private function mine(string $userId): Builder
    {
        return AcrossOrganizations::query(ContactUpdateRequest::class)->where('requested_by_user_id', $userId);
    }
}
