<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Queries;

use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Models\PrivacyRequest;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;

final class PrivacyRequests
{
    private const OUVERTES = [RequestStatus::Received, RequestStatus::InProgress];

    /**
     * @return Collection<int, PrivacyRequest>
     */
    public function ownedBy(string $userId): Collection
    {
        return PrivacyRequest::query()->where('requester_user_id', $userId)->orderByDesc('id')->limit(100)->get();
    }

    public function findOwned(string $userId, string $id): PrivacyRequest
    {
        return Str::isUuid($id)
            ? PrivacyRequest::query()->where('requester_user_id', $userId)->whereKey(strtolower($id))->first() ?? throw ErrorCode::RequestNotFound->problem()
            : throw ErrorCode::RequestNotFound->problem();
    }

    public function find(string $id): PrivacyRequest
    {
        return Str::isUuid($id)
            ? PrivacyRequest::query()->with('events')->find(strtolower($id)) ?? throw ErrorCode::RequestNotFound->problem()
            : throw ErrorCode::RequestNotFound->problem();
    }

    /**
     * À appeler dans la transaction de l'écriture : la ligne est verrouillée jusqu'à son terme.
     */
    public function forUpdate(string $id): PrivacyRequest
    {
        return PrivacyRequest::query()->lockForUpdate()->find($id) ?? throw ErrorCode::RequestNotFound->problem();
    }

    /**
     * @return CursorPaginator<int, PrivacyRequest>
     */
    public function page(?RequestStatus $statut, ?RequestKind $type, bool $enRetard, ?string $curseur, int $parPage): CursorPaginator
    {
        return PrivacyRequest::query()
            ->when($statut !== null, fn (Builder $q): Builder => $q->where('status', $statut))
            ->when($type !== null, fn (Builder $q): Builder => $q->where('kind', $type))
            ->when($enRetard, fn (Builder $q): Builder => $q->whereIn('status', self::OUVERTES)->whereRaw('COALESCE(extended_until, due_at) < ?', [now()->format('Y-m-d H:i:s.u')]))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @return array{open: int, overdue: int}
     */
    public function counts(): array
    {
        $ouvertes = PrivacyRequest::query()->whereIn('status', self::OUVERTES);

        return [
            'open' => (clone $ouvertes)->count(),
            'overdue' => (clone $ouvertes)->whereRaw('COALESCE(extended_until, due_at) < ?', [now()->format('Y-m-d H:i:s.u')])->count(),
        ];
    }
}
