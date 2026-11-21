<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Queries;

use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Models\PrivacyRequestForward;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;

final class RequestForwards
{
    /**
     * Toutes organisations confondues : sert la console, qui ne lit que des nombres.
     *
     * @return list<string>
     */
    public function organizationIdsOf(string $requestId): array
    {
        return array_values(AcrossOrganizations::query(PrivacyRequestForward::class)
            ->where('privacy_request_id', $requestId)
            ->pluck('organization_id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }

    /**
     * @param  list<string>  $requestIds
     * @return array<string, array{total: int, handled: int}>
     */
    public function countsOf(array $requestIds): array
    {
        if ($requestIds === []) {
            return [];
        }

        $comptes = [];

        foreach (AcrossOrganizations::query(PrivacyRequestForward::class)->whereIn('privacy_request_id', $requestIds)->get(['privacy_request_id', 'handled_at']) as $transmission) {
            $comptes[$transmission->privacy_request_id] ??= ['total' => 0, 'handled' => 0];
            $comptes[$transmission->privacy_request_id]['total']++;
            $comptes[$transmission->privacy_request_id]['handled'] += $transmission->handled_at === null ? 0 : 1;
        }

        return $comptes;
    }

    /**
     * Organisation courante seulement (portée globale).
     *
     * @return CursorPaginator<int, PrivacyRequestForward>
     */
    public function pageOfCurrentOrganization(?string $curseur, int $parPage): CursorPaginator
    {
        return PrivacyRequestForward::query()
            ->with('privacyRequest')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function findInCurrentOrganization(string $id): PrivacyRequestForward
    {
        return Str::isUuid($id)
            ? PrivacyRequestForward::query()->with('privacyRequest')->find(strtolower($id)) ?? throw ErrorCode::RequestNotFound->problem()
            : throw ErrorCode::RequestNotFound->problem();
    }

    public function lockInCurrentOrganization(string $id): PrivacyRequestForward
    {
        return PrivacyRequestForward::query()->lockForUpdate()->find($id) ?? throw ErrorCode::RequestNotFound->problem();
    }
}
